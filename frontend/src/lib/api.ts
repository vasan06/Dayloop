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
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort("timeout"), 20_000);
  const cancel = () => controller.abort("cancelled");
  options.signal?.addEventListener("abort", cancel, { once: true });
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
    if (!navigator.onLine) throw new ApiRequestError("No internet connection. Check your network and try again.", 0);
    response = await fetch(`${API_BASE}${path}`, { ...options, headers, signal: controller.signal });
    if (response.status === 401 && firebaseAuth?.currentUser) {
      headers.set("Authorization", "Bearer " + await firebaseAuth.currentUser.getIdToken(true));
      response = await fetch(`${API_BASE}${path}`, { ...options, headers, signal: controller.signal });
    }
  } catch (reason) {
    if (reason instanceof ApiRequestError) throw reason;
    if (controller.signal.aborted) throw new ApiRequestError(controller.signal.reason === "timeout" ? "Request timed out. Your connection may be unstable. Please try again." : "Request cancelled.", 0);
    throw new ApiRequestError("DayLoop could not reach the server. Check your connection and try again.", 0);
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", cancel);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ApiErrorBody;
    const detail = Array.isArray(body.detail)
      ? body.detail.map((item) => item.msg ?? "Invalid value").join("; ")
      : body.detail;
    const message = response.status === 401 ? "Your session has expired. Please sign in again."
      : response.status >= 500 ? "DayLoop is temporarily unavailable. Please try again."
      : detail ?? "The operation failed. Please try again.";
    throw new ApiRequestError(
      message,
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
