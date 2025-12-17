import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { ProfileSwitch } from './ProfileSwitch';
import { Menu, Bell, User } from 'lucide-react';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';

export function Header() {
  const { user } = useApp();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const isProvider = user?.activeProfile === 'provider';

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <header className="absolute top-0 left-0 right-0 z-50 p-4 pointer-events-none">
      <div className="flex items-center justify-between">
        {/* Logo and menu */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="glass" size="icon" className="rounded-full">
                <Menu className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="w-4 h-4 mr-2" />
                Minha Conta
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
