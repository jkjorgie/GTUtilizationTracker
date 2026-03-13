import NextAuth, { type DefaultSession, CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { hashToken } from "./totp";

class RateLimitError extends CredentialsSignin {
  code = "rate_limited";
}

const RATE_LIMIT_MAX_ATTEMPTS = 10;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

async function checkRateLimit(email: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const attempts = await prisma.loginAttempt.count({
    where: { email, createdAt: { gte: windowStart } },
  });
  return attempts < RATE_LIMIT_MAX_ATTEMPTS;
}

async function recordFailedAttempt(email: string): Promise<void> {
  await prisma.loginAttempt.create({ data: { email } });
  // Prune old records for this email to keep the table tidy
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  await prisma.loginAttempt.deleteMany({
    where: { email, createdAt: { lt: windowStart } },
  });
}

async function clearFailedAttempts(email: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { email } });
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      role: UserRole;
      consultantId: string | null;
      requirePasswordReset: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    email: string;
    role: UserRole;
    consultantId: string | null;
    requirePasswordReset: boolean;
  }
}


export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        // Used by the MFA two-step flow: after TOTP is verified, a short-lived
        // bypass token is passed instead of email+password.
        mfaBypassToken: { label: "MFA Bypass Token", type: "text" },
      },
      async authorize(credentials) {
        // ── Path A: MFA bypass (post-TOTP completion) ─────────────────────────
        if (credentials?.mfaBypassToken) {
          const bypassHash = hashToken(credentials.mfaBypassToken as string);
          const record = await prisma.mfaPendingToken.findUnique({
            where: { tokenHash: bypassHash, verified: true },
            include: { user: { include: { consultant: true } } },
          });

          if (!record || record.expiresAt < new Date()) {
            return null;
          }

          // Consume bypass token (one-time use)
          await prisma.mfaPendingToken.delete({ where: { tokenHash: bypassHash } });

          const user = record.user;
          return {
            id: user.id,
            email: user.email,
            role: user.role,
            consultantId: user.consultantId,
            requirePasswordReset: user.requirePasswordReset,
            name: user.consultant?.name ?? user.email,
          };
        }

        // ── Path B: email + password fallback (defense-in-depth only) ──────────
        // The normal login flow uses loginStep1() → bypass token → Path A above.
        // Path B is kept as a fallback but blocks any user with TOTP enrolled,
        // preventing MFA bypass via direct credential submission.
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = (credentials.email as string).toLowerCase().trim();

        const allowed = await checkRateLimit(email);
        if (!allowed) {
          throw new RateLimitError();
        }

        const user = await prisma.user.findUnique({
          where: { email },
          include: { consultant: true, totpSecret: true },
        });

        if (!user) {
          await recordFailedAttempt(email);
          return null;
        }

        // Block direct email+password login for TOTP-enrolled users
        if (user.totpSecret?.isVerified) {
          return null;
        }

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!passwordMatch) {
          await recordFailedAttempt(email);
          return null;
        }

        await clearFailedAttempts(email);

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          consultantId: user.consultantId,
          requirePasswordReset: user.requirePasswordReset,
          name: user.consultant?.name ?? user.email,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.consultantId = user.consultantId;
        token.requirePasswordReset = user.requirePasswordReset;
      }
      // Re-fetch requirePasswordReset on session update so the flag clears
      // immediately after a forced reset without requiring re-login
      if (trigger === "update" && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { requirePasswordReset: true },
        });
        if (fresh) token.requirePasswordReset = fresh.requirePasswordReset;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.consultantId = token.consultantId as string | null;
        session.user.requirePasswordReset = token.requirePasswordReset as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
