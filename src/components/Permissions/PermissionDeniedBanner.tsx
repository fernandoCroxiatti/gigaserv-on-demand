import React from 'react';
import { MapPin, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PermissionDeniedBannerProps {
  type: 'location' | 'notification';
  onOpenSettings?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function PermissionDeniedBanner({ 
  type, 
  onOpenSettings,
  onDismiss,
  className = ''
}: PermissionDeniedBannerProps) {
  const config = {
    location: {
      icon: MapPin,
      title: 'Localização desativada',
      description: 'Ative a localização nas configurações para usar todos os recursos.',
      buttonText: 'Abrir configurações'
    },
    notification: {
      icon: MapPin,
      title: 'Notificações desativadas',
      description: 'Ative as notificações nas configurações para receber atualizações.',
      buttonText: 'Abrir configurações'
    }
  };

  const { icon: Icon, title, description, buttonText } = config[type];

  const handleOpenSettings = () => {
    // For native apps (Capacitor), this would open app settings
    // For web, we can only guide the user
    if (onOpenSettings) {
      onOpenSettings();
    } else {
      // Fallback: show instructions
      alert('Acesse as configurações do seu navegador ou dispositivo para ativar a permissão.');
    }
  };

  return (
    <div className={`bg-status-searching/10 rounded-xl p-3 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-status-searching/20 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-status-searching" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-status-searching">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
            {onDismiss && (
              <button 
                onClick={onDismiss}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button 
            variant="link" 
            size="sm" 
            className="p-0 h-auto text-xs text-primary mt-1.5"
            onClick={handleOpenSettings}
          >
            <Settings className="w-3 h-3 mr-1" />
            {buttonText}
          </Button>
        </div>
      </div>
    </div>
  );
}
