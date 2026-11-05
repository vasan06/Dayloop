import { firebaseAuth } from "./firebase";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api/v1";

export type ApiError = { detail?: string };

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (import.meta.env.DEV) {
    headers.set("X-DayLoop-Dev-User", firebaseAuth?.currentUser?.uid ?? "primary");
  } else if (firebaseAuth?.currentUser) {
    headers.set("Authorization", "Bearer " + await firebaseAuth.currentUser.getIdToken());
  }
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ApiError;
    throw new Error(body.detail ?? `DayLoop API error (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
