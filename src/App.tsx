import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider, useOptionalApp } from "./contexts/AppContext";
import { GoogleMapsProvider } from "./components/Map/GoogleMapsProvider";
import { useAuth } from "./hooks/useAuth";
import { useAdmin } from "./hooks/useAdmin";
import { NotificationProvider } from "./components/Notifications/NotificationProvider";
import { GlobalErrorBoundary } from "./components/GlobalErrorBoundary";
import { SafeSplashScreen } from "./components/SafeSplashScreen";
import { AnimatedSplashScreen } from "./components/AnimatedSplashScreen";
import { ProfileSelectionScreen } from "./components/ProfileSelectionScreen";
import { useSafeInitialization } from "./hooks/useSafeInitialization";
import { useAudioUnlock } from "./hooks/useAudioUnlock";
import { useActivityTracker } from "./hooks/useActivityTracker";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import StripeCallback from "./pages/StripeCallback";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfUse from "./pages/TermsOfUse";
import Settings from "./pages/Settings";
import Support from "./pages/Support";
import InternalNotificationsPage from "./pages/InternalNotifications";
import VehiclesPage from "./pages/Vehicles";
import { AdminLayout } from "./components/Admin/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminSettings from "./pages/admin/Settings";
import AdminReports from "./pages/admin/Reports";
import AdminProviders from "./pages/admin/Providers";
import AdminClients from "./pages/admin/Clients";
import AdminChamados from "./pages/admin/Chamados";
import AdminNotifications from "./pages/admin/Notifications";
import InternalNotificationsAdmin from "./pages/admin/InternalNotificationsAdmin";
import StripeAuditReport from "./pages/StripeAuditReport";
import ProviderFinances from "./pages/admin/ProviderFinances";
import AdminAntiFraud from "./pages/admin/AntiFraud";
import AdminSuspiciousPatterns from "./pages/admin/SuspiciousPatterns";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Prevent queries from running during initialization
      enabled: true,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  useActivityTracker();

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
function AppWithNotifications({ children }: { children: React.ReactNode }) {
  const context = useOptionalApp();
  const activeProfile = context?.user?.activeProfile || 'client';

  // Hook para desbloqueio de áudio - listener passivo global
  // Não altera nenhuma lógica existente, apenas adiciona listener de clique
  useAudioUnlock();

  return (
    <NotificationProvider activeProfile={activeProfile}>
      {children}
    </NotificationProvider>
  );
}

/**
 * Main App Routes - Only rendered after safe initialization
 */
function AppRoutes() {
  return (
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
      {/* Internal Notifications page */}
      <Route 
        path="/notifications" 
        element={
          <ProtectedRoute>
            <InternalNotificationsPage />
          </ProtectedRoute>
        } 
      />
      {/* Vehicles page - Provider only */}
      <Route 
        path="/vehicles" 
        element={
          <ProtectedRoute>
            <VehiclesPage />
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
        <Route path="internal-notifications" element={<InternalNotificationsAdmin />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="providers" element={<AdminProviders />} />
        <Route path="clients" element={<AdminClients />} />
        <Route path="chamados" element={<AdminChamados />} />
        <Route path="finances" element={<ProviderFinances />} />
        <Route path="antifraud" element={<AdminAntiFraud />} />
        <Route path="suspicious" element={<AdminSuspiciousPatterns />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

/**
 * Safe App Wrapper - Manages initialization phases
 * 
 * Boot sequence:
 * 1. Splash screen (static, no logic)
 * 2. Profile selection (client/provider) 
 * 3. Auth check
 * 4. Full app ready
 */
function SafeAppWrapper() {
  const {
    isAnimatedSplashPhase,
    isSplashPhase,
    isProfileSelectPhase,
    isAuthCheckPhase,
    isReady,
    selectProfile,
    markReady,
    selectedProfile,
    onAnimatedSplashComplete,
  } = useSafeInitialization();

  const { loading: authLoading } = useAuth();

  // Mark as ready when auth check completes
  useEffect(() => {
    if (isAuthCheckPhase && !authLoading) {
      markReady();
    }
  }, [isAuthCheckPhase, authLoading, markReady]);

  // Phase 0: Animated splash screen
  if (isAnimatedSplashPhase) {
    return <AnimatedSplashScreen onComplete={onAnimatedSplashComplete} />;
  }

  // Phase 1: Static splash screen (fallback during transitions)
  if (isSplashPhase) {
    return <SafeSplashScreen />;
  }

  // Phase 2: Welcome screen (before any auth/backend)
  if (isProfileSelectPhase) {
    return (
      <ProfileSelectionScreen
        onStart={() => selectProfile('client')}
      />
    );
  }

  // Phase 3: Auth check in progress
  if (isAuthCheckPhase && authLoading) {
    return <SafeSplashScreen />;
  }

  // Phase 4: App ready - render full app
  return (
    <GoogleMapsProvider>
      <AppProvider>
        <AppWithNotifications>
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AppWithNotifications>
      </AppProvider>
    </GoogleMapsProvider>
  );
}

/**
 * Root App Component
 * 
 * Wrapped in GlobalErrorBoundary to catch any unhandled errors
 * and prevent crashes on Android release builds.
 */
const App = () => (
  <GlobalErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SafeAppWrapper />
      </TooltipProvider>
    </QueryClientProvider>
  </GlobalErrorBoundary>
);

export default App;
