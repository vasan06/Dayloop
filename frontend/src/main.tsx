import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App";
import "./styles/app.css";
import "./styles/quality.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // The app remains usable when service-worker registration is unavailable.
    });
  });
}

// Retire workers installed by earlier development builds so edits reach the browser.
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  void navigator.serviceWorker.getRegistration("/").then(async (registration) => {
    if (registration?.active?.scriptURL !== new URL("/sw.js", location.origin).href) return;
    await registration.unregister();
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("dayloop-shell-"))
      .map((key) => caches.delete(key)));
    if (navigator.serviceWorker.controller) location.reload();
  }).catch(() => {});
}
