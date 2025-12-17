import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { User, Briefcase } from 'lucide-react';

export function ProfileSwitch() {
  const { user, setActiveProfile, canAccessProviderFeatures } = useApp();
  const isClient = user?.activeProfile === 'client';

  // CRITICAL: If user is not a registered provider, only show client badge
  if (!canAccessProviderFeatures) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl">
        <User className="w-4 h-4" />
        <span className="text-sm font-medium">Cliente</span>
      </div>
    );
  }

  // Provider users can switch between client and provider modes
  return (
    <div className="flex items-center gap-1 p-1 bg-secondary rounded-2xl">
      <button
        onClick={() => setActiveProfile('client')}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
          isClient
            ? 'bg-primary text-primary-foreground shadow-uber'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <User className="w-4 h-4" />
        <span>Cliente</span>
      </button>
      <button
        onClick={() => setActiveProfile('provider')}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
          !isClient
            ? 'bg-provider-primary text-primary-foreground shadow-uber'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Briefcase className="w-4 h-4" />
        <span>Prestador</span>
      </button>
    </div>
  );
}
