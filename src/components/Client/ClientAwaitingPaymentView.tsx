import React, { useState, useEffect } from 'react';
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
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Initialize Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');

const paymentMethods: { id: PaymentMethod; name: string; icon: React.ElementType; description: string }[] = [
  { id: 'credit_card', name: 'Cartão de crédito/débito', icon: CreditCard, description: 'Pagamento via Stripe' },
  { id: 'pix', name: 'PIX', icon: Wallet, description: 'Pagamento instantâneo (em breve)' },
  { id: 'cash', name: 'Dinheiro', icon: Banknote, description: 'Pagar ao prestador (em breve)' },
];

function PaymentForm({ 
  clientSecret, 
  onSuccess, 
  onError,
  amount 
}: { 
  clientSecret: string; 
  onSuccess: () => void;
  onError: (error: string) => void;
  amount: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/`,
        },
        redirect: 'if_required',
      });

      if (error) {
        onError(error.message || 'Erro no pagamento');
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess();
      }
    } catch (err) {
      onError('Erro ao processar pagamento');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button 
        type="submit" 
        disabled={!stripe || isProcessing}
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
            Pagar R$ {(amount / 100).toFixed(2)}
          </>
        )}
      </Button>
    </form>
  );
}

export function ClientAwaitingPaymentView() {
  const { chamado, availableProviders, processPayment, cancelChamado } = useApp();
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('credit_card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const provider = availableProviders.find(p => p.id === chamado?.prestadorId);

  useEffect(() => {
    if (chamado?.id && selectedPayment === 'credit_card') {
      createPaymentIntent();
    }
  }, [chamado?.id, selectedPayment]);

  const createPaymentIntent = async () => {
    if (!chamado?.id) return;

    setLoadingPayment(true);
    setPaymentError(null);

    try {
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: { chamado_id: chamado.id }
      });

      if (error) {
        console.error('Error creating payment intent:', error);
        setPaymentError('Erro ao preparar pagamento. Tente novamente.');
        return;
      }

      if (data?.error) {
        setPaymentError(data.error);
        return;
      }

      if (data?.client_secret) {
        setClientSecret(data.client_secret);
        setPaymentAmount(data.amount);
      }
    } catch (err) {
      console.error('Error:', err);
      setPaymentError('Erro ao conectar com servidor de pagamentos');
    } finally {
      setLoadingPayment(false);
    }
  };

  const handlePaymentSuccess = () => {
    toast.success('Pagamento confirmado! O serviço será iniciado.');
    processPayment();
  };

  const handlePaymentError = (error: string) => {
    toast.error(error);
    setPaymentError(error);
  };

  const handleMockPayment = async () => {
    setIsProcessing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    processPayment();
    setIsProcessing(false);
  };

  if (!chamado) return null;

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
        <div className="bg-card rounded-t-3xl shadow-uber-lg max-h-[85vh] overflow-y-auto">
          {/* Status header */}
          <div className="p-4 border-b border-border sticky top-0 bg-card z-10">
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
                <p className="text-sm font-medium text-status-searching">Pagamento seguro via Stripe</p>
                <p className="text-xs text-muted-foreground">
                  O prestador recebe automaticamente após a confirmação. Seu dinheiro está protegido.
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
                <p className="text-sm truncate">{chamado.destino?.address || 'Atendimento no local'}</p>
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>~15 min</span>
              </div>
            </div>
          </div>

          {/* Payment methods selection */}
          <div className="p-4 border-b border-border">
            <p className="text-sm font-medium text-muted-foreground mb-3">Forma de pagamento</p>
            <div className="space-y-2">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setSelectedPayment(method.id)}
                  disabled={method.id !== 'credit_card' || isProcessing || loadingPayment}
                  className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all ${
                    selectedPayment === method.id
                      ? 'bg-primary/10 border-2 border-primary'
                      : 'bg-secondary border-2 border-transparent'
                  } ${method.id !== 'credit_card' ? 'opacity-50 cursor-not-allowed' : ''}`}
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
          </div>

          {/* Stripe Payment Form */}
          <div className="p-4 space-y-4">
            {paymentError && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {paymentError}
              </div>
            )}

            {loadingPayment && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}

            {clientSecret && !loadingPayment && selectedPayment === 'credit_card' && (
              <Elements 
                stripe={stripePromise} 
                options={{ 
                  clientSecret,
                  appearance: {
                    theme: 'stripe',
                    variables: {
                      colorPrimary: '#22c55e',
                    }
                  }
                }}
              >
                <PaymentForm 
                  clientSecret={clientSecret}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                  amount={paymentAmount}
                />
              </Elements>
            )}

            {!clientSecret && !loadingPayment && paymentError && (
              <Button 
                onClick={createPaymentIntent}
                className="w-full"
                variant="outline"
              >
                Tentar novamente
              </Button>
            )}
            
            <button 
              onClick={cancelChamado}
              disabled={isProcessing || loadingPayment}
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
