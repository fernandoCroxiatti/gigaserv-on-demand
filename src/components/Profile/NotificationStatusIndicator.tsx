import React from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useNotificationStatus } from '@/hooks/useNotificationStatus';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface NotificationStatusIndicatorProps {
  showLabel?: boolean;
  variant?: 'row' | 'badge';
}

export function NotificationStatusIndicator({ 
  showLabel = true, 
  variant = 'row' 
}: NotificationStatusIndicatorProps) {
  const { isEnabled, browserPermission, loading } = useNotificationStatus();

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
  
  if (!isEnabled) {
    if (browserPermission === 'denied') {
      statusText = 'Bloqueadas';
      statusColor = 'bg-destructive text-destructive-foreground';
    } else if (browserPermission === 'unsupported') {
      statusText = 'Indisponível';
      statusColor = 'bg-muted text-muted-foreground';
    } else {
      statusText = 'Desativadas';
      statusColor = 'bg-status-searching text-white';
    }
  }

  if (variant === 'badge') {
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
