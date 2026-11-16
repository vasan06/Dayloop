export type ToastDetail = { message: string; kind: "ok" | "error" };

export function toast(message: string, kind: ToastDetail["kind"] = "ok"): void {
  window.dispatchEvent(new CustomEvent<ToastDetail>("dl-toast", { detail: { message, kind } }));
}
