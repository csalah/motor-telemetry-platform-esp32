import { useEffect, useState } from "react";
import { fetchEvents, type TelemetryEvent } from "@/services/events";

export function useEvents(
  deviceId: number | null,
  pollMs = 5000,   //refreshes every 5 seconds
  limit = 200
) {
  const [data, setData] = useState<TelemetryEvent[] | null>(null);
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

        const events = await fetchEvents(deviceId, limit);
        if (cancelled) return;

        setData(events);
      } catch (err: any) {
        if (cancelled) return;
        setError(err.message ?? "Failed to load events");
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
  }, [deviceId, pollMs, limit, data]);

  return { data, loading, error };
}
