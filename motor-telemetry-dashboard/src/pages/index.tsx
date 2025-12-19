import React from "react";

export function Overview({ deviceId }: { deviceId: string }) {
  return <div>Overview for <strong>{deviceId}</strong></div>;
}
export function LiveTelemetry({ deviceId }: { deviceId: string }) {
  return <div>Live Telemetry (placeholder) — device: <strong>{deviceId}</strong></div>;
}
export function ChartsTrends({ deviceId }: { deviceId: string }) {
  return <div>Charts & Trends for <strong>{deviceId}</strong></div>;
}
export function EventsAnomalies({ deviceId }: { deviceId: string }) {
  return <div>Events & Anomalies for <strong>{deviceId}</strong></div>;
}
export function SettingsPage({ deviceId }: { deviceId: string }) {
  return <div>Settings — device: <strong>{deviceId}</strong></div>;
}
export function ApiHealth({ deviceId }: { deviceId: string }) {
  return <div>API Health — device: <strong>{deviceId}</strong></div>;
}
export function MotorControls({ deviceId }: { deviceId: string }) {
  return <div>Motor Controls — device: <strong>{deviceId}</strong></div>;
}