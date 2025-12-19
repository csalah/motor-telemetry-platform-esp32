import { useLocation, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { DeviceProvider, useDevice } from "@/context/DeviceContext";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import { Separator } from "@/components/ui/separator";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

import { MotorPulseLogoAnimated } from "@/components/logo-motorpulse";
import { ThemeToggle } from "@/components/theme-toggle";

import OverviewPage from "@/pages/OverviewPage";
import LiveTelemetryPage from "@/pages/LiveTelemetryPage";
import EventsPage from "@/pages/EventsPage";
import ApiHealthPage from "@/pages/ApiHealthPage";

const NAV_PAGES: Record<string, string> = {
  overview: "Overview",
  live: "Live Telemetry",
  events: "Anomalies Detected",
  health: "API Health",
};

function AppInner() {
  const { devices, selectedDeviceId, setSelectedDeviceId, loading } = useDevice();
  const location = useLocation();

  const rawSegment = location.pathname.replace(/^\/+/, "") || "overview";
  const currentKey = NAV_PAGES[rawSegment] ? rawSegment : "overview";
  const pageTitle = NAV_PAGES[currentKey];

  const deviceOptions = devices.map((d) => ({ value: String(d.device_id), label: d.name }));
  const selectedValue = selectedDeviceId !== null ? String(selectedDeviceId) : "";

  const handleSelectChange = (val: string) => {
    if (val === "") {
      setSelectedDeviceId(null);
    } else {
      setSelectedDeviceId(Number(val));
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />

      <SidebarInset>

        <div className="flex h-14 items-center justify-between border-b px-4 bg-background">
          <div className="flex items-center gap-3">
            <MotorPulseLogoAnimated size={24} />
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>

        <header className="flex h-16 shrink-0 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-4" />

            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    {devices.find((d) => d.device_id === selectedDeviceId)?.name ?? "No device"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{pageTitle}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          {/* RIGHT SIDE: device selector */}
          <div className="flex items-center gap-2">
            <Select value={selectedValue} onValueChange={handleSelectChange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={loading ? "Loading devices..." : "Select Device"} />
              </SelectTrigger>
              <SelectContent>
                {deviceOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="p-6">
          <Routes>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<OverviewPage />} />
            <Route path="/live" element={<LiveTelemetryPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/health" element={<ApiHealthPage />} />
          </Routes>
        </main>

      </SidebarInset>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <DeviceProvider>
      <AppInner />
    </DeviceProvider>
  );
}
