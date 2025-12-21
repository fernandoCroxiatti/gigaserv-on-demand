import React from 'react';
import { Header } from '@/components/Header';
import { ClientView } from '@/components/ClientView';
import { ProviderView } from '@/components/ProviderView';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/hooks/useAuth';
import { useWakeLock } from '@/hooks/useWakeLock';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user: authUser, loading: authLoading } = useAuth();
  const { user, isLoading, canAccessProviderFeatures } = useApp();
  
  // Keep screen awake while app is open
  useWakeLock();

  // Show loading while checking auth
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Redirect to auth if not logged in
  if (!authUser) {
    return <Navigate to="/auth" replace />;
  }

  const activeProfile = user?.activeProfile || 'client';
  
  // CRITICAL: Force client view if user doesn't have provider permissions
  const effectiveProfile = !canAccessProviderFeatures ? 'client' : activeProfile;
  const isClient = effectiveProfile === 'client';

  return (
    <div className={`h-full ${!isClient ? 'provider-theme' : ''}`}>
      <Header />
      {isClient ? <ClientView /> : <ProviderView />}
    </div>
  );
};

export default Index;
