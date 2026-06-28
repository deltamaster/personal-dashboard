import NextAuth from "next-auth";
import { MicrosoftConsumerProvider } from "@/lib/auth/microsoft-consumer-provider";

const ALLOWED_EMAIL = (
  process.env.ALLOWED_USER_EMAIL ?? "huhansen318@hotmail.com"
).toLowerCase();

function isBuildTime(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

function getOAuthCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.AUTH_MICROSOFT_ENTRA_ID_ID;
  const clientSecret = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;
  if (clientId && clientSecret) {
    return { clientId, clientSecret };
  }
  if (isBuildTime()) {
    return {
      clientId: "build-placeholder",
      clientSecret: "build-placeholder",
    };
  }
  throw new Error(
    "Missing AUTH_MICROSOFT_ENTRA_ID_ID or AUTH_MICROSOFT_ENTRA_ID_SECRET in environment"
  );
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string" || !value.includes("@")) return null;
  return value.trim().toLowerCase();
}

function extractEmail(input: {
  user?: { email?: string | null };
  profile?: Record<string, unknown> | null;
}): string | null {
  for (const candidate of [
    input.user?.email,
    input.profile?.email,
    input.profile?.preferred_username,
    input.profile?.mail,
    input.profile?.upn,
  ]) {
    const email = normalizeEmail(candidate);
    if (email) return email;
  }
  return null;
}

const { clientId, clientSecret } = getOAuthCredentials();

const useSecureCookies = process.env.AUTH_URL?.startsWith("https://") ?? false;

/** OAuth redirect cookies — SameSite=None helps embedded browsers (e.g. Cursor Simple Browser). */
const oauthFlowCookieOptions = useSecureCookies
  ? ({
      httpOnly: true,
      sameSite: "none" as const,
      path: "/",
      secure: true,
      maxAge: 60 * 15,
    } as const)
  : undefined;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  debug: process.env.AUTH_DEBUG === "true",
  logger: {
    error(code, ...message) {
      console.error(`[auth][${code}]`, ...message);
    },
    warn(code, ...message) {
      console.warn(`[auth][${code}]`, ...message);
    },
  },
  providers: [
    MicrosoftConsumerProvider({ clientId, clientSecret, loginHint: ALLOWED_EMAIL }),
  ],
  ...(oauthFlowCookieOptions
    ? {
        cookies: {
          pkceCodeVerifier: { options: oauthFlowCookieOptions },
          state: { options: oauthFlowCookieOptions },
          csrfToken: {
            options: { ...oauthFlowCookieOptions, maxAge: 60 * 60 },
          },
        },
      }
    : {}),
  callbacks: {
    async signIn({ user, profile }) {
      const email = extractEmail({
        user,
        profile: profile as Record<string, unknown> | null,
      });

      const allowed = !!email && email === ALLOWED_EMAIL;
      if (!allowed) {
        console.warn("[auth] signIn rejected:", {
          email,
          allowedEmail: ALLOWED_EMAIL,
          profileKeys: profile ? Object.keys(profile) : [],
        });
      }

      return allowed;
    },
    async jwt({ token, user, profile }) {
      const email =
        extractEmail({
          user,
          profile: profile as Record<string, unknown> | null,
        }) ?? normalizeEmail(token.email);

      if (email) token.email = email;
      if (user?.name) token.name = user.name;
      else if (profile?.name) token.name = profile.name as string;

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin/",
    error: "/auth/error/",
  },
});
