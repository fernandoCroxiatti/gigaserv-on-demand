import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { ProfileSwitch } from './ProfileSwitch';
import { GlobalDrawer } from './GlobalDrawer';

export function Header() {
  const { user } = useApp();
  const isProvider = user?.activeProfile === 'provider';
  const isOnline = user?.providerData?.online || false;

  return (
    <header className="absolute top-0 left-0 right-0 z-50 px-3 py-2.5 sm:px-4 sm:py-3 pointer-events-none">
      <div className="flex items-center justify-between gap-2">
        {/* Menu button + Logo */}
        <div className="flex items-center gap-2 pointer-events-auto flex-shrink-0">
          <GlobalDrawer />
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card shadow-sm ${
            isProvider ? 'provider-theme' : ''
          }`}>
            {/* Status indicator */}
            <div className={`w-2 h-2 rounded-full ${
              isProvider 
                ? (isOnline ? 'bg-provider-primary animate-pulse' : 'bg-muted-foreground/40')
                : 'bg-primary'
            }`} />
            <span className="font-bold text-sm tracking-tight">GIGA</span>
            <span className={`font-bold text-sm ${
              isProvider ? 'text-provider-primary' : 'text-primary'
            }`}>S.O.S</span>
          </div>
        </div>

        {/* Profile switch */}
        <div className="flex items-center pointer-events-auto flex-shrink-0">
          <ProfileSwitch />
        </div>
      </div>
    </header>
  );
}