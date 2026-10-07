import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

declare module "next-auth" {
  interface Session {
    user: { id: string; apiToken: string; emailConfirmed: boolean } & DefaultSession["user"];
  }
  interface User {
    apiToken: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    apiToken?: string;
    emailConfirmed?: boolean;
  }
}

export const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

/**
 * When the app is served from a sandboxed preview (an HTTPS host, inside a
 * cross-site iframe), browsers refuse to store `SameSite=Lax` cookies. The
 * session and CSRF cookies then silently vanish and sign-in fails with
 * MissingCSRF. In that case we need `SameSite=None; Secure` instead.
 */
const iframeSafeCookies = process.env.IFRAME_SAFE_COOKIES === "true";

// The `__Secure-` / `__Host-` prefixes are only valid on secure origins — a
// browser drops the cookie outright if `Secure` is missing. So the names and
// the options have to change together.
const cookieOptions = iframeSafeCookies
  ? {
      sameSite: "none" as const,
      secure: true,
      path: "/",
      // CHIPS. A sandboxed preview is a third-party context, and browsers are
      // phasing out unrestricted third-party cookies. `Partitioned` scopes the
      // cookie to the top-level site so it survives anyway.
      partitioned: true,
    }
  : { sameSite: "lax" as const, path: "/" };

const cookies = {
  sessionToken: {
    name: iframeSafeCookies ? "__Secure-authjs.session-token" : "authjs.session-token",
    options: cookieOptions,
  },
  csrfToken: {
    name: iframeSafeCookies ? "__Host-authjs.csrf-token" : "authjs.csrf-token",
    options: cookieOptions,
  },
  callbackUrl: { name: "authjs.callback-url", options: cookieOptions },
  pkceCodeVerifier: { name: "authjs.pkce.code_verifier", options: cookieOptions },
  state: { name: "authjs.state", options: cookieOptions },
  nonce: { name: "authjs.nonce", options: cookieOptions },
};

/** Lists every way a user may be created: password or Google. */
const providers = [
  Credentials({
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = String(credentials?.email ?? "").trim().toLowerCase();
      const password = String(credentials?.password ?? "");
      if (!email || !password) return null;

      const user = await prisma.user.findUnique({ where: { email } });
      // Always run a comparison so a missing user and a wrong password
      // take a similar amount of time.
      const hash = user?.passwordHash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin";
      const ok = await bcrypt.compare(password, hash);
      if (!user || !user.passwordHash || !ok) return null;

      return { id: user.id, email: user.email, name: user.name, image: user.image, apiToken: user.apiToken };
    },
  }),
  ...(googleEnabled
    ? [
        Google({
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          allowDangerousEmailAccountLinking: true,
        }),
      ]
    : []),
];

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  // Behind the preview proxy the request arrives over plain HTTP on an unknown
  // host, so Auth.js cannot infer the protocol or origin by itself.
  trustHost: true,
  useSecureCookies: iframeSafeCookies,
  cookies,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.apiToken = user.apiToken;
        token.emailConfirmed = Boolean((user as { emailVerified?: Date | null }).emailVerified);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.user.apiToken = token.apiToken ?? "";
        // The client needs this to nudge someone to confirm their address. An
        // unconfirmed account still works, but a typo'd address means password
        // resets go somewhere they cannot read — permanently locked out.
        session.user.emailConfirmed = Boolean(token.emailConfirmed);
      }
      return session;
    },
  },
  events: {
    // Google sign-ins create the account on first login; password sign-ups
    // are handled by our own register endpoint.
    async signIn({ user }) {
      if (!user?.id) return;
      await prisma.user.upsert({
        where: { email: user.email! },
        update: { name: user.name ?? undefined, image: user.image ?? undefined },
        create: {
          email: user.email!,
          name: user.name,
          image: user.image,
          apiToken: randomBytes(24).toString("hex"),
        },
      });
    },
  },
});

/** Throws if there is no signed-in user. Use inside route handlers. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new AuthError("You must be signed in.", 401);
  return session.user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/** Accepts either a web session cookie or an extension bearer token. */
export async function requireUserOrToken(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  if (header.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim();
    if (token) {
      const user = await prisma.user.findUnique({ where: { apiToken: token } });
      if (user) return user;
      throw new AuthError("Invalid API token.", 401);
    }
  }
  const session = await auth();
  if (!session?.user?.id) throw new AuthError("You must be signed in.", 401);
  return prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
}
