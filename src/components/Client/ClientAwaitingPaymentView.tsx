import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { MapView } from '../Map/MapView';
import { Button } from '../ui/button';
import { 
  CreditCard, 
  Wallet, 
  Banknote, 
  Check, 
  Star, 
  Clock, 
  Shield, 
  Lock,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { PaymentMethod } from '@/types/chamado';

const paymentMethods: { id: PaymentMethod; name: string; icon: React.ElementType; description: string }[] = [
  { id: 'pix', name: 'PIX', icon: Wallet, description: 'Pagamento instantâneo' },
  { id: 'credit_card', name: 'Cartão de crédito', icon: CreditCard, description: 'Parcele em até 12x' },
  { id: 'debit_card', name: 'Cartão de débito', icon: CreditCard, description: 'Débito automático' },
  { id: 'cash', name: 'Dinheiro', icon: Banknote, description: 'Pagar ao prestador' },
];

export function ClientAwaitingPaymentView() {
  const { chamado, availableProviders, initiatePayment, processPayment, cancelChamado } = useApp();
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('pix');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!chamado) return null;

  const provider = availableProviders.find(p => p.id === chamado.prestadorId);

  const handleSelectPayment = (method: PaymentMethod) => {
    setSelectedPayment(method);
    initiatePayment(method);
  };

  const handleConfirmPayment = async () => {
    setIsProcessing(true);
    
    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Process mock payment
    processPayment();
    setIsProcessing(false);
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
              <div className="w-10 h-10 bg-status-searching/10 rounded-full flex items-center justify-center">
                <Lock className="w-5 h-5 text-status-searching" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Pagamento necessário</h3>
                <p className="text-sm text-muted-foreground">Confirme para iniciar o serviço</p>
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
                <p className="text-xs text-muted-foreground">Valor acordado</p>
              </div>
            </div>
          </div>

          {/* Security notice */}
          <div className="p-4 border-b border-border">
            <div className="flex items-start gap-3 p-3 bg-status-searching/10 rounded-xl">
              <Shield className="w-5 h-5 text-status-searching flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-status-searching">Pagamento seguro</p>
                <p className="text-xs text-muted-foreground">
                  O serviço só será iniciado após a confirmação do pagamento. 
                  Seu dinheiro está protegido.
                </p>
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
          <div className="p-4 space-y-3 max-h-[200px] overflow-y-auto">
            <p className="text-sm font-medium text-muted-foreground">Forma de pagamento</p>
            {paymentMethods.map((method) => (
              <button
                key={method.id}
                onClick={() => handleSelectPayment(method.id)}
                disabled={isProcessing}
                className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all ${
                  selectedPayment === method.id
                    ? 'bg-primary/10 border-2 border-primary'
                    : 'bg-secondary border-2 border-transparent hover:border-border'
                } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
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

          {/* Payment info notice */}
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertCircle className="w-4 h-4" />
              <span>Pagamento será processado de forma segura</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="p-4 pt-2 space-y-3">
            <Button 
              onClick={handleConfirmPayment} 
              disabled={isProcessing}
              className="w-full" 
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processando pagamento...
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  Confirmar pagamento • R$ {chamado.valor?.toFixed(2)}
                </>
              )}
            </Button>
            
            <button 
              onClick={cancelChamado}
              disabled={isProcessing}
              className="w-full text-center text-sm text-destructive py-2 disabled:opacity-50"
            >
              Cancelar serviço
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
