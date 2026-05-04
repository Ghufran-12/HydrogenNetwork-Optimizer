import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./frontend/context/AuthContext";
import LoginPage            from "./frontend/pages/LoginPage";
import HomePage             from "./frontend/pages/HomePage";
import SMRPage              from "./frontend/pages/SMRPage";
import ResultsPage          from "./frontend/pages/ResultsPage";
import HistoryPage          from "./frontend/pages/HistoryPage";
import DashboardPage        from "./frontend/pages/DashboardPage";
import BookmarksPage        from "./frontend/pages/BookmarksPage";
import ComparisonPage       from "./frontend/pages/ComparisonPage";
import TargetsPage          from "./frontend/pages/TargetsPage";
import TeamPage             from "./frontend/pages/TeamPage";
import PlantSetupPage       from "./frontend/pages/PlantSetupPage";
import ManagerDashboardPage from "./frontend/pages/ManagerDashboardPage";

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function ManagerRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "manager") return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login"              element={<LoginPage />} />
      <Route path="/"                   element={<PrivateRoute><HomePage /></PrivateRoute>} />
      <Route path="/smr"                element={<PrivateRoute><SMRPage /></PrivateRoute>} />
      <Route path="/results"            element={<PrivateRoute><ResultsPage /></PrivateRoute>} />
      <Route path="/history"            element={<PrivateRoute><HistoryPage /></PrivateRoute>} />
      <Route path="/bookmarks"          element={<PrivateRoute><BookmarksPage /></PrivateRoute>} />
      <Route path="/compare"            element={<PrivateRoute><ComparisonPage /></PrivateRoute>} />
      <Route path="/dashboard"          element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
      <Route path="/targets"            element={<PrivateRoute><TargetsPage /></PrivateRoute>} />
      <Route path="/team"               element={<PrivateRoute><TeamPage /></PrivateRoute>} />
      <Route path="/manager-dashboard"  element={<ManagerRoute><ManagerDashboardPage /></ManagerRoute>} />
      <Route path="/plant-setup"        element={<PrivateRoute><PlantSetupPage /></PrivateRoute>} />
      <Route path="*"                   element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
