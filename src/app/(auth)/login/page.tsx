"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loginStep1 } from "@/app/actions/login";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const justReset = searchParams.get("reset") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await loginStep1(email, password);

      if (result.status === "rate_limited") {
        setError("Too many failed login attempts. Please try again in 15 minutes.");
        return;
      }

      if (result.status === "invalid") {
        setError("Invalid email or password");
        return;
      }

      if (result.status === "mfa_required") {
        // Redirect to TOTP verify page; callbackUrl preserved in query param
        const params = new URLSearchParams();
        if (callbackUrl !== "/") params.set("callbackUrl", callbackUrl);
        router.push(`/login/verify?${params.toString()}`);
        return;
      }

      if (result.status === "mfa_setup_required") {
        // No TOTP enrolled — redirect to mandatory setup page
        const params = new URLSearchParams();
        if (callbackUrl !== "/") params.set("callbackUrl", callbackUrl);
        router.push(`/login/setup-mfa?${params.toString()}`);
        return;
      }

      // status === "ok" — credentials verified; complete sign-in via bypass token
      const signInResult = await signIn("credentials", {
        mfaBypassToken: result.bypassToken,
        redirect: false,
      });

      if (signInResult?.error) {
        setError("Sign in failed. Please try again.");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">GT Utilization Tracker</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {justReset && !error && (
              <div className="p-3 text-sm text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 rounded-md">
                Password updated successfully. Please sign in with your new password.
              </div>
            )}

            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !loading) handleSubmit(e as unknown as React.FormEvent); }}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !loading) handleSubmit(e as unknown as React.FormEvent); }}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
