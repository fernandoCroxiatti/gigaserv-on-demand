import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { MapView } from '../Map/MapView';
import { Button } from '../ui/button';
import { CreditCard, Wallet, Banknote, Check, Star, Clock, MapPin } from 'lucide-react';

const paymentMethods = [
  { id: 'pix', name: 'PIX', icon: Wallet, description: 'Pagamento instantâneo' },
  { id: 'card', name: 'Cartão de crédito', icon: CreditCard, description: '•••• 4242' },
  { id: 'cash', name: 'Dinheiro', icon: Banknote, description: 'Pagar ao prestador' },
];

export function ClientConfirmedView() {
  const { chamado, availableProviders, setChamadoStatus } = useApp();
  const [selectedPayment, setSelectedPayment] = React.useState('pix');

  if (!chamado) return null;

  const provider = availableProviders.find(p => p.id === chamado.prestadorId);

  const handleConfirmPayment = () => {
    setChamadoStatus('in_service');
  };

  return (
    <div className="relative h-full">
      {/* Map with route */}
      <MapView 
        origem={chamado.origem}
        destino={chamado.destino}
        showRoute
        className="absolute inset-0" 
      />

      {/* Bottom payment panel */}
      <div className="absolute bottom-0 left-0 right-0 z-10 animate-slide-up">
        <div className="bg-card rounded-t-3xl shadow-uber-lg">
          {/* Status header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-status-accepted/10 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-status-accepted" />
              </div>
              <div>
                <h3 className="font-semibold">Valor confirmado!</h3>
                <p className="text-sm text-muted-foreground">Escolha a forma de pagamento</p>
              </div>
            </div>
          </div>

          {/* Provider info */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-4">
              <img 
                src={provider?.avatar} 
                alt={provider?.name}
                className="w-12 h-12 rounded-full"
              />
              <div className="flex-1">
                <p className="font-medium">{provider?.name}</p>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Star className="w-3 h-3 text-status-searching fill-current" />
                  <span>{provider?.rating}</span>
                  <span>•</span>
                  <span>{provider?.totalServices} serviços</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">R$ {chamado.valor?.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Valor total</p>
              </div>
            </div>
          </div>

          {/* Trip details */}
          <div className="p-4 border-b border-border">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1">
                <div className="w-2 h-2 bg-primary rounded-full" />
                <div className="w-0.5 h-6 bg-border" />
                <div className="w-2 h-2 bg-foreground rounded-full" />
              </div>
              <div className="flex-1 space-y-2">
                <p className="text-sm truncate">{chamado.origem.address}</p>
                <p className="text-sm truncate">{chamado.destino.address}</p>
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>~15 min</span>
              </div>
            </div>
          </div>

          {/* Payment methods */}
          <div className="p-4 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Forma de pagamento</p>
            {paymentMethods.map((method) => (
              <button
                key={method.id}
                onClick={() => setSelectedPayment(method.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all ${
                  selectedPayment === method.id
                    ? 'bg-primary/10 border-2 border-primary'
                    : 'bg-secondary border-2 border-transparent'
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selectedPayment === method.id ? 'bg-primary text-primary-foreground' : 'bg-background'
                }`}>
                  <method.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">{method.name}</p>
                  <p className="text-sm text-muted-foreground">{method.description}</p>
                </div>
                {selectedPayment === method.id && (
                  <Check className="w-5 h-5 text-primary" />
                )}
              </button>
            ))}
          </div>

          {/* Confirm button */}
          <div className="p-4 pt-0">
            <Button onClick={handleConfirmPayment} className="w-full" size="lg">
              Confirmar pagamento
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
