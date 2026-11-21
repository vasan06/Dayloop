import { lazy, useState, type ReactNode } from "react";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "../lib/toast";
import { Navigate, Route, Routes } from "react-router-dom";
import AuthGate from "./AuthGate";
import Shell from "../components/Shell";
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
const AppStates = lazy(() => import("../pages/AppStates"));
const Responsive = lazy(() => import("../pages/Responsive"));
const TaskDetail = lazy(() => import("../pages/TaskDetail"));
const ProjectDetail = lazy(() => import("../pages/ProjectDetail"));
const Transactions = lazy(() => import("../pages/Transactions"));
const Budgets = lazy(() => import("../pages/Budgets"));

function WorkspaceSession({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    mutationCache: new MutationCache({
      onError: (error) => toast(error instanceof Error ? error.message : "Something went wrong.", "error"),
    }),
    defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export default function App() {
  return (
    <AuthGate>
      {(signOut, identity) => (
        <WorkspaceSession key={identity}>
        <Routes>
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
            {import.meta.env.DEV && <Route path="states" element={<AppStates />} />}
            {import.meta.env.DEV && <Route path="responsive" element={<Responsive />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        </WorkspaceSession>
      )}
    </AuthGate>
  );
}
