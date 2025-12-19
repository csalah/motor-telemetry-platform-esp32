"use client";

import * as React from "react";
import type { MetricRow } from "@/services/metrics";

type HistorySparklineProps = {
  data: MetricRow[] | undefined;
  field: "rpm" | "pwm" | "deviation_pct";
};

type Point = {
  t: number; 
  v: number; 
};

export function HistorySparkline({ data, field }: HistorySparklineProps) {
  const points: Point[] = React.useMemo(() => {
    if (!data || data.length === 0) return [];

    return data
      .map((row) => {
        const raw = row[field] as number | null | undefined;
        if (raw === null || raw === undefined || Number.isNaN(raw)) {
          return null;
        }
        return {
          t: new Date(row.timestamp).getTime(),
          v: raw,
        } as Point;
      })
      .filter((p): p is Point => p !== null);
  }, [data, field]);

  if (points.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-[11px] text-muted-foreground">
        No data
      </div>
    );
  }

  const min = Math.min(...points.map((p) => p.v));
  const max = Math.max(...points.map((p) => p.v));

  const range = max - min || 1;

  const width = 260;
  const height = 80;
  const paddingX = 4;
  const paddingY = 4;

  const xScale = (idx: number) =>
    paddingX +
    (idx / Math.max(points.length - 1, 1)) * (width - paddingX * 2);
  const yScale = (v: number) =>
    height - paddingY - ((v - min) / range) * (height - paddingY * 2);

  const pathD = points
    .map((p, i) => {
      const x = xScale(i);
      const y = yScale(p.v);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  const latest = points[points.length - 1]?.v ?? null;

  return (
    <div className="flex flex-col gap-1">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-20 w-full overflow-visible"
        aria-hidden="true"
      >
      
        <path
          d={`${pathD} L ${xScale(points.length - 1)} ${height - paddingY} L ${xScale(
            0
          )} ${height - paddingY} Z`}
          className="fill-muted-foreground/40"
        />
      
        <path d={pathD} className="stroke-muted-foreground" fill="none" />
      </svg>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          min {min.toFixed(1)} · max {max.toFixed(1)}
        </span>
        <span className="font-medium text-foreground">
          {latest !== null ? latest.toFixed(1) : "—"}
        </span>
      </div>
    </div>
  );
}
