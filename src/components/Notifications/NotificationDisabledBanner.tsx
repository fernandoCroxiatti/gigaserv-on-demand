import React, { useState } from 'react';
import { Bell, X, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NotificationDisabledBannerProps {
  onDismiss?: () => void;
}

export function NotificationDisabledBanner({ onDismiss }: NotificationDisabledBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className="bg-status-searching/10 border border-status-searching/20 rounded-xl p-3 mx-4 mt-2">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-status-searching/20 flex items-center justify-center flex-shrink-0">
          <Bell className="w-4 h-4 text-status-searching" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-status-searching">
            Notificações desativadas
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Para ativar, acesse as configurações do seu dispositivo.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0"
          onClick={handleDismiss}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
