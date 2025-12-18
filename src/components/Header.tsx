import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { ProfileSwitch } from './ProfileSwitch';
import { Menu, Bell, User, Shield } from 'lucide-react';
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
import { useAdmin } from '@/hooks/useAdmin';

export function Header() {
  const { user } = useApp();
  const { signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const isProvider = user?.activeProfile === 'provider';

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <header className="absolute top-0 left-0 right-0 z-50 px-3 py-3 sm:p-4 pointer-events-none">
      <div className="flex items-center justify-between gap-2">
        {/* Logo and menu */}
        <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto flex-shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="glass" size="icon" className="rounded-full w-9 h-9 sm:w-10 sm:h-10">
                <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <User className="w-4 h-4 mr-2" />
                Minha Conta
              </DropdownMenuItem>
              {isAdmin && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/admin')} className="text-primary">
                    <Shield className="w-4 h-4 mr-2" />
                    Painel Admin
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

        {/* Profile switch and notifications */}
        <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto flex-shrink-0">
          <ProfileSwitch />
        </div>
      </div>
    </header>
  );
}
