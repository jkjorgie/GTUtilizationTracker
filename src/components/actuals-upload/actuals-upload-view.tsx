"use client";

import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import {
  processActualsUpload,
  type UploadResult,
  type UnmatchedEntry,
} from "@/app/actions/actuals-upload";
import { format, parseISO } from "date-fns";

export function ActualsUploadView() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    if (
      f.type ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      f.name.endsWith(".xlsx")
    ) {
      setFile(f);
      setResult(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleProcess = useCallback(async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await processActualsUpload(formData);
      setResult(res);
      if (res.unmatched.length > 0) {
        setExpandedCodes(new Set(res.unmatched.map((u) => u.projectCode)));
      }
    } catch (err) {
      setResult({
        success: false,
        weekStart: "",
        dateRange: "",
        processed: { count: 0, totalHours: 0 },
        unmatched: [],
        errors: [err instanceof Error ? err.message : "Upload failed"],
      });
    } finally {
      setIsProcessing(false);
    }
  }, [file]);

  const toggleCode = useCallback((code: string) => {
    setExpandedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  const clearFile = useCallback(() => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Spreadsheet</CardTitle>
          <CardDescription>
            Upload a PM Report (.xlsx) to import actual hours. The date range
            and column layout are auto-detected from the file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="h-8 w-8 text-green-600" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFile();
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drag and drop an .xlsx file here, or click to browse
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleProcess}
              disabled={!file || isProcessing}
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Process File
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Errors */}
          {!result.success && result.errors.length > 0 && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-5 w-5" />
                  Processing Failed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {result.errors.map((err, i) => (
                    <li key={i} className="text-sm text-destructive">
                      {err}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Success Summary */}
          {result.success && (
            <Card className="border-green-200 dark:border-green-900/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Upload Complete
                </CardTitle>
                <CardDescription>
                  Week of{" "}
                  {format(parseISO(result.weekStart), "MMM d, yyyy")} (
                  {result.dateRange})
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Allocations Saved
                    </p>
                    <p className="text-2xl font-bold">
                      {result.processed.count}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Total Hours
                    </p>
                    <p className="text-2xl font-bold">
                      {result.processed.totalHours.toLocaleString("en-US", {
                        maximumFractionDigits: 1,
                      })}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Unmatched Groups
                    </p>
                    <p className="text-2xl font-bold">
                      {result.unmatched.length}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Errors</p>
                    <p className="text-2xl font-bold">
                      {result.errors.length}
                    </p>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
                    <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">
                      Save Errors:
                    </p>
                    <ul className="space-y-0.5">
                      {result.errors.map((err, i) => (
                        <li
                          key={i}
                          className="text-sm text-red-600 dark:text-red-400"
                        >
                          {err}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Unmatched Report */}
          {result.success && result.unmatched.length > 0 && (
            <Card className="border-yellow-200 dark:border-yellow-900/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  Unmatched Data
                </CardTitle>
                <CardDescription>
                  The following entries could not be matched to a project code
                  and/or consultant in the system. Hours are aggregated per
                  employee per project.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.unmatched.map((group) => (
                    <UnmatchedGroup
                      key={group.projectCode}
                      group={group}
                      expanded={expandedCodes.has(group.projectCode)}
                      onToggle={() => toggleCode(group.projectCode)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function UnmatchedGroup({
  group,
  expanded,
  onToggle,
}: {
  group: UnmatchedEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const totalHours = group.entries.reduce((sum, e) => sum + e.totalHours, 0);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
        <span className="font-mono font-medium text-sm">
          {group.projectCode}
        </span>
        {!group.projectFound && (
          <Badge
            variant="secondary"
            className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
          >
            Unknown Project
          </Badge>
        )}
        <span className="ml-auto text-sm text-muted-foreground">
          {group.entries.length} employee{group.entries.length !== 1 ? "s" : ""}
          {" · "}
          {totalHours.toLocaleString("en-US", { maximumFractionDigits: 1 })}{" "}
          hrs
        </span>
      </button>

      {expanded && (
        <div className="border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.entries.map((entry) => (
                <TableRow key={entry.employee}>
                  <TableCell className="font-medium">
                    {entry.employee}
                  </TableCell>
                  <TableCell>
                    {!group.projectFound && !entry.employeeFound ? (
                      <Badge
                        variant="secondary"
                        className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
                      >
                        Unknown Project & Employee
                      </Badge>
                    ) : !group.projectFound ? (
                      <Badge
                        variant="secondary"
                        className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
                      >
                        Unknown Project
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200"
                      >
                        Unknown Employee
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {entry.totalHours.toLocaleString("en-US", {
                      maximumFractionDigits: 1,
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
