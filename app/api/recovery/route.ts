import { env } from "cloudflare:workers";
import { OWNER_EMAIL, resolveRequestIdentity } from "@/app/lib/app-auth";
import { inspectWorkspace, sliceWorkspace } from "@/app/lib/recovery-stream";

const headers = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };
type Saved = { data: string; updated_at: number };

async function openSaved(data: string) {
  const pointer = JSON.parse(data) as { r2Key?: string; encoding?: string };
  if (!pointer.r2Key) return new Blob([data]).stream();
  const object = await env.BUCKET.get(pointer.r2Key);
  if (!object) throw new Error("This saved file could not be found. No data has been changed.");
  return pointer.encoding === "gzip" ? object.body.pipeThrough(new DecompressionStream("gzip")) : object.body;
}

export async function GET(request: Request) {
  try {
    const identity = await resolveRequestIdentity(request);
    if (!identity) return Response.json({ error: "Sign in to Planogram Studio first, then return here." }, { status: 401, headers });
    const url = new URL(request.url), source = url.searchParams.get("source") || "current";
    if (!["current", "legacy"].includes(source)) return Response.json({ error: "Unknown saved copy" }, { status: 400, headers });
    if (source === "legacy" && identity.email !== OWNER_EMAIL)
      return Response.json({ error: "Owner access required" }, { status: 403, headers });
    const row = source === "legacy"
      ? await env.DB.prepare("SELECT data, updated_at FROM planogram_state WHERE id = ?").bind(1).first<Saved>()
      : await env.DB.prepare("SELECT data, updated_at FROM user_workspace_state WHERE user_key = ?").bind(identity.userKey).first<Saved>();
    if (!row) return Response.json({ error: "No saved copy is recorded for this source." }, { status: 404, headers });
    const expectedRevision = url.searchParams.get("revision");
    if (expectedRevision && expectedRevision !== String(row.updated_at))
      return Response.json({ error: "This saved copy changed. Refresh the recovery list before downloading." }, { status: 409, headers });
    const download = url.searchParams.get("download");
    if (download === "workspace") {
      return new Response(await openSaved(row.data), { headers: {
        ...headers, "content-type": "application/json",
        "content-disposition": `attachment; filename="planogram-workspace-${source}-${row.updated_at}.json"`,
      } });
    }
    const plans = await inspectWorkspace(await openSaved(row.data));
    if (download) {
      const rawIndex = url.searchParams.get("index"), index = Number(rawIndex);
      if (rawIndex === null || !Number.isInteger(index) || index < 0 || !plans[index])
        return Response.json({ error: "Choose a POG from the recovered list." }, { status: 400, headers });
      const plan = plans[index];
      const library = download === "library";
      if (download !== "pog" && !library) return Response.json({ error: "Unknown download" }, { status: 400, headers });
      const start = library ? plan.productsStart : plan.start, end = library ? plan.productsEnd : plan.end;
      if (start === undefined || end === undefined) return Response.json({ error: "This POG has no product library." }, { status: 404, headers });
      const filename = plan.title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 90) || "POG";
      return new Response(sliceWorkspace(await openSaved(row.data), start, end,
        library ? '{"products":' : '{"format":"planogram-studio-pogx","planogram":', "}"), {
        headers: { ...headers, "content-type": "application/json", "content-disposition": `attachment; filename="${filename}${library ? '-image-library.json' : '.pogx'}"` },
      });
    }
    return Response.json({ source, revision: row.updated_at, isOwner: identity.email === OWNER_EMAIL,
      plans: plans.map(({ id, title, productCount, imageCount }, index) => ({ index, id, title, productCount, imageCount })),
    }, { headers });
  } catch (error) {
    console.error("recovery_read_failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Unable to read this saved copy. No data has been changed. Try downloading the full copy instead." }, { status: 503, headers });
  }
}
