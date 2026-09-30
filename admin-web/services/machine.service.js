import { request } from "./api";
export const machines = (query = "") =>
  request(`/machines?limit=50${query ? `&${query}` : ""}`);
export const machine = (id) => request(`/machines/${id}`);
export const createMachine = (data) =>
  request("/machines", { method: "POST", body: JSON.stringify(data) });
export const deleteMachine = (id) =>
  request(`/machines/${id}`, { method: "DELETE" });
export const alerts = () => request("/alerts");
export const companies = () => request("/companies?limit=100");
