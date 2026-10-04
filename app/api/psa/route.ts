import { env } from "cloudflare:workers";
import { resolveRequestIdentity } from "@/app/lib/app-auth";

const safeId = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "");

export async function POST(request: Request) {
  try {
    const identity = await resolveRequestIdentity(request);
    if (!identity)
      return Response.json({ error: "Sign in required" }, { status: 401 });
    const body = (await request.json()) as {
      planogramId?: string;
      sourceText?: string;
      sourcePsaKey?: string;
    };
    if (!body.planogramId || !body.sourceText)
      return Response.json({ error: "PSA source is required" }, { status: 400 });
    const key = body.sourcePsaKey?.startsWith("psa/")
      ? body.sourcePsaKey
      : `psa/${safeId(body.planogramId)}-${Date.now()}.psa`;
    await env.BUCKET.put(key, body.sourceText, {
      httpMetadata: { contentType: "text/plain; charset=utf-8" },
    });
    return Response.json({ key });
  } catch {
    return Response.json({ error: "Unable to retain PSA source" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const identity = await resolveRequestIdentity(request);
  if (!identity) return new Response("Sign in required", { status: 401 });
  const key = new URL(request.url).searchParams.get("key");
  if (!key?.startsWith("psa/")) return new Response("Invalid key", { status: 400 });
  const object = await env.BUCKET.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "private, max-age=300",
    },
  });
}
