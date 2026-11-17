import { lazy } from "react";
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
const AppStates = lazy(() => import("../pages/AppStates"));
const Responsive = lazy(() => import("../pages/Responsive"));
const TaskDetail = lazy(() => import("../pages/TaskDetail"));
const ProjectDetail = lazy(() => import("../pages/ProjectDetail"));
const Transactions = lazy(() => import("../pages/Transactions"));
const Budgets = lazy(() => import("../pages/Budgets"));

export default function App() {
  return (
    <AuthGate>
      {(signOut) => (
        <Routes>
          <Route element={<Shell onSignOut={signOut} />}>
            <Route index element={<Dashboard />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="tasks/:id" element={<TaskDetail />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="habits" element={<Habits />} />
            <Route path="finance" element={<Finance />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="budgets" element={<Budgets />} />
            <Route path="notes" element={<Notes />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="profile" element={<Profile />} />
            <Route path="settings" element={<Navigate to="/profile" replace />} />
            <Route path="states" element={<AppStates />} />
            <Route path="responsive" element={<Responsive />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
    </AuthGate>
  );
}
