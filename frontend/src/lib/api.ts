import type { User } from "firebase/auth";
import { firebaseAuth, firebaseConfigured } from "./firebase";
import { isNativeMobile } from "./mobileData";
import { mobileRequest } from "./mobileApi";

const API_BASE = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/+$/, "");
const REQUIRE_HTTPS = isNativeMobile && import.meta.env.PROD;

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

function requestUrl(path: string): string {
  if (!path.startsWith("/")) {
    throw new ApiRequestError("DayLoop could not resolve the requested API path.", 400);
  }
  if (REQUIRE_HTTPS) {
    try {
      const base = new URL(API_BASE);
      if (base.protocol === "https:" && !base.username && !base.password && !base.search && !base.hash) {
        return `${base.href.replace(/\/+$/, "")}${path}`;
      }
    } catch {
      // A packaged app needs an absolute address for the remote API.
    }
    throw new ApiRequestError("DayLoop requires an HTTPS API address on Android. Check VITE_API_URL.", 400);
  }
  return `${API_BASE}${path}`;
}

async function getSessionToken(user: User, forceRefresh = false): Promise<string> {
  try {
    return await user.getIdToken(forceRefresh);
  } catch (error) {
    if (!forceRefresh && error && typeof error === "object" && "code" in error && error.code === "auth/network-request-failed") {
      throw new ApiRequestError("DayLoop could not check your session. Check your connection and try again.", 0);
    }
    throw new ApiRequestError("Your session has expired. Please sign in again.", 401);
  }
}

async function directApiRequest<T>(path: string, options: RequestInit, user: User | null): Promise<T> {
  const url = requestUrl(path);
  const ensureCurrentSession = () => {
    if ((firebaseAuth?.currentUser ?? null) !== user) {
      throw new ApiRequestError("Your DayLoop session changed. Please try again.", 401);
    }
  };
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort("timeout"), 20_000);
  const cancel = () => controller.abort("cancelled");
  if (options.signal?.aborted) cancel();
  else options.signal?.addEventListener("abort", cancel, { once: true });
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (import.meta.env.DEV && !firebaseConfigured) {
    headers.set("X-DayLoop-Dev-User", "primary");
  }
  let response: Response;
  try {
    ensureCurrentSession();
    if (user) headers.set("Authorization", "Bearer " + await getSessionToken(user));
    if (!navigator.onLine) throw new ApiRequestError("No internet connection. Check your network and try again.", 0);
    const request = () => {
      ensureCurrentSession();
      return fetch(url, {
        ...options, headers, signal: controller.signal,
        ...(REQUIRE_HTTPS ? { redirect: "error" } : {}),
      });
    };
    response = await request();
    ensureCurrentSession();
    if (response.status === 401 && user) {
      headers.set("Authorization", "Bearer " + await getSessionToken(user, true));
      response = await request();
      ensureCurrentSession();
    }
  } catch (reason) {
    ensureCurrentSession();
    if (reason instanceof ApiRequestError) throw reason;
    if (controller.signal.aborted) throw new ApiRequestError(controller.signal.reason === "timeout" ? "Request timed out. Your connection may be unstable. Please try again." : "Request cancelled.", 0);
    throw new ApiRequestError("DayLoop could not reach the server. Check your connection and try again.", 0);
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", cancel);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as ApiErrorBody;
    ensureCurrentSession();
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
  const data = await response.json() as T;
  ensureCurrentSession();
  return data;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const user = firebaseAuth?.currentUser ?? null;
  if (!isNativeMobile) return directApiRequest<T>(path, options, user);
  return mobileRequest<T>(path, options, (url, init = {}) => directApiRequest(url, init, user));
}
