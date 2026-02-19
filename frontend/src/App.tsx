import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ToastProvider } from "@/contexts/ToastContext";
import Layout from "@/components/layout/Layout";
import LoginPage from "@/pages/LoginPage";
import TasksPage from "@/pages/TasksPage";
import CalendarPage from "@/pages/CalendarPage";
import PerformancePage from "@/pages/PerformancePage";
import UsersPage from "@/pages/UsersPage";
import AdminPage from "@/pages/AdminPage";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { setTenantSlug, getTenantSlugFromUrl } from "@/services/api";

// Initialize tenant slug from URL
setTenantSlug(getTenantSlugFromUrl());

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner fullPage />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner fullPage />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "ADMIN") return <Navigate to="/tasks" replace />;
  return <>{children}</>;
}

function AdminLeaderRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner fullPage />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "USER") return <Navigate to="/tasks" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/tasks" replace />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/performance" element={<PerformancePage />} />
              <Route
                path="/users"
                element={
                  <AdminRoute>
                    <UsersPage />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <AdminLeaderRoute>
                    <AdminPage />
                  </AdminLeaderRoute>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/tasks" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
