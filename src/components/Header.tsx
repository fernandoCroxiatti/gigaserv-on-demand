import React, { useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { useApp } from '@/contexts/AppContext';
import { useWakeLock } from '@/hooks/useWakeLock';
import { usePwaInstallPrompt } from '@/hooks/usePwaInstallPrompt';
import { ProfileSwitch } from './ProfileSwitch';
import { GlobalDrawer } from './GlobalDrawer';
import { NotificationBell } from './Notifications/NotificationBell';
import { Button } from './ui/button';
import { Download, Sun } from 'lucide-react';
import { toast } from 'sonner';

export function Header() {
  const { user } = useApp();
  const { isActive: wakeLockActive } = useWakeLock();
  const isProvider = user?.activeProfile === 'provider';
  const isOnline = user?.providerData?.online || false;

  const isNative = typeof Capacitor?.isNativePlatform === 'function' ? Capacitor.isNativePlatform() : false;
  const { canPrompt, promptInstall, standalone } = usePwaInstallPrompt();

  const handleInstall = useCallback(async () => {
    if (isNative) return;

    if (!canPrompt) {
      toast('Instalação indisponível agora', {
        description: 'Abra no Chrome (não anônimo), recarregue e aguarde alguns segundos.',
      });
      return;
    }

    const choice = await promptInstall();

    if (choice.outcome === 'accepted') {
      toast('Instalação iniciada', { description: 'Conclua a instalação para adicionar à tela inicial.' });
    }
  }, [canPrompt, isNative, promptInstall]);

  return (
    <header className="sticky top-0 left-0 right-0 z-50 px-3 py-2.5 sm:px-4 sm:py-3 pointer-events-none" style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))' }}>
      <div className="flex items-center justify-between gap-2">
        {/* Menu button + Logo */}
        <div className="flex items-center gap-2 pointer-events-auto flex-shrink-0">
          <GlobalDrawer />
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card shadow-sm ${
              isProvider ? 'provider-theme' : ''
            }`}
          >
            {/* Status indicator */}
            <div
              className={`w-2 h-2 rounded-full ${
                isProvider
                  ? isOnline
                    ? 'bg-provider-primary animate-pulse'
                    : 'bg-muted-foreground/40'
                  : 'bg-primary'
              }`}
            />
            <span className="font-bold text-sm tracking-tight">GIGA</span>
            <span className={`font-bold text-sm ${isProvider ? 'text-provider-primary' : 'text-primary'}`}>
              S.O.S
            </span>

            {/* Wake Lock indicator */}
            {wakeLockActive && <Sun className="w-3 h-3 text-amber-500 ml-0.5" />}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pointer-events-auto flex-shrink-0">
          <NotificationBell />
          {!isNative && !standalone && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleInstall}
              className="h-9 rounded-xl"
            >
              <Download className="h-4 w-4 mr-2" />
              Instalar
            </Button>
          )}
          <ProfileSwitch />
        </div>
      </div>
    </header>
  );
}
