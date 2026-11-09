import { Navigate, Route, Routes } from "react-router-dom";
import AuthGate from "./AuthGate";
import Shell from "../components/Shell";
import Dashboard from "../pages/Dashboard";
import Tasks from "../pages/Tasks";
import Projects from "../pages/Projects";
import Habits from "../pages/Habits";
import Finance from "../pages/Finance";
import Notes from "../pages/Notes";
import Calendar from "../pages/Calendar";
import Analytics from "../pages/Analytics";
import Settings from "../pages/Settings";

export default function App() {
  return (
    <AuthGate>
      {(signOut) => (
        <Routes>
          <Route element={<Shell onSignOut={signOut} />}>
            <Route index element={<Dashboard />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="projects" element={<Projects />} />
            <Route path="habits" element={<Habits />} />
            <Route path="finance" element={<Finance />} />
            <Route path="notes" element={<Notes />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
    </AuthGate>
  );
}
