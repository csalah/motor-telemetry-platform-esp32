import { useEffect, useState } from "react";
import { fetchHealth, type HealthResponse } from "@/services/health";

export function useHealth(pollMs = 10_000) {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!data) setLoading(true);
        setError(null);
        const res = await fetchHealth();
        if (!cancelled) setData(res);
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? "Failed to reach /health");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollMs]);

  return { data, loading, error };
}
