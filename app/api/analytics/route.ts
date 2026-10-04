import { env } from "cloudflare:workers";
import { OWNER_EMAIL, recordBetaEvent } from "@/app/lib/analytics";
import { resolveRequestIdentity } from "@/app/lib/app-auth";

const clean = (value: unknown, fallback = "unknown") =>
  String(value ?? fallback).replace(/[^a-zA-Z0-9 _./:-]/g, "").slice(0, 120) || fallback;

export async function POST(request: Request) {
  const identity = await resolveRequestIdentity(request);
  if (!identity?.userKey || !identity.email)
    return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    await recordBetaEvent(request, {
      eventType: clean(body.eventType),
      action: clean(body.action),
      outcome: clean(body.outcome, "success"),
      details: body.details && typeof body.details === "object" ? body.details : undefined,
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Unable to record activity" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const identity = await resolveRequestIdentity(request),
    email = identity?.email || "";
  if (email !== OWNER_EMAIL)
    return Response.json({ error: "Owner access required" }, { status: 403 });
  const url = new URL(request.url),
    days = Math.min(90, Math.max(7, Number(url.searchParams.get("days")) || 30)),
    audience = ["all", "owner", "testers"].includes(url.searchParams.get("audience") || "")
      ? (url.searchParams.get("audience") as "all" | "owner" | "testers")
      : "testers",
    since = Date.now() - days * 24 * 60 * 60 * 1000,
    scope = audience === "owner"
      ? " AND lower(user_email) = lower(?)"
      : audience === "testers"
        ? " AND lower(user_email) != lower(?)"
        : "",
    bind = <T extends { bind: (...values: unknown[]) => T }>(statement: T) =>
      audience === "all" ? statement.bind(since) : statement.bind(since, OWNER_EMAIL);
  try {
    const [summary, users, friction, recentErrors, journey] = await Promise.all([
      bind(env.DB.prepare(`SELECT
        SUM(CASE WHEN event_type IN ('action','search','export') THEN 1 ELSE 0 END) actions,
        COUNT(DISTINCT user_key) testers,
        SUM(CASE WHEN event_type = 'session' THEN 1 ELSE 0 END) sessions,
        SUM(CASE WHEN outcome = 'error' THEN 1 ELSE 0 END) errors,
        SUM(CASE WHEN event_type = 'save' AND outcome = 'success' THEN 1 ELSE 0 END) saves
        FROM beta_event WHERE created_at >= ?${scope}`)).first(),
      env.DB.prepare(`SELECT user_email email, COUNT(*) events,
        SUM(CASE WHEN event_type = 'session' THEN 1 ELSE 0 END) sessions,
        SUM(CASE WHEN event_type IN ('action','search','export') THEN 1 ELSE 0 END) actions,
        SUM(CASE WHEN outcome = 'error' THEN 1 ELSE 0 END) errors,
        MAX(created_at) last_seen,
        CASE WHEN lower(user_email) = lower(?) THEN 'Owner' ELSE 'Tester' END role
        FROM beta_event WHERE created_at >= ?${scope} GROUP BY user_key, user_email
        ORDER BY last_seen DESC LIMIT 50`).bind(
          OWNER_EMAIL,
          since,
          ...(audience === "all" ? [] : [OWNER_EMAIL]),
        ).all(),
      env.DB.prepare(`SELECT action, event_type, outcome, COUNT(*) count,
        COUNT(DISTINCT user_key) testers
        FROM beta_event WHERE created_at >= ? AND
        outcome IN ('error','friction')${scope}
        GROUP BY action, event_type, outcome ORDER BY count DESC LIMIT 30`).bind(
          since,
          ...(audience === "all" ? [] : [OWNER_EMAIL]),
        ).all(),
      env.DB.prepare(`SELECT action, COUNT(*) count, COUNT(DISTINCT user_key) testers,
        MAX(created_at) last_seen, MAX(details) details
        FROM beta_event WHERE created_at >= ? AND outcome = 'error'${scope}
        GROUP BY action ORDER BY count DESC, last_seen DESC LIMIT 30`).bind(
          since,
          ...(audience === "all" ? [] : [OWNER_EMAIL]),
        ).all(),
      env.DB.prepare(`SELECT stage, COUNT(*) events, COUNT(DISTINCT user_key) testers FROM (
        SELECT user_key, 'Opened' stage FROM beta_event WHERE created_at >= ? AND event_type = 'session'${scope}
        UNION ALL SELECT user_key, 'Started work' FROM beta_event WHERE created_at >= ? AND
          (action IN ('Import','Open PSA','New planogram','Add product','Add section') OR action LIKE 'ribbon_%')${scope}
        UNION ALL SELECT user_key, 'Edited' FROM beta_event WHERE created_at >= ? AND event_type = 'action'${scope}
        UNION ALL SELECT user_key, 'Saved' FROM beta_event WHERE created_at >= ? AND event_type = 'save' AND outcome = 'success'${scope}
        UNION ALL SELECT user_key, 'Exported' FROM beta_event WHERE created_at >= ? AND event_type = 'export'${scope}
      ) GROUP BY stage`).bind(
          ...Array.from({ length: 5 }).flatMap(() => audience === "all" ? [since] : [since, OWNER_EMAIL]),
        ).all(),
    ]);
    return Response.json({
      isOwner: true,
      days,
      audience,
      summary: summary || { actions: 0, testers: 0, sessions: 0, errors: 0, saves: 0 },
      users: users.results,
      friction: friction.results,
      recentErrors: recentErrors.results,
      journey: journey.results,
    });
  } catch {
    return Response.json({ error: "Analytics are temporarily unavailable" }, { status: 500 });
  }
}
