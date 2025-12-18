import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { User, Briefcase } from 'lucide-react';

export function ProfileSwitch() {
  const { user, setActiveProfile, canAccessProviderFeatures } = useApp();
  const isClient = user?.activeProfile === 'client';

  // CRITICAL: If user is not a registered provider, only show client badge
  if (!canAccessProviderFeatures) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-primary text-primary-foreground rounded-xl">
        <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span className="text-xs sm:text-sm font-medium">Cliente</span>
      </div>
    );
  }

  // Provider users can switch between client and provider modes
  return (
    <div className="flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 bg-secondary rounded-xl sm:rounded-2xl">
      <button
        onClick={() => setActiveProfile('client')}
        className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 ${
          isClient
            ? 'bg-primary text-primary-foreground shadow-uber'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span className="hidden xs:inline sm:inline">Cliente</span>
      </button>
      <button
        onClick={() => setActiveProfile('provider')}
        className={`flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-300 ${
          !isClient
            ? 'bg-provider-primary text-primary-foreground shadow-uber'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span className="hidden xs:inline sm:inline">Prestador</span>
      </button>
    </div>
  );
}
