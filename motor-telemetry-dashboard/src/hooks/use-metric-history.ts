import { useEffect, useState } from "react";
import { fetchMetricHistory, type MetricRow } from "@/services/metrics";

export function useMetricHistory(
  deviceId: number | null,
  limit: number = 120,
  pollMs: number = 5000
) {
  const [data, setData] = useState<MetricRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const rows = await fetchMetricHistory(deviceId, limit);
        if (!cancelled) {
          setData(rows);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? "Failed to load history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, pollMs);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [deviceId, limit, pollMs]);

  return { data, loading, error };
}
