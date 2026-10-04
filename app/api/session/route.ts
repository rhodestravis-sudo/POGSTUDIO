import {
  clearSessionCookie,
  createBetaSession,
  destroyBetaSession,
  isAllowedBetaEmail,
  isOwnerEmail,
  isValidAccessCode,
  resolveRequestIdentity,
  sessionCookie,
} from "@/app/lib/app-auth";

const cleanEmail = (value: unknown) => String(value ?? "").trim().toLowerCase();
const noStoreHeaders = { "cache-control": "no-store" };

const publicUser = (identity: Awaited<ReturnType<typeof resolveRequestIdentity>>) =>
  identity
    ? {
        authenticated: true,
        email: identity.email,
        displayName: identity.displayName,
        isOwner: isOwnerEmail(identity.email),
        provider: identity.provider,
      }
    : { authenticated: false };

export async function GET(request: Request) {
  const identity = await resolveRequestIdentity(request);
  return Response.json(publicUser(identity), { headers: noStoreHeaders });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: unknown;
      accessCode?: unknown;
    };
    const email = cleanEmail(body.email),
      accessCode = String(body.accessCode ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return Response.json(
        { error: "Enter a valid email." },
        { status: 400, headers: noStoreHeaders },
      );
    if (!isAllowedBetaEmail(email) || !isValidAccessCode(accessCode))
      return Response.json(
        { error: "That email or access code is not approved for this beta." },
        { status: 403, headers: noStoreHeaders },
      );
    const session = await createBetaSession(email),
      identity = await resolveRequestIdentity(
        new Request(request.url, {
          headers: { cookie: sessionCookie(session.token, session.expiresAt) },
        }),
      );
    return Response.json(publicUser(identity), {
      headers: {
        ...noStoreHeaders,
        "set-cookie": sessionCookie(session.token, session.expiresAt),
      },
    });
  } catch {
    return Response.json(
      { error: "Unable to sign in right now." },
      { status: 500, headers: noStoreHeaders },
    );
  }
}

export async function DELETE(request: Request) {
  await destroyBetaSession(request).catch(() => {});
  return Response.json(
    { authenticated: false },
    { headers: { ...noStoreHeaders, "set-cookie": clearSessionCookie() } },
  );
}
