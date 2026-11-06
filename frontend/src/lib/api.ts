import { firebaseAuth } from "./firebase";

const API_BASE = import.meta.env.DEV ? "/api/v1" : (import.meta.env.VITE_API_URL ?? "/api/v1");

export type ApiErrorBody = {
  detail?: string | Array<{ msg?: string; loc?: Array<string | number> }>;
  status_code?: number;
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: ApiErrorBody["detail"],
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (import.meta.env.DEV) {
    headers.set("X-DayLoop-Dev-User", firebaseAuth?.currentUser?.uid ?? "primary");
    if (firebaseAuth?.currentUser?.email) headers.set("X-DayLoop-Dev-Email", firebaseAuth.currentUser.email);
    if (firebaseAuth?.currentUser?.displayName) headers.set("X-DayLoop-Dev-Name", firebaseAuth.currentUser.displayName);
  } else if (firebaseAuth?.currentUser) {
    headers.set("Authorization", "Bearer " + await firebaseAuth.currentUser.getIdToken());
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Network request failed.";
    throw new ApiRequestError(
      `Network error: ${message}. Check that the DayLoop API is running.`,
      0,
    );
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ApiErrorBody;
    const detail = Array.isArray(body.detail)
      ? body.detail.map((item) => item.msg ?? "Invalid value").join("; ")
      : body.detail;
    throw new ApiRequestError(
      `HTTP ${response.status}: ${detail ?? "The request could not be completed."}`,
      response.status,
      body.detail,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
