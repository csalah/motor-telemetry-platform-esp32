// src/context/DeviceContext.tsx
import { createContext, useContext, useEffect, useState } from "react";
import { fetchDevices } from "@/services/devices";

export type Device = {
  device_id: number;
  name: string;
  description?: string;
};

type DeviceContextType = {
  devices: Device[];
  selectedDevice: Device | null;
  setSelectedDevice: (d: Device | null) => void;
  selectedDeviceId: number | null;
  setSelectedDeviceId: (id: number | null) => void;
  loading: boolean;
  error: string | null;
};

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedDeviceId = selectedDevice?.device_id ?? null;

  const setSelectedDeviceId = (id: number | null) => {
    if (id === null) {
      setSelectedDevice(null);
    } else {
      const d = devices.find((x) => x.device_id === id);
      if (d) setSelectedDevice(d);
    }
  };

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const data = await fetchDevices();
        setDevices(data);

        const saved = localStorage.getItem("selectedDeviceId");
        if (saved) {
          const d = data.find((x) => x.device_id === Number(saved));
          if (d) setSelectedDevice(d);
        } else if (data.length > 0) {
          setSelectedDevice(data[0]);
        }
      } catch (err: any) {
        console.error("Error loading devices:", err);
        setError(err.message ?? "Failed to load devices");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      localStorage.setItem("selectedDeviceId", String(selectedDevice.device_id));
    }
  }, [selectedDevice]);

  return (
    <DeviceContext.Provider
      value={{
        devices,
        selectedDevice,
        setSelectedDevice,
        selectedDeviceId,
        setSelectedDeviceId,
        loading,
        error,
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice() {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error("useDevice must be used inside <DeviceProvider>");
  return ctx;
}
