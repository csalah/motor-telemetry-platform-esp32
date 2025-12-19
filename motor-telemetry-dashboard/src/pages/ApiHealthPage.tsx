import { AlertTriangle, CheckCircle2, Database, Globe } from "lucide-react";
import { useHealth } from "@/hooks/use-health";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function ApiHealthPage() {
  const { data, loading, error, latencyMs } = useHealth(10_000);

  const apiOk = !error && data?.status === "ok";
  const dbOk = apiOk && !!data?.dbTime;

  const statusBadge = (ok: boolean) => (
    <Badge
      variant={ok ? "outline" : "destructive"}
      className={ok ? "border-green-500 text-green-600" : ""}
    >
      {ok ? "Healthy" : "Issue"}
    </Badge>
  );

  const dbTimeFormatted =
    data?.dbTime ? new Date(data.dbTime).toLocaleString() : "—";

  return (
    <div className="space-y-6">
      {/*Header*/}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">API Health</h1>
        <p className="text-sm text-muted-foreground">
          Live status of the MotorPulse API and database connectivity.
        </p>
      </div>

      {/*Error banner*/}
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <div>
            <p className="font-medium">Health check failed</p>
            <p className="text-xs opacity-80">{error}</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/*API card*/}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4 text-primary" />
              API
            </CardTitle>
            {statusBadge(apiOk)}
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className={apiOk ? "text-green-600 font-medium" : "text-destructive font-medium"}>
                {loading ? "Checking…" : apiOk ? "Online" : "Unavailable"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Latency</span>
              <span>{latencyMs != null ? `${latencyMs} ms` : "—"}</span>
            </div>
          </CardContent>
        </Card>

        {/*Database card*/}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4 text-primary" />
              Database
            </CardTitle>
            {statusBadge(dbOk)}
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className={dbOk ? "text-green-600 font-medium" : "text-destructive font-medium"}>
                {loading ? "Checking…" : dbOk ? "Connected" : "Unknown"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">DB Time</span>
              <span>{dbTimeFormatted}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <Separator />
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Raw health payload
          </span>
          {apiOk && <CheckCircle2 className="h-3 w-3 text-green-500" />}
        </div>
        <pre className="max-h-64 overflow-auto rounded-md bg-muted px-3 py-2 text-[11px] leading-relaxed">
          {loading && !data ? "Loading…" : JSON.stringify(data ?? { error }, null, 2)}
        </pre>
      </div>
    </div>
  );
}
