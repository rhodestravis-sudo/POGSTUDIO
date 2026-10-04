import { env } from "cloudflare:workers";
import { resolveRequestIdentity } from "@/app/lib/app-auth";

const imageExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/avif": "avif",
};
const extensionTypes: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
};

export async function POST(request: Request) {
  try {
    const identity = await resolveRequestIdentity(request);
    if (!identity)
      return Response.json({ error: "Sign in required" }, { status: 401 });
    const form = await request.formData();
    const file = form.get("file");
    const productId = String(form.get("productId") || "product").replace(
      /[^a-zA-Z0-9_-]/g,
      "",
    );
    if (!(file instanceof File))
      return Response.json({ error: "Choose a photo first." }, { status: 400 });
    if (file.size > 20_000_000)
      return Response.json(
        { error: "Photo must be under 20 MB." },
        { status: 400 },
      );
    const fileExtension = file.name.split(".").pop()?.toLowerCase() || "";
    const contentType =
      file.type.toLowerCase() || extensionTypes[fileExtension] || "";
    const ext = imageExtensions[contentType];
    if (!ext)
      return Response.json(
        { error: "That photo format is not supported." },
        { status: 400 },
      );
    const key = `products/${productId}-${Date.now()}.${ext}`;
    await env.BUCKET.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType },
    });
    return Response.json({ url: `/api/images?key=${encodeURIComponent(key)}` });
  } catch {
    return Response.json(
      { error: "Unable to upload photo. Please try again." },
      { status: 500 },
    );
  }
}
export async function GET(request: Request) {
  const identity = await resolveRequestIdentity(request);
  if (!identity) return new Response("Sign in required", { status: 401 });
  const key = new URL(request.url).searchParams.get("key");
  if (!key) return new Response("Missing key", { status: 400 });
  const object = await env.BUCKET.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "content-type":
        object.httpMetadata?.contentType || "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
