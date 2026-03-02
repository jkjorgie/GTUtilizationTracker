"use client";

import { useState } from "react";
import { upsertSystemSetting } from "@/app/actions/system-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface SettingsFormProps {
  settings: Record<string, string>;
}

export function SettingsForm({ settings }: SettingsFormProps) {
  const [anchorDate, setAnchorDate] = useState(
    settings["BILLING_PERIOD_ANCHOR"] ?? "2025-01-05"
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await upsertSystemSetting("BILLING_PERIOD_ANCHOR", anchorDate);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing Periods</CardTitle>
        <CardDescription>
          Set the anchor date used to compute all bi-weekly billing periods. All invoice periods
          are calculated as 14-day windows starting from this date.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="anchorDate">Billing Period Anchor Date</Label>
          <Input
            id="anchorDate"
            type="date"
            value={anchorDate}
            onChange={(e) => setAnchorDate(e.target.value)}
            className="w-48"
          />
          <p className="text-sm text-muted-foreground">
            Example: if set to 2025-01-05, billing periods will be Jan 5–18, Jan 19 – Feb 1, etc.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
