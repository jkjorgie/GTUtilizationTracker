"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldAlert } from "lucide-react";
import {
  beginTotpEnrollmentFromPending,
  completeTotpEnrollmentFromPending,
} from "@/app/actions/totp";

export default function SetupMfaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [initError, setInitError] = useState("");

  useEffect(() => {
    beginTotpEnrollmentFromPending()
      .then(({ qrCode, secret }) => {
        setQrCode(qrCode);
        setSecret(secret);
      })
      .catch((err) => {
        setInitError(err instanceof Error ? err.message : "Failed to start setup. Please log in again.");
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const bypassToken = await completeTotpEnrollmentFromPending(code.trim(), rememberDevice);

      const result = await signIn("credentials", {
        mfaBypassToken: bypassToken,
        redirect: false,
      });

      if (result?.error) {
        setError("Sign in failed. Please try logging in again.");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
              {initError}
            </div>
            <Button className="w-full mt-4" onClick={() => router.push("/login")}>
              Back to sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <ShieldAlert className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Set Up Two-Factor Authentication</CardTitle>
          <CardDescription>
            Two-factor authentication is required to access this application. Scan the QR code
            with an authenticator app (e.g. Google Authenticator, Authy), then enter the
            6-digit code to confirm.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!qrCode ? (
            <div className="flex justify-center py-8 text-muted-foreground text-sm">
              Loading setup…
            </div>
          ) : (
            <>
              <div className="flex justify-center">
                <img src={qrCode} alt="TOTP QR code" className="rounded border" />
              </div>

              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  Can&apos;t scan? Enter this code manually:
                </p>
                <code className="text-sm font-mono bg-muted px-2 py-1 rounded select-all">
                  {secret}
                </code>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-md">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="code">Verification Code</Label>
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
                  {loading ? "Verifying…" : "Confirm & Sign In"}
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
