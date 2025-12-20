import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell, BellRing, Shield } from 'lucide-react';

interface NotificationPermissionModalProps {
  open: boolean;
  onConfirm: () => void;
  onDecline: () => void;
  userType: 'client' | 'provider';
}

export function NotificationPermissionModal({
  open,
  onConfirm,
  onDecline,
  userType
}: NotificationPermissionModalProps) {
  const benefits = userType === 'provider' 
    ? [
        'Receba novos chamados em tempo real',
        'Seja notificado mesmo com o app em segundo plano',
        'Não perca oportunidades de atendimento'
      ]
    : [
        'Acompanhe o status do seu chamado',
        'Saiba quando o prestador estiver a caminho',
        'Receba confirmações importantes'
      ];

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" hideCloseButton>
        <DialogHeader className="space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <BellRing className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <DialogTitle className="text-center text-xl">
            Ative as notificações
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            Ative as notificações para receber atualizações importantes sobre seus chamados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {benefits.map((benefit, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bell className="w-4 h-4 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">{benefit}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
          <Shield className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Você pode desativar as notificações a qualquer momento nas configurações.
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={onConfirm} className="w-full" size="lg">
            Ativar notificações
          </Button>
          <Button 
            variant="ghost" 
            onClick={onDecline} 
            className="w-full text-muted-foreground"
          >
            Agora não
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
