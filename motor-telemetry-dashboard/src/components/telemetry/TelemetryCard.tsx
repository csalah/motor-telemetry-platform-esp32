// src/components/telemetry/TelemetryCard.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TelemetryCard(props: {
  title: string;
  value: string | number | null;
  unit?: string;
  status?: "ok" | "warn" | "alert";
}) {
  const { title, value, unit, status } = props;

  const color =
    status === "alert"
      ? "text-red-500"
      : status === "warn"
      ? "text-yellow-500"
      : "text-primary";

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-semibold ${color}`}>
          {value ?? "—"}
          {unit && <span className="ml-1 text-sm text-muted-foreground">{unit}</span>}
        </p>
      </CardContent>
    </Card>
  );
}
