import { request } from "./api";
export const machines = (query = "") =>
  request(`/machines?limit=50${query ? `&${query}` : ""}`);
export async function fleetMachines() {
  const first = await request('/machines?limit=100&page=1');
  const total = first.pagination?.total ?? first.data?.length ?? 0;
  const pages = Math.ceil(total / 100);
  if (pages <= 1) return first.data || [];
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, index) =>
      request(`/machines?limit=100&page=${index + 2}`)),
  );
  return [...(first.data || []), ...rest.flatMap(page => page.data || [])];
}
export const machine = (id) => request(`/machines/${id}`);
export const telemetryHistory = (id, limit = 100) =>
  request(`/telemetry/machines/${encodeURIComponent(id)}?limit=${limit}`);
export const createMachine = (data) =>
  request("/machines", { method: "POST", body: JSON.stringify(data) });
export const deleteMachine = (id) =>
  request(`/machines/${id}`, { method: "DELETE" });
export const alerts = () => request("/alerts");
export const companies = () => request("/companies?limit=100");
