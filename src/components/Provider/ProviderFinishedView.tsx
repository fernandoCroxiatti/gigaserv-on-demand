import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '../ui/button';
import { Check, DollarSign, Clock, Navigation, TrendingUp } from 'lucide-react';

export function ProviderFinishedView() {
  const { chamado } = useApp();

  if (!chamado) return null;

  return (
    <div className="h-full bg-gradient-to-b from-provider-primary/10 to-background flex flex-col items-center justify-center p-6 provider-theme">
      <div className="w-full max-w-md animate-scale-in">
        {/* Success icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-24 h-24 bg-provider-primary rounded-full flex items-center justify-center">
              <Check className="w-12 h-12 text-white" />
            </div>
            <div className="absolute inset-0 rounded-full border-4 border-provider-primary/30 animate-ping" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Serviço finalizado!</h1>
          <p className="text-muted-foreground">Parabéns pelo trabalho concluído</p>
        </div>

        {/* Earnings card */}
        <div className="bg-card rounded-2xl shadow-uber p-6 mb-6">
          <div className="text-center mb-6">
            <p className="text-sm text-muted-foreground mb-1">Você ganhou</p>
            <div className="flex items-center justify-center gap-2">
              <DollarSign className="w-8 h-8 text-provider-primary" />
              <span className="text-4xl font-bold">R$ {chamado.valor?.toFixed(2)}</span>
            </div>
          </div>

          {/* Service stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center mx-auto mb-2">
                <Navigation className="w-5 h-5 text-provider-primary" />
              </div>
              <p className="text-lg font-semibold">3.5 km</p>
              <p className="text-xs text-muted-foreground">Percorrido</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center mx-auto mb-2">
                <Clock className="w-5 h-5 text-provider-primary" />
              </div>
              <p className="text-lg font-semibold">18 min</p>
              <p className="text-xs text-muted-foreground">Duração</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center mx-auto mb-2">
                <TrendingUp className="w-5 h-5 text-provider-primary" />
              </div>
              <p className="text-lg font-semibold">13</p>
              <p className="text-xs text-muted-foreground">Hoje</p>
            </div>
          </div>
        </div>

        {/* Daily summary */}
        <div className="bg-secondary rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Ganhos do dia</span>
            <span className="text-xl font-bold">R$ 358,00</span>
          </div>
        </div>

        {/* Back button */}
        <Button variant="provider" className="w-full" size="lg">
          Voltar para o mapa
        </Button>
      </div>
    </div>
  );
}
