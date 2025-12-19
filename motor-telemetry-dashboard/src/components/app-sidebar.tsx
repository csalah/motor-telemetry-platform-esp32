// src/components/app-sidebar.tsx
import React from "react";
import {
  LayoutDashboard,
  RadioTower,
  AlertTriangle,
  //Settings as SettingsIcon,
  Activity,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type Item = {
  key: string;
  title: string;
  icon: React.ComponentType<any>;
};

const MAIN: Item[] = [
  { key: "overview", title: "Overview", icon: LayoutDashboard },
  { key: "live", title: "Live Telemetry", icon: RadioTower },
  { key: "events", title: "Anomalies Detected", icon: AlertTriangle },
];

const SYSTEM: Item[] = [
  { key: "health", title: "API Health", icon: Activity },
];

export const AppSidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const goto = (key: string) => {
    if (key === "overview") {
      navigate("/overview");
    } else {
      navigate(`/${key}`);
    }
  };

  const isActiveKey = (key: string) => {
    const path = location.pathname === "/" ? "/overview" : location.pathname;
    return path === `/${key}`;
  };

  const renderSection = (label: string, items: Item[]) => (
    <SidebarGroup>
      <SidebarGroupLabel className="text-xs font-semibold uppercase text-sidebar-foreground/60">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((it) => {
            const Icon = it.icon;
            const isActive = isActiveKey(it.key);

            return (
              <SidebarMenuItem key={it.key}>
                <SidebarMenuButton asChild isActive={isActive}>
                  <a
                    href={`/${it.key}`}
                    onClick={(e) => {
                      e.preventDefault();
                      goto(it.key);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{it.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar className="bg-sidebar text-sidebar-foreground">
      <SidebarContent>
        {renderSection("Main", MAIN)}
        {renderSection("System", SYSTEM)}
      </SidebarContent>
    </Sidebar>
  );
};
