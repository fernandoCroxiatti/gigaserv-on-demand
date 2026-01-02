import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useInternalNotifications, InternalNotification } from '@/hooks/useInternalNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

function NotificationItem({ 
  notification, 
  onRead 
}: { 
  notification: InternalNotification; 
  onRead: (id: string) => void;
}) {
  const handleClick = () => {
    if (!notification.isRead) {
      onRead(notification.id);
    }
  };

  const timeAgo = formatDistanceToNow(new Date(notification.criada_em), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <Card 
      className={cn(
        'p-4 cursor-pointer transition-all hover:bg-accent/50',
        !notification.isRead && 'bg-primary/5 border-primary/20'
      )}
      onClick={handleClick}
    >
      <div className="flex gap-3">
        {notification.imagem_url && (
          <div className="flex-shrink-0">
            <img
              src={notification.imagem_url}
              alt=""
              className="w-16 h-16 rounded-lg object-cover bg-muted"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className={cn(
              'text-sm font-medium line-clamp-2',
              !notification.isRead && 'font-semibold'
            )}>
              {notification.titulo}
            </h3>
            {!notification.isRead && (
              <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
            {notification.texto}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-2">
            {timeAgo}
          </p>
        </div>
      </div>
    </Card>
  );
}

export default function InternalNotificationsPage() {
  const navigate = useNavigate();
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    markAsRead,
    markAllAsRead 
  } = useInternalNotifications();

  // Mark all as read when opening the page (optional behavior)
  // Uncomment if you want auto-read on page open:
  // useEffect(() => {
  //   if (notifications.length > 0 && unreadCount > 0) {
  //     markAllAsRead();
  //   }
  // }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Notificações</h1>
              {unreadCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {unreadCount} não {unreadCount === 1 ? 'lida' : 'lidas'}
                </p>
              )}
            </div>
          </div>
          
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs"
            >
              Marcar todas como lidas
            </Button>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="p-4 pb-20">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">Carregando...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <BellOff className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-1">Nenhuma notificação</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Quando houver novidades ou atualizações importantes, você verá aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={markAsRead}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
