import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ClientProfile } from '@/components/Profile/ClientProfile';
import { ProviderProfile } from '@/components/Profile/ProviderProfile';

const Profile = () => {
  const { user: authUser, loading: authLoading } = useAuth();
  const { user, isLoading } = useApp();

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authUser) {
    return <Navigate to="/auth" replace />;
  }

  const activeProfile = user?.activeProfile || 'client';

  return (
    <div className={`min-h-screen bg-background ${activeProfile === 'provider' ? 'provider-theme' : ''}`}>
      {activeProfile === 'client' ? <ClientProfile /> : <ProviderProfile />}
    </div>
  );
};

export default Profile;
