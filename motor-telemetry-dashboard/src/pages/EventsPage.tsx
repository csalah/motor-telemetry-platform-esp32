"use client";

import * as React from "react";
import { Activity, AlertTriangle, Filter, RefreshCw } from "lucide-react";

import { useDevice } from "@/context/DeviceContext";
import { useEvents } from "@/hooks/use-events";
import type { TelemetryEvent } from "@/services/events";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function EventsPage() {
  const { selectedDeviceId } = useDevice();
  const [limit, setLimit] = React.useState(200);
  const [alertsOnly, setAlertsOnly] = React.useState(false);

  const { data, loading, error } = useEvents(selectedDeviceId, 5000, limit); // 5s polling


  if (!selectedDeviceId) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Select a device to view telemetry events.
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Loading events…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-4 text-sm text-destructive">
        Error loading events: {error}
      </div>
    );
  }

  const events = data ?? [];


  const filteredEvents = alertsOnly
    ? events.filter((e) => isAlertEvent(e))
    : events;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-base font-semibold tracking-tight">
            Recent MQTT anomaly packets
          </h1>
          <p className="text-xs text-muted-foreground">
            MQTT telemetry packets that flagged an alert or fault condition
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Label
              htmlFor="alerts-only"
              className="flex items-center gap-2 text-xs font-normal text-muted-foreground"
            >
              <Switch
                id="alerts-only"
                checked={alertsOnly}
                onCheckedChange={(v) => setAlertsOnly(Boolean(v))}
              />
              Alerts only
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Limit</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="h-7 rounded-md border bg-background px-2 text-xs"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
          </div>

          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-7 w-7"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground flex items-center justify-between">
          <span>
            Showing {filteredEvents.length} of {events.length} events
          </span>
          {loading && (
            <span className="inline-flex items-center gap-1">
              <Activity className="h-3 w-3 animate-spin" />
              Updating…
            </span>
          )}
        </div>

        {filteredEvents.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground">
            {events.length === 0
              ? "No events have been recorded for this device yet."
              : "No events match the current filter."}
          </div>
        ) : (
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background border-b text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Time</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">RPM</th>
                  <th className="px-3 py-2 text-left">PWM / Duty</th>
                  <th className="px-3 py-2 text-left">Deviation</th>
                  <th className="px-3 py-2 text-left">Flags</th>
                  <th className="px-3 py-2 text-right">Payload</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((ev) => {
                  const created = new Date(ev.created_at);
                  const flags = ev.raw.flags ?? {};
                  const statusLabel = flags.status ?? "OK";
                  const isAlert = statusLabel.toUpperCase() === "ALERT";

                  const rpm = ev.raw.rpm ?? null;
                  const target = ev.raw.target_rpm ?? null;
                  const deviationPct = ev.raw.deviation_pct ?? null;
                  const pwm = ev.raw.pwm ?? null;
                  const duty = ev.raw.duty_pct ?? null;

                  return (
                    <tr
                      key={ev.event_id}
                      className="border-b last:border-b-0 hover:bg-muted/40"
                    >
                      <td className="px-3 py-2 align-top whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {created.toLocaleTimeString(undefined, {
                              hour12: true,
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            uptime:{" "}
                            {ev.time_s != null
                              ? `${ev.time_s.toFixed(3)} s`
                              : "—"}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-2 align-top">
                        <StatusBadge status={statusLabel} />
                      </td>

                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">
                            {rpm != null ? `${rpm.toFixed(0)} rpm` : "—"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            target{" "}
                            {target != null ? `${target.toFixed(0)} rpm` : "—"}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-col gap-0.5">
                          <span>
                            {pwm != null ? `PWM ${pwm.toFixed(0)}` : "PWM —"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            duty {duty != null ? `${duty.toFixed(1)}%` : "—"}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-col gap-0.5">
                          <span>
                            {deviationPct != null
                              ? `${deviationPct.toFixed(1)}%`
                              : "—"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            abs {ev.raw.deviation_rpm ?? "—"} rpm
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-wrap gap-1">
                          <FlagChip label="Stall" active={!!flags.stall} />
                          <FlagChip
                            label="Overshoot"
                            active={!!flags.overshoot}
                          />
                          <FlagChip
                            label="Drop"
                            active={!!flags.sudden_drop}
                          />
                          <FlagChip
                            label="Encoder"
                            active={!!flags.encoder_fault}
                          />
                        </div>
                      </td>

                      <td className="px-3 py-2 align-top text-right">
                        <PayloadToggle raw={ev.raw} isAlert={isAlert} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- Helpers ----------

function isAlertEvent(ev: TelemetryEvent): boolean {
  const flags = ev.raw.flags ?? {};
  const status = (flags.status ?? "").toUpperCase();

  return (
    status === "ALERT" ||
    flags.stall ||
    flags.encoder_fault ||
    flags.overshoot ||
    flags.sudden_drop 
  );
}

function StatusBadge({ status }: { status: string }) {
  const upper = status.toUpperCase();

  if (upper === "ALERT") {
    return (
      <Badge variant="destructive" className="gap-1 px-2 py-0.5 text-[10px]">
        <AlertTriangle className="h-3 w-3" />
        ALERT
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="gap-1 px-2 py-0.5 text-[10px] text-green-700 border-green-200 bg-green-50"
    >
      OK
    </Badge>
  );
}

function FlagChip({ label, active }: { label: string; active: boolean }) {
  if (!active) {
    return (
      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
        {label}
      </span>
    );
  }

  return (
    <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
      {label}
    </span>
  );
}

function PayloadToggle({
  raw,
  isAlert,
}: {
  raw: unknown;
  isAlert: boolean;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-[10px] font-medium text-primary hover:underline"
      >
        {open ? "Hide" : "View"} payload
      </button>
      {open && (
        <pre className="mt-1 max-h-32 w-[260px] overflow-auto rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground text-left">
          {JSON.stringify(raw, null, 2)}
        </pre>
      )}
      {isAlert && (
        <span className="text-[9px] text-destructive/80 uppercase tracking-wide">
          Alert snapshot
        </span>
      )}
    </div>
  );
}
