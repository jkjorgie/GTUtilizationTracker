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
  const [trainingTimecodes, setTrainingTimecodes] = useState(
    settings["TRAINING_TIMECODES"] ?? ""
  );
  const [overheadTimecodes, setOverheadTimecodes] = useState(
    settings["OVERHEAD_TIMECODES"] ?? ""
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await upsertSystemSetting("BILLING_PERIOD_ANCHOR", anchorDate);
      await upsertSystemSetting("TRAINING_TIMECODES", trainingTimecodes);
      await upsertSystemSetting("OVERHEAD_TIMECODES", overheadTimecodes);
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cost Category Timecodes</CardTitle>
          <CardDescription>
            Configure which project timecodes are counted as training or overhead costs in dashboard reports. Enter timecodes separated by commas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="trainingTimecodes">Training Timecodes</Label>
            <Input
              id="trainingTimecodes"
              type="text"
              value={trainingTimecodes}
              onChange={(e) => setTrainingTimecodes(e.target.value)}
              placeholder="e.g. TRAIN-001, TRAIN-002"
            />
            <p className="text-sm text-muted-foreground">
              Hours allocated to these projects will appear in the Training Costs report tile.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="overheadTimecodes">Overhead Timecodes</Label>
            <Input
              id="overheadTimecodes"
              type="text"
              value={overheadTimecodes}
              onChange={(e) => setOverheadTimecodes(e.target.value)}
              placeholder="e.g. OH-001, ADMIN-001"
            />
            <p className="text-sm text-muted-foreground">
              Hours allocated to these projects will appear in the Overhead Costs report tile.
            </p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}
