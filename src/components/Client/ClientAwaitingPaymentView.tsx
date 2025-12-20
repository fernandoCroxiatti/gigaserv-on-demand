import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { MapView } from '../Map/MapView';
import { Button } from '../ui/button';
import { 
  CreditCard, 
  Check, 
  Star, 
  Clock, 
  Shield, 
  Lock,
  Loader2,
  AlertCircle,
  Car,
  Smartphone,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { PaymentMethod } from '@/types/chamado';
import type { Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getStripePromise } from '@/lib/stripe';
import { WalletPaymentForm } from './WalletPaymentForm';

type ExtendedPaymentMethod = PaymentMethod | 'wallet' | 'saved_card';

interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  exp_month?: number;
  exp_year?: number;
}

const basePaymentMethods: { id: ExtendedPaymentMethod; name: string; icon: React.ElementType; description: string; available: boolean; walletOnly?: boolean }[] = [
  { id: 'wallet', name: 'Apple Pay / Google Pay', icon: Smartphone, description: 'Carteira digital', available: true, walletOnly: true },
  { id: 'credit_card', name: 'Cartão de crédito/débito', icon: CreditCard, description: 'Pagamento seguro', available: true },
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
  
  // Saved cards state
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [loadingSavedCards, setLoadingSavedCards] = useState(true);
  const [selectedSavedCard, setSelectedSavedCard] = useState<string | null>(null);
  const [showSavedCards, setShowSavedCards] = useState(false);
  const [payingWithSavedCard, setPayingWithSavedCard] = useState(false);

  useEffect(() => {
    setStripePromise(getStripePromise());
  }, []);

  // Fetch saved cards on mount
  useEffect(() => {
    const fetchSavedCards = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('list-payment-methods');
        if (!error && data?.payment_methods) {
          setSavedCards(data.payment_methods);
          // If user has saved cards, auto-select the first one
          if (data.payment_methods.length > 0) {
            setSelectedSavedCard(data.payment_methods[0].id);
            setShowSavedCards(true);
          }
        }
      } catch (err) {
        console.error('Error fetching saved cards:', err);
      } finally {
        setLoadingSavedCards(false);
      }
    };
    fetchSavedCards();
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

  // Pay with saved card
  const handlePayWithSavedCard = async () => {
    if (!chamado?.id || !selectedSavedCard) return;
    
    setPayingWithSavedCard(true);
    setPaymentError(null);

    try {
      const { data, error } = await supabase.functions.invoke('pay-with-saved-card', {
        body: {
          chamado_id: chamado.id,
          payment_method_id: selectedSavedCard,
        },
      });

      if (error) {
        console.error('Error paying with saved card:', error);
        setPaymentError('Erro ao processar pagamento. Tente novamente.');
        return;
      }

      if (data?.error) {
        setPaymentError(data.error);
        return;
      }

      // Check if 3D Secure is required
      if (data?.requires_action && data?.client_secret) {
        // Need to handle 3D Secure
        const stripe = await stripePromise;
        if (!stripe) {
          setPaymentError('Erro ao carregar Stripe');
          return;
        }

        const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(data.client_secret);
        
        if (confirmError) {
          setPaymentError(confirmError.message || 'Erro na autenticação');
          return;
        }

        if (paymentIntent?.status === 'succeeded') {
          handlePaymentSuccess();
        }
      } else if (data?.success) {
        // Payment succeeded immediately
        handlePaymentSuccess();
      }
    } catch (err) {
      console.error('Error:', err);
      setPaymentError('Erro ao conectar com servidor de pagamentos');
    } finally {
      setPayingWithSavedCard(false);
    }
  };

  const createPaymentIntent = useCallback(async (paymentMethod: ExtendedPaymentMethod) => {
    if (!chamado?.id) return;

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
                <p className="text-sm font-medium text-status-searching">Pagamento seguro e protegido</p>
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

          {/* Saved Cards Section */}
          {savedCards.length > 0 && (
            <div className="p-4 border-b border-border">
              <button
                onClick={() => setShowSavedCards(!showSavedCards)}
                className="w-full flex items-center justify-between mb-3"
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  <span className="font-medium">Cartões salvos</span>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {savedCards.length}
                  </span>
                </div>
                {showSavedCards ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </button>

              {showSavedCards && (
                <div className="space-y-2">
                  {savedCards.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => setSelectedSavedCard(card.id)}
                      disabled={payingWithSavedCard}
                      className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all ${
                        selectedSavedCard === card.id
                          ? 'bg-primary/10 border-2 border-primary'
                          : 'bg-secondary border-2 border-transparent'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        selectedSavedCard === card.id ? 'bg-primary text-primary-foreground' : 'bg-background'
                      }`}>
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium capitalize">{card.brand}</p>
                        <p className="text-sm text-muted-foreground">
                          **** {card.last4}
                          {card.exp_month && card.exp_year && (
                            <span className="ml-2">
                              {String(card.exp_month).padStart(2, '0')}/{String(card.exp_year).slice(-2)}
                            </span>
                          )}
                        </p>
                      </div>
                      {selectedSavedCard === card.id && (
                        <Check className="w-5 h-5 text-primary" />
                      )}
                    </button>
                  ))}

                  {/* Pay with saved card button */}
                  <Button
                    onClick={handlePayWithSavedCard}
                    disabled={!selectedSavedCard || payingWithSavedCard}
                    className="w-full mt-3"
                    size="lg"
                  >
                    {payingWithSavedCard ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processando pagamento...
                      </>
                    ) : (
                      <>
                        <Lock className="w-5 h-5" />
                        Pagar R$ {chamado.valor?.toFixed(2)} com cartão salvo
                      </>
                    )}
                  </Button>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">ou pague com</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

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
