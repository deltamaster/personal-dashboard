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

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [MicrosoftConsumerProvider({ clientId, clientSecret })],
  callbacks: {
    async signIn({ user, profile }) {
      const email = extractEmail({
        user,
        profile: profile as Record<string, unknown> | null,
      });

      if (process.env.NODE_ENV === "development") {
        console.log("[auth] signIn:", { email, allowed: ALLOWED_EMAIL });
      }

      return !!email && email === ALLOWED_EMAIL;
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
