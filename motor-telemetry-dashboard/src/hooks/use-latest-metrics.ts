import { useEffect, useState } from "react";
import { fetchLatestMetrics, type LatestMetrics } from "@/services/metrics";

export function useLatestMetrics(deviceId: number | null, pollMs = 1000) {
  const [data, setData] = useState<LatestMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        if (!data) setLoading(true);
        setError(null);

        const result = await fetchLatestMetrics(deviceId);

        if (cancelled) return;

        setData(result);
      } catch (err: any) {
        if (cancelled) return;
        setError(err.message ?? "Failed to load latest metrics");
        setData(null);
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
  }, [data, deviceId, pollMs]);

  return { data, loading, error };
}
