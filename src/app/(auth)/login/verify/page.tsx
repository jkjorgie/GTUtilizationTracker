"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { completeMfaVerification } from "@/app/actions/totp";
import { ShieldCheck } from "lucide-react";

export default function VerifyMfaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [code, setCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const bypassToken = await completeMfaVerification(code.trim(), rememberDevice);

      const result = await signIn("credentials", {
        mfaBypassToken: bypassToken,
        redirect: false,
      });

      if (result?.error) {
        setError("Verification failed. Please try logging in again.");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Two-Factor Authentication</CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="code">Authenticator Code</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => { if (e.key === "Enter" && code.length === 6 && !loading) handleSubmit(e as unknown as React.FormEvent); }}
                className="text-center text-xl tracking-widest font-mono"
                autoComplete="one-time-code"
                autoFocus
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={rememberDevice}
                onCheckedChange={(checked) => setRememberDevice(checked === true)}
              />
              <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                Remember this device for 30 days
              </Label>
            </div>

            <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
              {loading ? "Verifying..." : "Verify"}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="text-sm text-muted-foreground hover:underline"
              >
                Back to sign in
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
