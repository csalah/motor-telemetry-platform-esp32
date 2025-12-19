import { apiFetch } from "./client";
import type { Device } from "@/context/DeviceContext";

export async function fetchDevices(): Promise<Device[]> {
  return apiFetch<Device[]>("/devices");
}
