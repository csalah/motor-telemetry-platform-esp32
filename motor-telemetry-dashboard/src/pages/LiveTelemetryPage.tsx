"use client";

import { AlertTriangle, CheckCircle2, Gauge, Activity } from "lucide-react";
import { useDevice } from "@/context/DeviceContext";
import { useLatestMetrics } from "@/hooks/use-latest-metrics"; // adjust path/name if needed
import { TelemetryCard } from "@/components/telemetry/TelemetryCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
//import { Separator } from "@/components/ui/separator";

export default function LiveTelemetryPage() {
  const { selectedDeviceId } = useDevice();
  const { data, loading, error } = useLatestMetrics(selectedDeviceId, 1000);

  if (!selectedDeviceId) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Select a device to view live telemetry.
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Loading telemetry…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-4 text-sm text-destructive">
        Error loading telemetry: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No telemetry received for this device yet.
      </div>
    );
  }

  const {
    timestamp,
    rpm,
    target_rpm,
    deviation_pct,
    deviation_rpm,
    pwm,
    duty_pct,
    delta_counts,
    sudden_drop,
    stall,
    overshoot,
    encoder_fault,
  } = data;

  const devPct = deviation_pct ?? 0;

  const hasHardFault = stall || encoder_fault;
  const hasSoftFault = sudden_drop || overshoot || devPct > 30;
  const isAlert = hasHardFault || hasSoftFault;

  const deviationStatus =
    devPct > 30 ? "alert" : devPct > 15 ? "warn" : "ok";

  const rpmIsRunning = (rpm ?? 0) > 10;
  const rpmWithinBand =
    target_rpm != null && rpm != null
      ? Math.abs(rpm - target_rpm) <= target_rpm * 0.2
      : false;

  const lastUpdate = new Date(timestamp).toLocaleTimeString();

  return (
    <div className="space-y-6">
<Card className="flex items-center justify-between gap-4 p-4">
  <div className="flex items-center gap-3 min-w-0">
    <div className="mt-0.5 shrink-0">
      {isAlert ? (
        <AlertTriangle className="h-5 w-5 text-destructive" />
      ) : (
        <CheckCircle2 className="h-5 w-5 text-green-500" />
      )}
    </div>
    <div className="flex flex-col min-w-0">
      <p
        className={`text-sm font-medium ${
          isAlert ? "text-destructive" : "text-green-600"
        }`}
      >
        {isAlert
          ? hasHardFault
            ? "Alert detected in telemetry"
            : "Performance degraded"
          : "System stable"}
      </p>
      <p className="text-xs text-muted-foreground truncate">
        Last update: {lastUpdate}
      </p>
    </div>
  </div>

  <div className="hidden h-8 border-l border-border/70 md:block" />

  <div className="hidden flex-wrap items-center gap-2 text-xs text-muted-foreground md:flex">
    <StatusPill
      label={rpmIsRunning ? "Running" : "Stopped"}
      icon={<Gauge className="h-3 w-3" />}
      tone={rpmIsRunning ? "ok" : "warn"}
    />
    <StatusPill
      label={
        rpmWithinBand
          ? "On target"
          : devPct > 0
          ? `Off target (${devPct.toFixed(1)}%)`
          : "No target"
      }
      icon={<Activity className="h-3 w-3" />}
      tone={
        devPct > 30
          ? "alert"
          : devPct > 15
          ? "warn"
          : rpmWithinBand
          ? "ok"
          : "neutral"
      }
    />
    <StatusPill
      label={hasHardFault ? "Fault active" : "No critical faults"}
      tone={hasHardFault ? "alert" : "ok"}
    />
  </div>
</Card>


      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-muted-foreground">
            Live metrics
          </h2>
          <p className="text-xs text-muted-foreground">
            Values from the latest telemetry packet
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <TelemetryCard
            title="Actual Speed (RPM)"
            value={rpm}
            unit="rpm"
            status={
              target_rpm && rpm != null && rpm < target_rpm * 0.5
                ? "alert"
                : "ok"
            }
          />
          <TelemetryCard title="Target RPM" value={target_rpm} unit="rpm" />
          <TelemetryCard
            title="Deviation (%)"
            value={deviation_pct != null ? deviation_pct.toFixed(1) : null}
            unit="%"
            status={deviationStatus}
          />

          <TelemetryCard
            title="Deviation (RPM)"
            value={deviation_rpm}
            unit="rpm"
            status={deviationStatus}
          />
          <TelemetryCard
            title="Power Output (PWM)"
            value={pwm}
            status={pwm != null && pwm > 230 ? "warn" : "ok"}
          />
          <TelemetryCard
            title="Duty Cycle"
            value={duty_pct}
            unit="%"
            status={duty_pct != null && duty_pct > 95 ? "warn" : "ok"}
          />

          <TelemetryCard title="Encoder Pulses Δ" value={delta_counts} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight text-muted-foreground">
            Flags
          </h2>
          <p className="text-xs text-muted-foreground">
            Derived from last telemetry packet
          </p>
        </div>

        <Card className="p-4">
          <div className="grid gap-3 text-xs md:grid-cols-4">
            <FlagBadge label="Sudden Drop" active={sudden_drop} />
            <FlagBadge label="Stall" active={stall} />
            <FlagBadge label="Overshoot" active={overshoot} />
            <FlagBadge label="Encoder Fault" active={encoder_fault} />
          </div>
        </Card>
      </section>
    </div>
  );
}


function StatusPill({
  label,
  icon,
  tone = "neutral",
}: {
  label: string;
  icon?: React.ReactNode;
  tone?: "ok" | "warn" | "alert" | "neutral";
}) {
  const base =
    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium";
  const color =
    tone === "ok"
      ? "border-green-200 bg-green-50 text-green-600"
      : tone === "warn"
      ? "border-yellow-200 bg-yellow-50 text-yellow-700"
      : tone === "alert"
      ? "border-destructive/30 bg-destructive/5 text-destructive"
      : "border-border bg-muted text-muted-foreground";

  return (
    <span className={`${base} ${color}`}>
      {icon}
      {label}
    </span>
  );
}

function FlagBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <Badge
      variant={active ? "destructive" : "outline"}
      className="flex items-center justify-between px-3 py-1 text-[11px]"
    >
      <span>{label}</span>
      <span className="ml-2 text-[9px] uppercase tracking-wide">
        {active ? "Active" : "OK"}
      </span>
    </Badge>
  );
}
