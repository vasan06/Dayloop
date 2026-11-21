import { firebaseAuth, firebaseConfigured } from "./firebase";
import { isNativeMobile } from "./mobileData";
import { mobileRequest } from "./mobileApi";

const API_BASE = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/+$/, "");

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

async function directApiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (import.meta.env.DEV && !firebaseConfigured) {
    headers.set("X-DayLoop-Dev-User", "primary");
  }
  if (firebaseAuth?.currentUser) {
    headers.set("Authorization", "Bearer " + await firebaseAuth.currentUser.getIdToken());
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (response.status === 401 && firebaseAuth?.currentUser) {
      headers.set("Authorization", "Bearer " + await firebaseAuth.currentUser.getIdToken(true));
      response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    }
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
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiRequestError("The API returned a page instead of JSON. Check VITE_API_URL and FastAPI connectivity.", response.status);
  }
  return response.json() as Promise<T>;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!isNativeMobile) return directApiRequest<T>(path, options);
  return mobileRequest<T>(path, options, (url, init) => directApiRequest(url, init));
}
