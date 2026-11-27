import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { getSyncValue, isNativeMobile } from "../lib/mobileData";
import { openMobileWorkspace, preloadMobileWorkspace, scheduleMobileSync } from "../lib/mobileApi";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "../lib/toast";
import { registerNotificationActions } from "../lib/notifications";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AuthGate from "./AuthGate";
import Shell from "../components/Shell";
import AndroidUpdate from "../components/AndroidUpdate";
const Dashboard = lazy(() => import("../pages/Dashboard"));
const Tasks = lazy(() => import("../pages/Tasks"));
const Projects = lazy(() => import("../pages/Projects"));
const Habits = lazy(() => import("../pages/Habits"));
const Finance = lazy(() => import("../pages/Finance"));
const Notes = lazy(() => import("../pages/Notes"));
const Calendar = lazy(() => import("../pages/Calendar"));
const Analytics = lazy(() => import("../pages/Analytics"));
const Profile = lazy(() => import("../pages/Profile"));
const Trackers = lazy(() => import("../pages/Trackers"));
const Settings = lazy(() => import("../pages/Settings"));
const TaskDetail = lazy(() => import("../pages/TaskDetail"));
const ProjectDetail = lazy(() => import("../pages/ProjectDetail"));
const Transactions = lazy(() => import("../pages/Transactions"));
const Budgets = lazy(() => import("../pages/Budgets"));
const Admin = lazy(() => import("../pages/Admin"));


function WorkspaceSession({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    mutationCache: new MutationCache({
      onError: (error) => toast(error instanceof Error ? error.message : "Something went wrong.", "error"),
    }),
    defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 } },
  }));
  useEffect(() => {
    if (!isNativeMobile) return;
    let live = true;
    const refresh = () => { if (live) void client.invalidateQueries({ refetchType: "active" }); };
    window.addEventListener("online", refresh);
    window.addEventListener("dayloop:mobile-sync", refresh);
    let stop: (() => void) | undefined;
    void openMobileWorkspace().then((ready) => {
      if (ready && live) return getSyncValue("bootstrap_status").then((status) => {
        if (status !== "complete" && live) return preloadMobileWorkspace();
      });
    }).catch(() => {}).finally(() => {
      if (live) stop = scheduleMobileSync();
    });
    return () => {
      live = false;
      stop?.();
      window.removeEventListener("online", refresh);
      window.removeEventListener("dayloop:mobile-sync", refresh);
    };
  }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function LegacyNotificationRedirect() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const id = encodeURIComponent(params.get("sourceId") || "");
  const type = params.get("type");
  const path = type === "task" && id ? "/tasks/" + id : type === "habit" ? "/habits" + (id ? "?highlight=" + id : "") : type === "event" ? "/calendar" + (id ? "?highlight=" + id : "") : "/";
  return <Navigate to={path} replace />;
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isNativeMobile) return;
    // Capacitor's backButton event handles both Android gesture navigation and
    // the hardware key. Avoid overriding BridgeActivity.onBackPressed(), which
    // can bypass AndroidX back dispatch on newer Android versions.
    let active = true;
    let remove: (() => void) | undefined;
    void CapacitorApp.addListener("backButton", () => {
      const overlay = new Event("dayloop:back-overlay", { cancelable: true });
      window.dispatchEvent(overlay);
      if (overlay.defaultPrevented) return;
      const index = Number(window.history.state?.idx ?? 0);
      if (index > 0) navigate(-1);
      else if (/^\/tasks\/[^/]+/.test(window.location.pathname)) navigate("/tasks", { replace: true });
      else if (/^\/projects\/[^/]+/.test(window.location.pathname)) navigate("/projects", { replace: true });
      else if (window.location.pathname !== "/") navigate("/", { replace: true });
      // At the workspace root, stay in DayLoop instead of closing the app.
    }).then((handle) => {
      if (active) remove = () => { void handle.remove(); };
      else void handle.remove();
    }).catch((error) => console.warn("Android back navigation unavailable", error));
    return () => { active = false; remove?.(); };
  }, [navigate]);
  useEffect(() => {
    let active = true;
    let dispose: (() => void) | undefined;
    void registerNotificationActions((path) => navigate(path)).then((stop) => {
      if (active) dispose = stop;
      else stop();
    }).catch((error) => console.warn("Notification actions unavailable", error instanceof Error ? error.message : "unknown"));
    return () => { active = false; dispose?.(); };
  }, [navigate]);
  if (location.pathname.startsWith("/admin")) return <Suspense fallback={<div className="boot">Opening admin…</div>}><Admin /></Suspense>;
  return (
    <>
    <AndroidUpdate />
    <AuthGate>
      {(signOut, identity) => (
        <WorkspaceSession key={identity}>
        <Routes>
          <Route path="notification-action" element={<LegacyNotificationRedirect />} />
          <Route element={<Shell onSignOut={signOut} identity={identity} />}>
            <Route index element={<Dashboard />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="tasks/:id" element={<TaskDetail />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="habits" element={<Habits />} />
            <Route path="trackers" element={<Trackers />} />
            <Route path="finance" element={<Finance />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="budgets" element={<Budgets />} />
            <Route path="notes" element={<Notes />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        </WorkspaceSession>
      )}
    </AuthGate>
    </>
  );
}
