"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import {
  beginTotpEnrollment,
  confirmTotpEnrollment,
  removeTotpEnrollment,
} from "@/app/actions/totp";

interface TotpSectionProps {
  isEnrolled: boolean;
}

type Step = "idle" | "qr" | "confirm" | "remove";

export function TotpSection({ isEnrolled }: TotpSectionProps) {
  const [step, setStep] = useState<Step>("idle");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enrolled, setEnrolled] = useState(isEnrolled);

  const handleBeginEnrollment = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await beginTotpEnrollment();
      setQrCode(result.qrCode);
      setSecret(result.secret);
      setStep("qr");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start enrollment");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmEnrollment = async () => {
    setError(null);
    setLoading(true);
    try {
      await confirmTotpEnrollment(code);
      setEnrolled(true);
      setStep("idle");
      setCode("");
      setQrCode(null);
      setSecret(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setError(null);
    setLoading(true);
    try {
      await removeTotpEnrollment(code);
      setEnrolled(false);
      setStep("idle");
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep("idle");
    setCode("");
    setQrCode(null);
    setSecret(null);
    setError(null);
  };

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Protect your account with an authenticator app (Google Authenticator, Authy, 1Password, etc.)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === "idle" && (
          <div className="flex items-center gap-4">
            {enrolled ? (
              <>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 border-0">
                  <ShieldCheck className="h-3 w-3 mr-1" />
                  Enabled
                </Badge>
                <Button variant="outline" size="sm" onClick={() => { setStep("remove"); setError(null); setCode(""); }}>
                  <ShieldOff className="h-4 w-4 mr-2" />
                  Disable 2FA
                </Button>
              </>
            ) : (
              <>
                <Badge variant="outline" className="text-muted-foreground">
                  Not enabled
                </Badge>
                <Button variant="outline" size="sm" onClick={handleBeginEnrollment} disabled={loading}>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  {loading ? "Loading..." : "Set Up 2FA"}
                </Button>
              </>
            )}
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>
        )}

        {step === "qr" && qrCode && (
          <div className="space-y-4 max-w-sm">
            <p className="text-sm text-muted-foreground">
              Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="TOTP QR Code" className="rounded border" width={200} height={200} />
            {secret && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Can&apos;t scan? Enter this code manually:
                </p>
                <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all">{secret}</code>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirmation Code</label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="font-mono tracking-widest text-center"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={handleConfirmEnrollment} disabled={loading || code.length !== 6}>
                {loading ? "Verifying..." : "Confirm"}
              </Button>
              <Button variant="outline" onClick={reset}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Remove 2FA confirmation dialog */}
      <AlertDialog open={step === "remove"} onOpenChange={(open) => !open && reset()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Two-Factor Authentication</AlertDialogTitle>
            <AlertDialogDescription>
              Enter your current authenticator code to confirm you want to disable 2FA.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="font-mono tracking-widest text-center"
              autoFocus
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={reset}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={loading || code.length !== 6}
            >
              {loading ? "Disabling..." : "Disable 2FA"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
