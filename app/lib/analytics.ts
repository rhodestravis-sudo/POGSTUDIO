import { env } from "cloudflare:workers";
import { OWNER_EMAIL, resolveRequestIdentity } from "./app-auth";

export { OWNER_EMAIL };

export const requestIdentity = (request: Request) => ({
  userKey: request.headers.get("oai-authenticated-user-id") || "",
  email: (request.headers.get("oai-authenticated-user-email") || "").toLowerCase(),
});

export async function recordBetaEvent(
  request: Request,
  event: { eventType: string; action: string; outcome?: string; details?: unknown },
) {
  const identity = await resolveRequestIdentity(request),
    userKey = identity?.userKey || "",
    email = identity?.email || "";
  if (!userKey || !email || !env.DB) return;
  const details = event.details == null
    ? null
    : JSON.stringify(event.details).slice(0, 1000);
  await env.DB.prepare(
    `INSERT INTO beta_event
      (user_key, user_email, event_type, action, outcome, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    userKey,
    email,
    event.eventType.slice(0, 40),
    event.action.slice(0, 120),
    (event.outcome || "success").slice(0, 30),
    details,
    Date.now(),
  ).run();
}
