import { env } from "cloudflare:workers";
import { lookupBarcodes } from "@/app/lib/barcodes";
import { resolveRequestIdentity } from "@/app/lib/app-auth";

type LookupItem = {
  id: string;
  upc?: string;
  sku?: string;
  name?: string;
  brand?: string;
};

type ImageCandidate = {
  url: string;
  source: string;
  sourceUrl: string;
  productName: string;
  barcode: string;
  score: number;
};

const extensionFor = (contentType: string) => {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
};

const safeImageUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed : null;
  } catch {
    return null;
  }
};

const textSimilarity = (left = "", right = "") => {
  const words = (value: string) =>
    new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((word) => word.length > 2));
  const a = words(left), b = words(right);
  if (!a.size || !b.size) return 0;
  return [...a].filter((word) => b.has(word)).length / Math.max(a.size, b.size);
};

const officialSieteCandidates = async (item: LookupItem, barcodes: string[]) => {
  if (!/siete/i.test(`${item.brand ?? ""} ${item.name ?? ""}`)) return [] as ImageCandidate[];
  try {
    const sitemapResponse = await fetch("https://sietefoods.com/sitemap-0.xml", {
      headers: { "user-agent": "PlanogramStudioPro/2.0 (official product image matching)" },
    });
    if (!sitemapResponse.ok) return [];
    const sitemap = await sitemapResponse.text(),
      urls = [...sitemap.matchAll(/<loc>(https:\/\/sietefoods\.com\/[^<]+)<\/loc>/g)]
        .map((match) => match[1])
        .filter((url) => {
          try {
            const path = new URL(url).pathname.split("/").filter(Boolean);
            return path.length === 1;
          } catch {
            return false;
          }
        })
        .map((url) => ({ url, score: textSimilarity(item.name, new URL(url).pathname.replace(/[\/-]+/g, " ")) }))
        .filter((candidate) => candidate.score >= 0.35)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4),
      candidates: ImageCandidate[] = [];
    for (const page of urls) {
      const response = await fetch(page.url, {
        headers: { "user-agent": "PlanogramStudioPro/2.0 (official product image matching)" },
      });
      if (!response.ok) continue;
      const html = await response.text(),
        image = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1]
          ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1]
          ?? "",
        title = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1]
          ?? html.match(/<title>([^<]+)/i)?.[1]
          ?? "",
        gtins = [...html.matchAll(/"gtin(?:8|12|13|14)?"\s*:\s*"?(\d{8,14})/gi)].map((match) => match[1]),
        exactBarcode = gtins.some((gtin) => barcodes.includes(gtin));
      if (!safeImageUrl(image)) continue;
      const similarity = textSimilarity(item.name, title);
      if (!exactBarcode && similarity < 0.5) continue;
      candidates.push({
        url: image,
        source: "Siete Foods (official)",
        sourceUrl: page.url,
        productName: title,
        barcode: gtins.find((gtin) => barcodes.includes(gtin)) ?? barcodes[0],
        score: exactBarcode ? 125 : 105 + similarity * 10,
      });
    }
    return candidates;
  } catch {
    return [];
  }
};

const downloadCandidate = async (candidate: ImageCandidate, itemId: string) => {
  const parsed = safeImageUrl(candidate.url);
  if (!parsed) return null;
  const imageResponse = await fetch(parsed.toString(), {
    headers: { "user-agent": "PlanogramStudioPro/2.0 (product image matching)" },
  });
  const contentType = imageResponse.headers.get("content-type") || "";
  const contentLength = Number(imageResponse.headers.get("content-length") || 0);
  if (!imageResponse.ok || !contentType.startsWith("image/") || contentLength > 12_000_000)
    return null;
  const bytes = await imageResponse.arrayBuffer();
  if (bytes.byteLength < 4_000 || bytes.byteLength > 12_000_000) return null;
  const safeId = itemId.replace(/[^a-zA-Z0-9_-]/g, "") || "product";
  const key = `products/${safeId}-matched-${Date.now()}.${extensionFor(contentType)}`;
  await env.BUCKET.put(key, bytes, { httpMetadata: { contentType } });
  return { key, bytes: bytes.byteLength };
};

export async function POST(request: Request) {
  try {
    const identity = await resolveRequestIdentity(request);
    if (!identity)
      return Response.json({ error: "Sign in required" }, { status: 401 });
    const body = (await request.json()) as { products?: LookupItem[] };
    const products = Array.isArray(body.products) ? body.products.slice(0, 10) : [];
    if (!products.length)
      return Response.json({ error: "No UPCs were provided." }, { status: 400 });

    const matches: Array<{
      id: string;
      image: string;
      barcode: string;
      productName: string;
      sourceUrl: string;
      source: string;
      qualityScore: number;
    }> = [];
    const missing: string[] = [];

    let lookupRequests = 0;
    let premiumFallbacks = 0;
    for (const item of products) {
      const barcodes = lookupBarcodes(item);
      if (!barcodes.length) {
        missing.push(item.id);
        continue;
      }
      try {
        let barcode = "";
        let result: {
          status?: number;
          product?: {
            product_name?: string;
            image_front_url?: string;
            image_url?: string;
          };
        } | null = null;
        let exhaustedCandidates = true;
        for (const candidate of barcodes) {
          // Stay below the public source's request limit. Deferred products are
          // omitted from `missing`, so the next background batch resumes them.
          if (lookupRequests >= 14) {
            exhaustedCandidates = false;
            break;
          }
          lookupRequests += 1;
          const lookup = await fetch(
            `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(candidate)}?fields=code,product_name,brands,image_front_url,image_url`,
            {
              headers: {
                "user-agent":
                  "PlanogramStudioPro/1.0 (UPC product image lookup)",
              },
            },
          );
          if (!lookup.ok) continue;
          const candidateResult = (await lookup.json()) as NonNullable<typeof result>;
          const candidateSource =
            candidateResult.product?.image_front_url ||
            candidateResult.product?.image_url ||
            "";
          if (candidateResult.status === 1 && candidateSource) {
            barcode = candidate;
            result = candidateResult;
            break;
          }
        }
        const imageCandidates: ImageCandidate[] = [];
        imageCandidates.push(...await officialSieteCandidates(item, barcodes));
        if (result && barcode) {
          const sourceUrl = result.product?.image_front_url || result.product?.image_url || "";
          if (safeImageUrl(sourceUrl)) imageCandidates.push({
            url: sourceUrl,
            source: "Open Food Facts",
            sourceUrl: `https://world.openfoodfacts.org/product/${barcode}`,
            productName: result.product?.product_name || "",
            barcode,
            score: 70 + textSimilarity(`${item.brand ?? ""} ${item.name ?? ""}`, result.product?.product_name) * 20,
          });
        }

        if (premiumFallbacks < 3 && barcodes[0]) {
          premiumFallbacks += 1;
          const code = barcodes[0];
          const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`, {
            headers: { "user-agent": "PlanogramStudioPro/2.0 (product image matching)" },
          });
          if (response.ok) {
            const data = (await response.json()) as { items?: Array<{ title?: string; brand?: string; images?: string[] }> };
            const found = data.items?.[0];
            for (const image of (found?.images ?? []).slice(0, 3)) {
              if (!safeImageUrl(image)) continue;
              imageCandidates.push({
                url: image,
                source: "UPCitemdb",
                sourceUrl: `https://www.upcitemdb.com/upc/${code}`,
                productName: found?.title || "",
                barcode: code,
                score: 88 + textSimilarity(`${item.brand ?? ""} ${item.name ?? ""}`, `${found?.brand ?? ""} ${found?.title ?? ""}`) * 12,
              });
            }
          }
        }

        let chosen: ImageCandidate | null = null;
        let stored: Awaited<ReturnType<typeof downloadCandidate>> = null;
        for (const candidate of imageCandidates.sort((a, b) => b.score - a.score)) {
          stored = await downloadCandidate(candidate, item.id);
          if (stored) { chosen = candidate; break; }
        }
        if (!chosen || !stored) {
          if (exhaustedCandidates) missing.push(item.id);
          continue;
        }
        matches.push({
          id: item.id,
          image: `/api/images?key=${encodeURIComponent(stored.key)}`,
          barcode: chosen.barcode,
          productName: chosen.productName,
          sourceUrl: chosen.sourceUrl,
          source: chosen.source,
          qualityScore: Math.round(chosen.score + Math.min(10, stored.bytes / 250_000)),
        });
      } catch {
        missing.push(item.id);
      }
    }

    return Response.json({ matches, missing });
  } catch {
    return Response.json(
      { error: "Image lookup is temporarily unavailable." },
      { status: 500 },
    );
  }
}
