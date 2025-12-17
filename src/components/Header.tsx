import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { ProfileSwitch } from './ProfileSwitch';
import { Menu, Bell } from 'lucide-react';
import { Button } from './ui/button';

export function Header() {
  const { user } = useApp();
  const isProvider = user.activeProfile === 'provider';

  return (
    <header className="absolute top-0 left-0 right-0 z-50 p-4 pointer-events-none">
      <div className="flex items-center justify-between">
        {/* Logo and menu */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <Button variant="glass" size="icon" className="rounded-full">
            <Menu className="w-5 h-5" />
          </Button>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl glass-card ${
            isProvider ? 'provider-theme' : ''
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              isProvider ? 'bg-provider-primary' : 'bg-primary'
            }`} />
            <span className="font-bold text-lg tracking-tight">GIGA</span>
            <span className={`font-bold text-lg ${
              isProvider ? 'text-provider-primary' : 'text-primary'
            }`}>S.O.S</span>
          </div>
        </div>

        {/* Profile switch and notifications */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <ProfileSwitch />
          <Button variant="glass" size="icon" className="rounded-full relative">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full text-[10px] text-white flex items-center justify-center">
              2
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
}
