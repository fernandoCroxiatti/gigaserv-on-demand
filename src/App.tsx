import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "./contexts/AppContext";
import { GoogleMapsProvider } from "./components/Map/GoogleMapsProvider";
import { useAuth } from "./hooks/useAuth";
import { useAdmin } from "./hooks/useAdmin";
import { NotificationProvider } from "./components/Notifications/NotificationProvider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import StripeCallback from "./pages/StripeCallback";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfUse from "./pages/TermsOfUse";
import Settings from "./pages/Settings";
import Support from "./pages/Support";
import { AdminLayout } from "./components/Admin/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminSettings from "./pages/admin/Settings";
import AdminReports from "./pages/admin/Reports";
import AdminProviders from "./pages/admin/Providers";
import AdminClients from "./pages/admin/Clients";
import AdminChamados from "./pages/admin/Chamados";
import AdminNotifications from "./pages/admin/Notifications";
import StripeAuditReport from "./pages/StripeAuditReport";
import ProviderFinances from "./pages/admin/ProviderFinances";
import AdminAntiFraud from "./pages/admin/AntiFraud";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  if (authLoading || adminLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Wrapper to access app context for notification provider
// This component MUST be rendered inside AppProvider
function AppWithNotifications({ children }: { children: React.ReactNode }) {
  // Safe access to context - handles hot-reload edge cases
  const context = useApp();
  const activeProfile = context?.user?.activeProfile || 'client';
  
  return (
    <NotificationProvider activeProfile={activeProfile}>
      {children}
    </NotificationProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <GoogleMapsProvider>
        <AppProvider>
          <AppWithNotifications>
            <Toaster />
            <Sonner />
          <BrowserRouter>
            <Routes>
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/auth" 
                element={
                  <PublicRoute>
                    <Auth />
                  </PublicRoute>
                } 
              />
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } 
              />
              {/* Stripe callback routes */}
              <Route 
                path="/stripe/callback" 
                element={
                  <ProtectedRoute>
                    <StripeCallback />
                  </ProtectedRoute>
                } 
              />
              {/* Legal pages - publicly accessible */}
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfUse />} />
              {/* Support page */}
              <Route 
                path="/support" 
                element={
                  <ProtectedRoute>
                    <Support />
                  </ProtectedRoute>
                } 
              />
              {/* Settings page */}
              <Route 
                path="/settings" 
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                } 
              />
              {/* Admin Routes */}
              <Route 
                path="/admin" 
                element={
                  <AdminRoute>
                    <AdminLayout />
                  </AdminRoute>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="notifications" element={<AdminNotifications />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="providers" element={<AdminProviders />} />
                <Route path="clients" element={<AdminClients />} />
                <Route path="chamados" element={<AdminChamados />} />
                <Route path="finances" element={<ProviderFinances />} />
                <Route path="antifraud" element={<AdminAntiFraud />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          </AppWithNotifications>
        </AppProvider>
      </GoogleMapsProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
