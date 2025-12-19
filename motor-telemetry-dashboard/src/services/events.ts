export type TelemetryFlags = {
  stall?: boolean;
  status?: string;
  overshoot?: boolean;
  sudden_drop?: boolean;
  encoder_fault?: boolean;
};

export type TelemetryRawPayload = {
  pwm?: number;
  rpm?: number;
  duty_pct?: number;
  target_rpm?: number;
  delta_counts?: number;
  deviation_pct?: number;
  deviation_rpm?: number;
  time_s?: number;
  flags?: TelemetryFlags;
};

export type TelemetryEvent = {
  event_id: string;
  device_id: number;
  time_s: number | null;
  raw: TelemetryRawPayload;
  created_at: string;
};

const BASE_URL = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export async function fetchEvents(
  deviceId: number,
  limit = 200
): Promise<TelemetryEvent[]> {
  const url = `${BASE_URL}/devices/${deviceId}/events?limit=${limit}`;

  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${res.statusText}: ${text || "Unknown error"}`);
  }

  return res.json() as Promise<TelemetryEvent[]>;
}
