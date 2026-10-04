import { env } from "cloudflare:workers";

export const OWNER_EMAIL = "rhodes.travis@gmail.com";

const SESSION_COOKIE = "planogram_session";
const DEFAULT_ALLOWED_EMAILS = [
  OWNER_EMAIL,
  "rabstein@utzsnacks.com",
  "russ.abstein@catmananalytics.com",
];
const DEFAULT_ALLOWED_DOMAINS: string[] = [];
const DAY_MS = 24 * 60 * 60 * 1000;

export type RequestIdentity = {
  userKey: string;
  email: string;
  displayName: string;
  provider: "chatgpt" | "beta";
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const envValue = (key: string) =>
  typeof (env as Record<string, unknown>)[key] === "string"
    ? String((env as Record<string, unknown>)[key])
    : "";

const splitList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const getAllowedEmails = () => {
  const configured = splitList(envValue("BETA_ALLOWED_EMAILS"));
  return configured.length ? configured : DEFAULT_ALLOWED_EMAILS;
};

const getAllowedDomains = () => {
  const configured = splitList(envValue("BETA_ALLOWED_DOMAINS"));
  return configured.length ? configured : DEFAULT_ALLOWED_DOMAINS;
};

export const ownerWorkspaceKey = () =>
  envValue("OWNER_WORKSPACE_KEY") || "";

export const appUserKeyForEmail = (email: string) => {
  const normalized = normalizeEmail(email);
  return normalized === OWNER_EMAIL && ownerWorkspaceKey()
    ? ownerWorkspaceKey()
    : `app:${normalized}`;
};

export const isOwnerEmail = (email: string) => normalizeEmail(email) === OWNER_EMAIL;

export const isAllowedBetaEmail = (email: string) => {
  const normalized = normalizeEmail(email),
    domain = normalized.split("@")[1] || "";
  return (
    getAllowedEmails().includes(normalized) ||
    getAllowedDomains().includes(domain)
  );
};

export const isValidAccessCode = (value: string) => {
  const expected = envValue("BETA_ACCESS_CODE");
  return Boolean(expected) && value.trim() === expected;
};

const parseCookie = (request: Request, name: string) => {
  const cookies = request.headers.get("cookie") || "";
  for (const part of cookies.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) return decodeURIComponent(rawValue.join("="));
  }
  return "";
};

const randomToken = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const hexDigest = async (value: string) => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const sessionCookie = (token: string, expiresAt: number) => {
  const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
};

export const clearSessionCookie = () =>
  `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;

export async function createBetaSession(email: string) {
  const normalized = normalizeEmail(email),
    token = randomToken(),
    tokenHash = await hexDigest(token),
    now = Date.now(),
    expiresAt = now + 30 * DAY_MS;
  await env.DB.prepare(
    `INSERT INTO app_session
      (token_hash, email, display_name, created_at, last_seen_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).bind(
    tokenHash,
    normalized,
    normalized,
    now,
    now,
    expiresAt,
  ).run();
  return { token, expiresAt };
}

export async function destroyBetaSession(request: Request) {
  const token = parseCookie(request, SESSION_COOKIE);
  if (!token) return;
  const tokenHash = await hexDigest(token);
  await env.DB.prepare("DELETE FROM app_session WHERE token_hash = ?")
    .bind(tokenHash)
    .run();
}

function chatGPTIdentity(request: Request): RequestIdentity | null {
  const userKey = request.headers.get("oai-authenticated-user-id") || "",
    email = normalizeEmail(request.headers.get("oai-authenticated-user-email") || "");
  if (!userKey || !email) return null;
  return {
    userKey,
    email,
    displayName: request.headers.get("oai-authenticated-user-full-name") || email,
    provider: "chatgpt",
  };
}

export async function resolveRequestIdentity(
  request: Request,
): Promise<RequestIdentity | null> {
  const chatGPT = chatGPTIdentity(request);
  if (chatGPT) return chatGPT;
  const token = parseCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await hexDigest(token),
    now = Date.now(),
    session = await env.DB.prepare(
      `SELECT email, display_name displayName, expires_at expiresAt
       FROM app_session WHERE token_hash = ? LIMIT 1`,
    ).bind(tokenHash).first<{
      email: string;
      displayName: string | null;
      expiresAt: number;
    }>();
  if (!session || session.expiresAt <= now) {
    if (session)
      await env.DB.prepare("DELETE FROM app_session WHERE token_hash = ?")
        .bind(tokenHash)
        .run()
        .catch(() => {});
    return null;
  }
  await env.DB.prepare(
    "UPDATE app_session SET last_seen_at = ? WHERE token_hash = ?",
  ).bind(now, tokenHash).run().catch(() => {});
  return {
    userKey: appUserKeyForEmail(session.email),
    email: normalizeEmail(session.email),
    displayName: session.displayName || session.email,
    provider: "beta",
  };
}
