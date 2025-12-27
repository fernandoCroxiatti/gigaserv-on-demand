import React, { useState } from 'react';
import { Bell, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationPermissionModal } from './NotificationPermissionModal';

interface NotificationCTAProps {
  userType: 'client' | 'provider';
  permission: 'default' | 'granted' | 'denied' | 'unsupported';
  onRequestPermission: () => Promise<boolean>;
  onDismiss: () => void;
}

/**
 * CTA persistente para solicitar permissão de notificações
 * 
 * Este componente é exibido quando:
 * - O usuário ainda não concedeu permissão (default)
 * - O usuário não dispensou o CTA recentemente
 * 
 * Fluxo:
 * 1. Usuário clica no CTA → Abre modal de explicação
 * 2. Usuário confirma no modal → Solicita permissão do sistema
 * 3. Sistema mostra popup nativo → Usuário aceita ou recusa
 */
export function NotificationCTA({
  userType,
  permission,
  onRequestPermission,
  onDismiss,
}: NotificationCTAProps) {
  const [showModal, setShowModal] = useState(false);
  const [requesting, setRequesting] = useState(false);

  // Não mostrar se já concedido
  if (permission === 'granted') {
    return null;
  }

  // Mostrar mensagem especial se negado
  if (permission === 'denied') {
    return (
      <div className="flex items-center gap-3 p-3 bg-destructive/10 rounded-xl border border-destructive/20">
        <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-destructive" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-destructive">
            Notificações bloqueadas
          </p>
          <p className="text-xs text-muted-foreground">
            {userType === 'provider' 
              ? 'Você pode perder chamados. Ative nas configurações do seu dispositivo.'
              : 'Ative nas configurações do dispositivo para receber atualizações.'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={onDismiss}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  // CTA principal para solicitar permissão
  const handleCTAClick = () => {
    setShowModal(true);
  };

  const handleConfirm = async () => {
    setShowModal(false);
    setRequesting(true);
    
    try {
      await onRequestPermission();
    } finally {
      setRequesting(false);
    }
  };

  const handleDecline = () => {
    setShowModal(false);
    onDismiss();
  };

  return (
    <>
      <div 
        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all hover:shadow-md ${
          userType === 'provider' 
            ? 'bg-provider-primary/10 border border-provider-primary/20 hover:bg-provider-primary/15' 
            : 'bg-primary/10 border border-primary/20 hover:bg-primary/15'
        }`}
        onClick={handleCTAClick}
      >
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          userType === 'provider' ? 'bg-provider-primary/20' : 'bg-primary/20'
        }`}>
          <Bell className={`w-5 h-5 ${
            userType === 'provider' ? 'text-provider-primary' : 'text-primary'
          } ${!requesting ? 'animate-pulse' : ''}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${
            userType === 'provider' ? 'text-provider-primary' : 'text-primary'
          }`}>
            {userType === 'provider' 
              ? 'Ative as notificações para não perder chamados'
              : 'Ative as notificações para acompanhar seu chamado'}
          </p>
          <p className="text-xs text-muted-foreground">
            Toque aqui para ativar
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <NotificationPermissionModal
        open={showModal}
        onConfirm={handleConfirm}
        onDecline={handleDecline}
        userType={userType}
      />
    </>
  );
}
