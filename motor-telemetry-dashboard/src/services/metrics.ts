
export type LatestMetrics = {
  id: number;
  device_id: number;
  timestamp: string;
  target_rpm: number | null;
  rpm: number | null;
  deviation_rpm: number | null;
  deviation_pct: number | null;
  pwm: number | null;
  duty_pct: number | null;
  delta_counts: number | null;
  sudden_drop: boolean;
  stall: boolean;
  overshoot: boolean;
  encoder_fault: boolean;
};

export type MetricRow = LatestMetrics;

const BASE_URL = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export async function fetchLatestMetrics(
  deviceId: number
): Promise<LatestMetrics | null> {
  const url = `${BASE_URL}/devices/${deviceId}/metrics/latest`;

  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
  });

  if (res.status === 404) {
    // No metrics for this device yet
    return null;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${res.statusText}: ${text}`);
  }

  return res.json() as Promise<LatestMetrics>;
}

export async function fetchMetricHistory(
  deviceId: number,
  limit: number = 120
): Promise<MetricRow[]> {
  const url = `${BASE_URL}/devices/${deviceId}/metrics?limit=${limit}`;

  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${res.statusText}: ${text}`);
  }

  return res.json() as Promise<MetricRow[]>;
}
