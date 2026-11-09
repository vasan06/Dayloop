import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/** `?new=1` opens the page's create dialog (used by the top bar and command palette). */
export function useNewParam(): [boolean, () => void, () => void] {
  const [params, setParams] = useSearchParams();
  const open = params.get("new") === "1";
  const close = useCallback(() => setParams((p) => { p.delete("new"); return p; }, { replace: true }), [setParams]);
  const show = useCallback(() => setParams((p) => { p.set("new", "1"); return p; }, { replace: true }), [setParams]);
  return [open, close, show];
}
