import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { ProfileSwitch } from './ProfileSwitch';

export function Header() {
  const { user } = useApp();
  const isProvider = user?.activeProfile === 'provider';

  return (
    <header className="absolute top-0 left-0 right-0 z-50 px-3 py-3 sm:p-4 pointer-events-none">
      <div className="flex items-center justify-between gap-2">
        {/* Logo */}
        <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto flex-shrink-0">
          <div className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl glass-card ${
            isProvider ? 'provider-theme' : ''
          }`}>
            <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
              isProvider ? 'bg-provider-primary' : 'bg-primary'
            }`} />
            <span className="font-bold text-sm sm:text-lg tracking-tight">GIGA</span>
            <span className={`font-bold text-sm sm:text-lg ${
              isProvider ? 'text-provider-primary' : 'text-primary'
            }`}>S.O.S</span>
          </div>
        </div>

        {/* Profile switch */}
        <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto flex-shrink-0">
          <ProfileSwitch />
        </div>
      </div>
    </header>
  );
}
