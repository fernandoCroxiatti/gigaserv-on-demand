import React, { useState } from 'react';
import { Bell, BellOff, Settings, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { useNotificationStatus } from '@/hooks/useNotificationStatus';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';

interface NotificationStatusIndicatorProps {
  showLabel?: boolean;
  variant?: 'row' | 'badge';
}

export function NotificationStatusIndicator({ 
  showLabel = true, 
  variant = 'row' 
}: NotificationStatusIndicatorProps) {
  const { isEnabled, browserPermission, hasSubscription, loading, refetch } = useNotificationStatus();
  const { requestPermission } = useNotificationPermission();
  const [isActivating, setIsActivating] = useState(false);
  const [showBlockedGuide, setShowBlockedGuide] = useState(false);

  const handleActivate = async () => {
    console.log('[NotificationStatusIndicator] 🔔 handleActivate called');
    console.log('[NotificationStatusIndicator] Current state:', { isEnabled, browserPermission, hasSubscription, loading });
    
    setIsActivating(true);
    try {
      console.log('[NotificationStatusIndicator] Calling requestPermission...');
      const result = await requestPermission();
      console.log('[NotificationStatusIndicator] requestPermission returned:', result);
      
      // Aguarda um pouco para o playerId ser salvo
      await new Promise(resolve => setTimeout(resolve, 2500));
      console.log('[NotificationStatusIndicator] Calling refetch...');
      refetch();
    } catch (error) {
      console.error('[NotificationStatusIndicator] ❌ Error activating notifications:', error);
    } finally {
      setIsActivating(false);
      console.log('[NotificationStatusIndicator] ✅ Activation flow finished');
    }
  };

  if (loading) {
    if (variant === 'badge') {
      return <Skeleton className="h-5 w-20 rounded-full" />;
    }
    return (
      <div className="flex items-center gap-4 p-3 bg-secondary rounded-xl animate-pulse">
        <div className="w-5 h-5 bg-muted rounded" />
        <div className="flex-1">
          <div className="h-3 bg-muted rounded w-24 mb-1" />
          <div className="h-4 bg-muted rounded w-32" />
        </div>
      </div>
    );
  }

  // Determine status text and style
  let statusText = 'Ativas';
  let statusColor = 'bg-status-finished text-white';
  let canActivate = false;
  let activateText = 'Ativar';
  let isBlocked = false;
  
  if (!isEnabled) {
    if (browserPermission === 'denied') {
      statusText = 'Bloqueadas';
      statusColor = 'bg-destructive text-destructive-foreground';
      canActivate = false;
      isBlocked = true;
    } else if (browserPermission === 'unsupported') {
      statusText = 'Indisponível';
      statusColor = 'bg-muted text-muted-foreground';
      canActivate = false;
    } else if (browserPermission === 'granted' && !hasSubscription) {
      statusText = 'Quase lá';
      statusColor = 'bg-status-searching text-white';
      canActivate = true;
      activateText = 'Concluir ativação';
    } else {
      statusText = 'Desativadas';
      statusColor = 'bg-status-searching text-white';
      canActivate = true;
      activateText = 'Toque para ativar';
    }
  }

  if (variant === 'badge') {
    if (canActivate) {
      return (
        <Button 
          size="sm" 
          variant="outline"
          onClick={handleActivate}
          disabled={isActivating}
          className="gap-1 h-6 px-2 text-xs"
        >
          <BellOff className="w-3 h-3" />
          {isActivating ? 'Ativando...' : activateText}
        </Button>
      );
    }
    return (
      <Badge className={`${statusColor} gap-1`}>
        {isEnabled ? (
          <Bell className="w-3 h-3" />
        ) : (
          <BellOff className="w-3 h-3" />
        )}
        {statusText}
      </Badge>
    );
  }

  // Special UI for blocked notifications - show guide
  if (isBlocked) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 overflow-hidden">
        <button
          onClick={() => setShowBlockedGuide(!showBlockedGuide)}
          className="w-full flex items-center gap-4 p-3 text-left hover:bg-destructive/10 transition-colors"
        >
          <BellOff className="w-5 h-5 text-destructive" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Notificações Push</p>
            <p className="font-medium text-destructive">Bloqueadas no navegador</p>
          </div>
          {showBlockedGuide ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        
        {showBlockedGuide && (
          <div className="px-4 pb-4 pt-2 border-t border-destructive/20">
            <p className="text-sm text-muted-foreground mb-3">
              Para ativar as notificações, você precisa desbloquear no seu navegador:
            </p>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">1</span>
                <span>Toque no ícone de <strong>cadeado</strong> ou <strong>configurações</strong> na barra de endereço</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">2</span>
                <span>Procure por <strong>"Notificações"</strong> ou <strong>"Permissões do site"</strong></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">3</span>
                <span>Mude de <strong>"Bloqueado"</strong> para <strong>"Permitir"</strong></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">4</span>
                <span>Recarregue a página e volte aqui</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-2"
                onClick={() => {
                  // Força um refresh para detectar se o usuário desbloqueou
                  window.location.reload();
                }}
              >
                <ExternalLink className="w-4 h-4" />
                Recarregar página
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Após desbloquear, a opção de ativar aparecerá automaticamente.
            </p>
          </div>
        )}
      </div>
    );
  }

  // Row variant - mostrar como botão se pode ativar
  if (canActivate) {
    return (
      <Button
        variant="outline"
        onClick={handleActivate}
        disabled={isActivating}
        className="w-full justify-start gap-4 p-3 h-auto rounded-xl border-dashed border-2 border-primary/30 hover:border-primary hover:bg-primary/5"
      >
        <BellOff className="w-5 h-5 text-muted-foreground" />
        <div className="flex-1 text-left">
          <p className="text-xs text-muted-foreground">Notificações Push</p>
          <p className="font-medium text-primary">
            {isActivating ? 'Ativando...' : activateText}
          </p>
        </div>
        <span className="w-2 h-2 rounded-full bg-status-searching animate-pulse" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-4 p-3 bg-secondary rounded-xl">
      {isEnabled ? (
        <Bell className="w-5 h-5 text-status-finished" />
      ) : (
        <BellOff className="w-5 h-5 text-muted-foreground" />
      )}
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">Notificações Push</p>
        <div className="flex items-center gap-2">
          <p className="font-medium">{statusText}</p>
          <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-status-finished' : 'bg-muted'}`} />
        </div>
      </div>
    </div>
  );
}
