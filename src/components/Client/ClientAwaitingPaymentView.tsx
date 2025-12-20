import React, { useState, useEffect, useCallback } from 'react';
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
  AlertCircle,
  Car,
  Smartphone
} from 'lucide-react';
import { PaymentMethod } from '@/types/chamado';
import type { Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getStripePromise } from '@/lib/stripe';
import { WalletPaymentForm } from './WalletPaymentForm';

type ExtendedPaymentMethod = PaymentMethod | 'wallet';

const basePaymentMethods: { id: ExtendedPaymentMethod; name: string; icon: React.ElementType; description: string; available: boolean; walletOnly?: boolean }[] = [
  { id: 'wallet', name: 'Apple Pay / Google Pay', icon: Smartphone, description: 'Carteira digital', available: true, walletOnly: true },
  { id: 'credit_card', name: 'Cartão de crédito/débito', icon: CreditCard, description: 'Pagamento via Stripe', available: true },
  { id: 'pix', name: 'PIX', icon: Wallet, description: 'Pagamento instantâneo', available: true },
  { id: 'cash', name: 'Dinheiro', icon: Banknote, description: 'Pagar ao prestador (em breve)', available: false },
];

function CardPaymentForm({ 
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

type PixFlowState = 'generating' | 'redirecting' | 'awaiting_return' | 'confirming' | 'confirmed' | 'error';

// PIX Checkout Flow Component - Full UX with state management
function PixCheckoutFlow({
  chamadoId,
  onError,
  onSuccess,
  amount,
}: {
  chamadoId: string;
  onError: (error: string) => void;
  onSuccess: () => void;
  amount: number;
}) {
  const [flowState, setFlowState] = useState<PixFlowState>('generating');
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check URL params for return from Stripe Checkout
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pixSuccess = urlParams.get('pix_success');
    const pixCanceled = urlParams.get('pix_canceled');
    const returnedChamadoId = urlParams.get('chamado_id');

    // If returning from Stripe Checkout
    if (returnedChamadoId === chamadoId) {
      if (pixSuccess === 'true') {
        // User returned from successful checkout - now wait for webhook confirmation
        setFlowState('confirming');
        // Clean URL params
        window.history.replaceState({}, '', window.location.pathname);
      } else if (pixCanceled === 'true') {
        // User canceled checkout
        setFlowState('generating');
        // Clean URL params
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [chamadoId]);

  // Listen to realtime updates for payment confirmation via webhook
  useEffect(() => {
    if (flowState !== 'confirming' && flowState !== 'awaiting_return') return;

    const channel = supabase
      .channel(`pix-payment-confirm-${chamadoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chamados',
          filter: `id=eq.${chamadoId}`,
        },
        (payload) => {
          const newData = payload.new as any;
          
          // Payment confirmed via webhook
          if (newData.payment_status === 'paid_stripe' && newData.status === 'in_service') {
            setFlowState('confirmed');
            setTimeout(() => {
              onSuccess();
            }, 2000); // Show confirmation for 2 seconds before proceeding
          }
          
          // Payment failed
          if (newData.payment_status === 'failed') {
            setFlowState('error');
            setErrorMessage('Pagamento falhou. Tente novamente.');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chamadoId, flowState, onSuccess]);

  // Poll for payment status as fallback (in case realtime misses it)
  useEffect(() => {
    if (flowState !== 'confirming') return;

    const checkStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('check-payment-status', {
          body: { chamado_id: chamadoId },
        });

        if (!error && data?.is_confirmed) {
          setFlowState('confirmed');
          setTimeout(() => {
            onSuccess();
          }, 2000);
        }
      } catch (err) {
        console.log('Status check error:', err);
      }
    };

    // Check immediately and then every 3 seconds
    checkStatus();
    const interval = setInterval(checkStatus, 3000);

    // Stop polling after 2 minutes
    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 120000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [chamadoId, flowState, onSuccess]);

  // Create checkout session and open in new tab
  const createCheckout = useCallback(async () => {
    setFlowState('generating');
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke('create-pix-checkout', {
        body: { chamado_id: chamadoId },
      });

      if (error) {
        setFlowState('error');
        setErrorMessage('Erro ao criar sessão de pagamento PIX');
        onError('Erro ao criar sessão de pagamento PIX');
        return;
      }

      if (data?.error_code === 'pix_not_enabled') {
        setFlowState('error');
        setErrorMessage('PIX não está disponível no momento. Por favor, use cartão de crédito.');
        onError('PIX não está disponível no momento. Por favor, use cartão de crédito.');
        return;
      }

      if (data?.error) {
        setFlowState('error');
        setErrorMessage(data.error);
        onError(data.error);
        return;
      }

      if (data?.checkout_url) {
        setCheckoutUrl(data.checkout_url);
        setFlowState('redirecting');
        
        // Small delay to show redirecting state
        setTimeout(() => {
          setFlowState('awaiting_return');
          // Open checkout - user will return via success_url
          window.location.href = data.checkout_url;
        }, 1000);
      } else {
        setFlowState('error');
        setErrorMessage('URL de checkout não recebida');
        onError('URL de checkout não recebida');
      }
    } catch (err) {
      setFlowState('error');
      setErrorMessage('Erro ao iniciar pagamento PIX');
      onError('Erro ao iniciar pagamento PIX');
    }
  }, [chamadoId, onError]);

  // Start checkout on mount
  useEffect(() => {
    // Don't start if already in confirming state (returned from Stripe)
    if (flowState === 'confirming' || flowState === 'confirmed') return;
    
    // Check if we're returning from checkout
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('pix_success') || urlParams.get('pix_canceled')) return;

    createCheckout();
  }, []); // Only run once on mount

  // Render based on flow state
  const renderContent = () => {
    switch (flowState) {
      case 'generating':
        return (
          <>
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
            <p className="text-lg font-medium">Gerando PIX...</p>
            <p className="text-sm text-muted-foreground text-center">
              Preparando sua sessão de pagamento segura
            </p>
          </>
        );

      case 'redirecting':
        return (
          <>
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
            <p className="text-lg font-medium">Abrindo página de pagamento...</p>
            <p className="text-sm text-muted-foreground text-center">
              Você será redirecionado para a página segura de pagamento
            </p>
          </>
        );

      case 'awaiting_return':
        return (
          <>
            <div className="w-16 h-16 bg-status-searching/10 rounded-full flex items-center justify-center">
              <Wallet className="w-8 h-8 text-status-searching" />
            </div>
            <p className="text-lg font-medium">Aguardando pagamento...</p>
            <p className="text-sm text-muted-foreground text-center">
              Complete o pagamento PIX e retorne aqui
            </p>
            <Button 
              variant="outline" 
              onClick={() => checkoutUrl && window.open(checkoutUrl, '_blank')}
              className="mt-4"
            >
              Reabrir página de pagamento
            </Button>
          </>
        );

      case 'confirming':
        return (
          <>
            <div className="w-16 h-16 bg-status-searching/10 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-status-searching" />
            </div>
            <p className="text-lg font-medium">Confirmando pagamento...</p>
            <p className="text-sm text-muted-foreground text-center">
              Verificando confirmação do seu banco
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 bg-status-searching rounded-full animate-pulse" />
              <span>Aguardando confirmação bancária</span>
            </div>
          </>
        );

      case 'confirmed':
        return (
          <>
            <div className="w-16 h-16 bg-status-finished/20 rounded-full flex items-center justify-center">
              <Check className="w-10 h-10 text-status-finished" />
            </div>
            <p className="text-lg font-semibold text-status-finished">Pagamento confirmado!</p>
            <p className="text-sm text-muted-foreground text-center">
              O serviço será iniciado em instantes
            </p>
          </>
        );

      case 'error':
        return (
          <>
            <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-destructive" />
            </div>
            <p className="text-lg font-semibold text-destructive">Erro no pagamento</p>
            <p className="text-sm text-muted-foreground text-center">
              {errorMessage || 'Ocorreu um erro. Tente novamente.'}
            </p>
            <Button onClick={createCheckout} className="mt-4">
              Tentar novamente
            </Button>
          </>
        );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-4">
      {renderContent()}
      
      {/* Always show amount */}
      {flowState !== 'confirmed' && flowState !== 'error' && (
        <div className="p-4 bg-secondary rounded-xl text-center mt-4">
          <p className="text-sm text-muted-foreground">Valor a pagar</p>
          <p className="text-2xl font-bold">R$ {(amount / 100).toFixed(2)}</p>
        </div>
      )}

      {/* Security badge */}
      {(flowState === 'generating' || flowState === 'redirecting') && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-4">
          <Shield className="w-4 h-4" />
          <span>Transação segura e criptografada</span>
        </div>
      )}
    </div>
  );
}


export function ClientAwaitingPaymentView() {
  const { chamado, availableProviders, processPayment, cancelChamado } = useApp();
  const [selectedPayment, setSelectedPayment] = useState<ExtendedPaymentMethod>('credit_card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState<ExtendedPaymentMethod | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [walletAvailable, setWalletAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    setStripePromise(getStripePromise());
  }, []);

  // Filter payment methods based on wallet availability
  const paymentMethods = basePaymentMethods
    .filter((method) => {
      if (method.walletOnly) {
        return walletAvailable === true;
      }
      return true;
    });

  const provider = availableProviders.find(p => p.id === chamado?.prestadorId);

  const createPaymentIntent = useCallback(async (paymentMethod: ExtendedPaymentMethod) => {
    if (!chamado?.id) return;

    // PIX now uses Stripe Checkout - no need to create PaymentIntent here
    if (paymentMethod === 'pix') {
      setCurrentPaymentMethod('pix');
      setPaymentAmount(Math.round((chamado.valor || 0) * 100));
      setLoadingPayment(false);
      return;
    }

    setLoadingPayment(true);
    setPaymentError(null);
    setClientSecret(null);

    // For wallet payments, use 'card' as the payment method type (Apple Pay/Google Pay use card rails)
    const paymentMethodType = 'card';

    try {
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          chamado_id: chamado.id,
          payment_method_type: paymentMethodType,
        },
      });

      // Function-level error (non-2xx)
      if (error) {
        console.error('Error creating payment intent:', error);
        setPaymentError('Erro ao preparar pagamento. Tente novamente.');
        return;
      }

      // App-level error (2xx but with error payload)
      if (data?.error) {
        setPaymentError(data.error);
        return;
      }

      if (data?.client_secret) {
        setClientSecret(data.client_secret);
        setPaymentAmount(data.amount);
        setCurrentPaymentMethod(paymentMethod);
      }
    } catch (err) {
      console.error('Error:', err);
      setPaymentError('Erro ao conectar com servidor de pagamentos');
    } finally {
      setLoadingPayment(false);
    }
  }, [chamado?.id, chamado?.valor]);

  // Check wallet availability on mount
  useEffect(() => {
    const checkWalletAvailability = async () => {
      const stripe = await stripePromise;
      if (!stripe) return;

      try {
        const pr = stripe.paymentRequest({
          country: 'BR',
          currency: 'brl',
          total: {
            label: 'GigaSOS - Verificação',
            amount: 100, // dummy amount for check
          },
        });

        const result = await pr.canMakePayment();
        console.log('Wallet availability check:', result);
        setWalletAvailable(!!result);
        
        // If wallet is available, auto-select it for better UX
        if (result && walletAvailable === null) {
          setSelectedPayment('wallet');
        }
      } catch (err) {
        console.log('Wallet check error:', err);
        setWalletAvailable(false);
      }
    };

    if (stripePromise && walletAvailable === null) {
      checkWalletAvailability();
    }
  }, [stripePromise, walletAvailable]);

  useEffect(() => {
    if (chamado?.id) {
      createPaymentIntent(selectedPayment);
    }
  }, [chamado?.id]);

  // When payment method changes, create new payment intent
  const handlePaymentMethodChange = (method: ExtendedPaymentMethod) => {
    if (method === selectedPayment) return;
    setSelectedPayment(method);
    createPaymentIntent(method);
  };

  // Handle wallet not available - fallback to card
  const handleWalletNotAvailable = useCallback(() => {
    setWalletAvailable(false);
    // If wallet was selected, switch to card
    if (selectedPayment === 'wallet') {
      setSelectedPayment('credit_card');
      createPaymentIntent('credit_card');
    }
  }, [selectedPayment, createPaymentIntent]);

  // Handle wallet available detection
  const handleWalletAvailable = useCallback(() => {
    if (walletAvailable === null) {
      setWalletAvailable(true);
    }
  }, [walletAvailable]);

  // For PIX: Don't call processPayment - the webhook handles status update
  // For Card/Wallet: The webhook also handles it, but we can show success immediately
  const handlePaymentSuccess = () => {
    toast.success('Pagamento confirmado! O serviço será iniciado.');
    // Don't call processPayment() - the webhook will update the status to 'in_service'
    // The realtime subscription in AppContext will automatically update the chamado state
  };

  const handlePaymentError = (error: string) => {
    toast.error(error);
    setPaymentError(error);
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
                {provider?.vehiclePlate && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Car className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                      {provider.vehiclePlate}
                    </span>
                  </div>
                )}
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
                  onClick={() => method.available && handlePaymentMethodChange(method.id)}
                  disabled={!method.available || isProcessing || loadingPayment}
                  className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all ${
                    selectedPayment === method.id
                      ? 'bg-primary/10 border-2 border-primary'
                      : 'bg-secondary border-2 border-transparent'
                  } ${!method.available ? 'opacity-50 cursor-not-allowed' : ''}`}
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

          {/* Payment Form */}
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

            {/* Card Payment */}
            {clientSecret && !loadingPayment && currentPaymentMethod === 'credit_card' && (
              stripePromise ? (
                <Elements 
                  stripe={stripePromise} 
                  options={{ 
                    clientSecret,
                    appearance: {
                      theme: 'stripe',
                      variables: {
                        colorPrimary: 'hsl(var(--primary))',
                      },
                    },
                  }}
                >
                  <CardPaymentForm 
                    clientSecret={clientSecret}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                    amount={paymentAmount}
                  />
                </Elements>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )
            )}

            {/* PIX Payment - Full Checkout Flow with UX states */}
            {!loadingPayment && currentPaymentMethod === 'pix' && chamado && (
              <PixCheckoutFlow
                chamadoId={chamado.id}
                onError={handlePaymentError}
                onSuccess={handlePaymentSuccess}
                amount={paymentAmount || Math.round((chamado.valor || 0) * 100)}
              />
            )}

            {/* Wallet Payment (Apple Pay / Google Pay) */}
            {clientSecret && !loadingPayment && currentPaymentMethod === 'wallet' && (
              stripePromise ? (
                <Elements 
                  stripe={stripePromise} 
                  options={{ 
                    clientSecret,
                    appearance: {
                      theme: 'stripe',
                      variables: {
                        colorPrimary: 'hsl(var(--primary))',
                      },
                    },
                  }}
                >
                  <WalletPaymentForm 
                    clientSecret={clientSecret}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                    amount={paymentAmount}
                    onNotAvailable={handleWalletNotAvailable}
                  />
                </Elements>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              )
            )}

            {!clientSecret && !loadingPayment && paymentError && (
              <Button 
                onClick={() => createPaymentIntent(selectedPayment)}
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
