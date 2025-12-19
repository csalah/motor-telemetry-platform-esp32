"use client";

import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { useDevice } from "@/context/DeviceContext";
import { useLatestMetrics } from "@/hooks/use-latest-metrics";
import { useMetricHistory } from "@/hooks/use-metric-history";
import { useEvents } from "@/hooks/use-events";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { HistorySparkline } from "@/components/charts/HistorySparkline";

function formatNumber(
  value: number | null | undefined,
  opts: { decimals?: number } = {}
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";

  const decimals = opts.decimals ?? 1;

  // if it's effectively an integer, skip decimals
  if (Math.abs(value - Math.round(value)) < 1e-6) {
    return String(Math.round(value));
  }

  return value.toFixed(decimals);
}

function isFlaggedEvent(ev: any): boolean {
  const flags = ev?.raw?.flags ?? {};
  const status = String(flags.status ?? "").toUpperCase();
  const dev = Number(ev?.raw?.deviation_pct ?? 0);

  return (
    status === "ALERT" ||
    !!flags.stall ||
    !!flags.encoder_fault ||
    !!flags.overshoot ||
    !!flags.sudden_drop ||
    dev > 30
  );
}


export default function OverviewPage() {
  const { selectedDevice, selectedDeviceId } = useDevice();

  const {
    data: latest,
    loading: latestLoading,
    error: latestError,
  } = useLatestMetrics(selectedDeviceId, 1000); // 1s poll

  const { data: history } = useMetricHistory(selectedDeviceId, 200, 5000); //up to 200 samples/ 5s poll

  const { data: events } = useEvents(selectedDeviceId, 5000, 200); //up to 200 recent events

  if (!selectedDeviceId) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Select a device to view the overview dashboard.
      </div>
    );
  }

  if (latestLoading && !latest) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Loading device overview…
      </div>
    );
  }

  if (latestError && !latest) {
    return (
      <div className="p-4 text-sm text-destructive">
        Error loading metrics: {latestError}
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        This device has no telemetry yet.
      </div>
    );
  }

  const {
    rpm,
    deviation_pct,
    sudden_drop,
    stall,
    overshoot,
    encoder_fault,
    timestamp,
  } = latest;

  const isAlert = stall || encoder_fault || sudden_drop || overshoot;
  const lastUpdate = new Date(timestamp).toLocaleTimeString();

  const samples = history ?? [];

  const allEvents = events ?? [];
  const flaggedEvents = allEvents.filter(isFlaggedEvent);
  const recentEvents = flaggedEvents.slice(0, 200);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {selectedDevice?.name ?? "Device"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Snapshot of live device status, performance and latest telemetry packets
        </p>
      </div>

      <Card className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 min-w-0">
          {isAlert ? (
            <AlertTriangle className="h-6 w-6 shrink-0 text-destructive" />
          ) : (
            <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
          )}

          <div className="flex flex-col min-w-0">
            <span
              className={`font-medium ${
                isAlert ? "text-destructive" : "text-green-600"
              }`}
            >
              {isAlert ? "Alert detected" : "No faults detected"}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              Last update: {lastUpdate}
            </span>
          </div>
        </div>

        <div className="hidden gap-2 md:flex">
          <Badge variant={rpm && rpm > 10 ? "default" : "outline"}>
            {rpm && rpm > 10 ? "Running" : "Stopped"}
          </Badge>
          <Badge
            variant={
              deviation_pct != null && deviation_pct > 30
                ? "destructive"
                : deviation_pct != null && deviation_pct > 15
                ? "secondary"
                : "outline"
            }
          >
            {deviation_pct != null
              ? `Speed error ${formatNumber(deviation_pct, { decimals: 1 })}%`
              : "No speed target"}
          </Badge>
          <Badge variant={stall || encoder_fault ? "destructive" : "outline"}>
            {stall || encoder_fault ? "Fault active" : "No critical faults"}
          </Badge>
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Latest motor telemetry
        </h2>
        <p className="text-xs text-muted-foreground">
          Showing the most recent 200 telemetry packets and newer packets appear
          at the bottom.
        </p>

        <Card className="overflow-hidden">
          {samples.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">
              No metrics recorded for this device yet.
            </div>
          ) : (
            <div className="max-h-[340px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-[140px]">Time</TableHead>
                    <TableHead>RPM</TableHead>
                    <TableHead>Target RPM</TableHead>
                    <TableHead>Speed error (%)</TableHead>
                    <TableHead>PWM</TableHead>
                    <TableHead>Duty (%)</TableHead>
                    <TableHead>Flags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {samples.map((row) => {
                    const t = new Date(row.timestamp);
                    const dev = row.deviation_pct ?? 0;
                    const flagsLabel =
                      row.stall ||
                      row.encoder_fault ||
                      row.sudden_drop ||
                      row.overshoot
                        ? [
                            row.stall && "STALL",
                            row.encoder_fault && "ENCODER",
                            row.sudden_drop && "DROP",
                            row.overshoot && "OVERSHOOT",
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : "OK";

                    return (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {t.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatNumber(row.rpm, { decimals: 0 })}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatNumber(row.target_rpm, { decimals: 0 })}
                        </TableCell>
                        <TableCell
                          className={`text-xs ${dev > 30 ? "text-destructive" : ""}`}
                        >
                          {row.deviation_pct != null
                            ? `${formatNumber(row.deviation_pct, {
                                decimals: 1,
                              })}%`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatNumber(row.pwm, { decimals: 0 })}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatNumber(row.duty_pct, { decimals: 1 })}
                        </TableCell>
                        <TableCell className="text-xs">{flagsLabel}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Recent performance (last ~{samples.length || 120} samples)
        </h2>

        <div className="grid gap-4 md:grid-cols-3">
          <HistoryCard title="RPM History">
            <HistorySparkline data={samples} field="rpm" />
          </HistoryCard>

          <HistoryCard title="PWM History">
            <HistorySparkline data={samples} field="pwm" />
          </HistoryCard>

          <HistoryCard title="Speed error (%)">
            <HistorySparkline data={samples} field="deviation_pct" />
          </HistoryCard>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Flagged telemetry events
        </h2>
        <p className="text-xs text-muted-foreground">
          Events with active fault or anomaly flags, view the Anomalies Detected
          page for full packet info.
        </p>

        <Card className="overflow-hidden">
          {recentEvents.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">
              No flagged events recorded for this device.
            </div>
          ) : (
            <div className="max-h-[320px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-[140px]">Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>RPM</TableHead>
                    <TableHead>Target / PWM</TableHead>
                    <TableHead>Speed error (%)</TableHead>
                    <TableHead>Flags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentEvents.map((ev: any) => {
                    const created = new Date(ev.created_at);
                    const flags = ev?.raw?.flags ?? {};
                    const dev = Number(ev?.raw?.deviation_pct ?? 0);
                    const flagged = isFlaggedEvent(ev);
                    const statusLabel = flagged ? "ALERT" : "OK";

                    const rpm = ev.raw.rpm as number | null | undefined;
                    const target = ev.raw.target_rpm as number | null | undefined;
                    const pwm = ev.raw.pwm as number | null | undefined;

                    const flagsLabel =
                      flags.stall ||
                      flags.encoder_fault ||
                      flags.sudden_drop ||
                      flags.overshoot ||
                      dev > 30
                        ? [
                            flags.stall && "STALL",
                            flags.encoder_fault && "ENCODER",
                            flags.sudden_drop && "DROP",
                            flags.overshoot && "OVERSHOOT",
                            dev > 30 && "HIGH_DEV",
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : "OK";

                    return (
                      <TableRow key={ev.event_id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {created.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </TableCell>

                        <TableCell className="text-xs">
                          <span
                            className={
                              flagged
                                ? "text-destructive font-medium"
                                : "text-muted-foreground"
                            }
                          >
                            {statusLabel}
                          </span>
                        </TableCell>

                        <TableCell className="text-xs">
                          {formatNumber(rpm, { decimals: 0 })}{" "}
                          <span className="text-[10px] text-muted-foreground">
                            rpm
                          </span>
                        </TableCell>

                        <TableCell className="text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span>
                              target {formatNumber(target, { decimals: 0 })}{" "}
                              <span className="text-[10px] text-muted-foreground">
                                rpm
                              </span>
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              PWM {formatNumber(pwm, { decimals: 0 })}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="text-xs">
                          {dev != null ? `${formatNumber(dev, { decimals: 1 })}%` : "—"}
                        </TableCell>

                        <TableCell className="text-xs">{flagsLabel}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}


function HistoryCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <p className="mb-2 text-xs text-muted-foreground">{title}</p>
      {children}
    </Card>
  );
}