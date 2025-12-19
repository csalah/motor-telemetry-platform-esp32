import { apiFetch } from "./client";

export type HealthResponse = {
  status: "ok" | "error";
  dbTime?: string;
  error?: string;
};

export async function fetchHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health");
}
