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
import { MapPin, Navigation, Shield, Clock } from 'lucide-react';

interface LocationPermissionModalProps {
  open: boolean;
  onConfirm: () => void;
  onDecline: () => void;
  userType: 'client' | 'provider';
  loading?: boolean;
}

export function LocationPermissionModal({
  open,
  onConfirm,
  onDecline,
  userType,
  loading = false
}: LocationPermissionModalProps) {
  const benefits = userType === 'provider' 
    ? [
        {
          icon: Navigation,
          title: 'Receber chamados próximos',
          description: 'Mostramos chamados na sua região'
        },
        {
          icon: Clock,
          title: 'Calcular rotas e tempo',
          description: 'Navegação precisa até o cliente'
        },
        {
          icon: MapPin,
          title: 'Atualização em tempo real',
          description: 'Cliente acompanha sua chegada'
        }
      ]
    : [
        {
          icon: MapPin,
          title: 'Encontrar prestadores próximos',
          description: 'Mostramos quem está perto de você'
        },
        {
          icon: Navigation,
          title: 'Calcular rota e valor',
          description: 'Estimativa precisa do serviço'
        },
        {
          icon: Clock,
          title: 'Tempo de chegada',
          description: 'Acompanhe o prestador em tempo real'
        }
      ];

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" hideCloseButton>
        <DialogHeader className="space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <MapPin className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">
            Permitir acesso à localização?
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            Precisamos da sua localização para {userType === 'provider' 
              ? 'mostrar chamados próximos e calcular rotas.' 
              : 'encontrar prestadores próximos e calcular a rota.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {benefits.map((benefit, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <benefit.icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{benefit.title}</p>
                <p className="text-xs text-muted-foreground">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
          <Shield className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Sua localização é usada apenas durante o uso do app e nunca é compartilhada com terceiros.
          </p>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button 
            onClick={onConfirm} 
            className="w-full" 
            size="lg"
            disabled={loading}
          >
            {loading ? 'Obtendo localização...' : 'Permitir localização'}
          </Button>
          <Button 
            variant="ghost" 
            onClick={onDecline} 
            className="w-full text-muted-foreground"
            disabled={loading}
          >
            Agora não
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
