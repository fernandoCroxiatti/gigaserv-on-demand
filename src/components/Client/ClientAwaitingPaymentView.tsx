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
  ChevronUp,
  Banknote,
  AlertTriangle
} from 'lucide-react';
import { PaymentMethod } from '@/types/chamado';
import type { Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getStripePromise } from '@/lib/stripe';
import { WalletPaymentForm } from './WalletPaymentForm';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type ExtendedPaymentMethod = PaymentMethod | 'wallet' | 'saved_card' | 'direct_payment';

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
  { id: 'direct_payment', name: 'PIX / Dinheiro ao prestador', icon: Banknote, description: 'Pague diretamente ao prestador', available: true },
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
  
  // Direct payment dialog state
  const [showDirectPaymentDialog, setShowDirectPaymentDialog] = useState(false);
  const [processingDirectPayment, setProcessingDirectPayment] = useState(false);
  const [commissionPercentage, setCommissionPercentage] = useState<number>(10);

  useEffect(() => {
    setStripePromise(getStripePromise());
  }, []);

  // Fetch saved cards and commission percentage on mount
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

  // Fetch commission percentage
  useEffect(() => {
    const fetchCommissionPercentage = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'app_commission_percentage')
          .single();
        if (data?.value) {
          setCommissionPercentage(Number(data.value));
        }
      } catch (err) {
        console.error('Error fetching commission:', err);
      }
    };
    fetchCommissionPercentage();
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

  // When payment method changes, create new payment intent (only for stripe methods)
  const handlePaymentMethodChange = (method: ExtendedPaymentMethod) => {
    if (method === selectedPayment) return;
    setSelectedPayment(method);
    
    // Only create payment intent for card-based payments
    if (method !== 'direct_payment') {
      createPaymentIntent(method);
    }
  };

  // Handle direct payment to provider
  const handleDirectPaymentClick = () => {
    setShowDirectPaymentDialog(true);
  };

  const handleConfirmDirectPayment = async () => {
    if (!chamado?.id) return;
    
    setProcessingDirectPayment(true);
    try {
      // Update chamado to mark as direct payment
      const { error } = await supabase
        .from('chamados')
        .update({
          direct_payment_to_provider: true,
          payment_method: 'pix',
          payment_status: 'paid_mock',
          payment_completed_at: new Date().toISOString(),
          status: 'in_service',
          navigation_phase: 'to_client',
        })
        .eq('id', chamado.id);

      if (error) throw error;

      // Record the fee for the provider
      await supabase.functions.invoke('record-service-fee', {
        body: { chamado_id: chamado.id }
      });

      toast.success('Pagamento registrado!', {
        description: 'Pague diretamente ao prestador. O serviço foi iniciado.',
        duration: 4000,
      });
      
      setShowDirectPaymentDialog(false);
    } catch (err) {
      console.error('Error processing direct payment:', err);
      toast.error('Erro ao processar. Tente novamente.');
    } finally {
      setProcessingDirectPayment(false);
    }
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

  // For Card/Wallet: The webhook handles status update, but we can show success immediately
  const handlePaymentSuccess = () => {
    toast.success('Pagamento aprovado!', {
      description: 'O serviço será iniciado em instantes.',
      duration: 3000,
    });
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

      {/* Bottom payment panel - compact and premium */}
      <div className="absolute bottom-0 left-0 right-0 z-10 animate-slide-up">
        <div className="bg-card rounded-t-2xl shadow-uber-lg max-h-[80vh] overflow-y-auto">
          {/* Status header - compact */}
          <div className="px-4 py-3 border-b border-border/50 sticky top-0 bg-card z-10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-status-searching/10 rounded-full flex items-center justify-center">
                <Lock className="w-4 h-4 text-status-searching" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm">Pagamento necessário</h3>
                <p className="text-xs text-muted-foreground">Confirme para iniciar</p>
              </div>
            </div>
          </div>

          {/* Provider info - compact */}
          <div className="p-3 border-b border-border/30">
            <div className="flex items-center gap-3">
              <img 
                src={provider?.avatar} 
                alt={provider?.name}
                className="w-10 h-10 rounded-full shadow-sm"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{provider?.name}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="w-2.5 h-2.5 text-status-searching fill-current" />
                  <span>{provider?.rating}</span>
                  <span>•</span>
                  <span>{provider?.totalServices} serviços</span>
                  {provider?.vehiclePlate && (
                    <>
                      <span>•</span>
                      <span className="font-medium text-foreground bg-secondary px-1.5 py-0.5 rounded text-[10px]">
                        {provider.vehiclePlate}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-primary">R$ {chamado.valor?.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">Valor acordado</p>
              </div>
            </div>
          </div>

          {/* Security notice - compact */}
          <div className="px-3 py-2 border-b border-border/30">
            <div className="flex items-center gap-2 p-2 bg-status-searching/10 rounded-lg">
              <Shield className="w-4 h-4 text-status-searching flex-shrink-0" />
              <p className="text-xs text-status-searching font-medium">Pagamento seguro e protegido</p>
            </div>
          </div>

          {/* Trip details - compact */}
          <div className="p-3 border-b border-border/30">
            <div className="flex items-start gap-2">
              <div className="flex flex-col items-center gap-0.5 pt-0.5">
                <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                <div className="w-px h-4 bg-border" />
                <div className="w-1.5 h-1.5 bg-foreground rounded-full" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-xs truncate">{chamado.origem.address}</p>
                <p className="text-xs truncate text-muted-foreground">{chamado.destino?.address || 'Atendimento no local'}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>~15 min</span>
              </div>
            </div>
          </div>

          {/* Saved Cards Section */}
          {savedCards.length > 0 && (
            <div className="p-4 border-b border-border">
              <button
                onClick={() => setShowSavedCards(!showSavedCards)}
                className="w-full flex items-center justify-between mb-2"
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">Cartões salvos</span>
                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                    {savedCards.length}
                  </span>
                </div>
                {showSavedCards ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>

              {showSavedCards && (
                <div className="space-y-1.5">
                  {savedCards.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => setSelectedSavedCard(card.id)}
                      disabled={payingWithSavedCard}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all ${
                        selectedSavedCard === card.id
                          ? 'bg-primary/10 border border-primary'
                          : 'bg-secondary/80 border border-transparent'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        selectedSavedCard === card.id ? 'bg-primary text-primary-foreground' : 'bg-background'
                      }`}>
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-medium text-sm capitalize">{card.brand}</p>
                        <p className="text-xs text-muted-foreground">
                          •••• {card.last4}
                          {card.exp_month && card.exp_year && (
                            <span className="ml-1.5">
                              {String(card.exp_month).padStart(2, '0')}/{String(card.exp_year).slice(-2)}
                            </span>
                          )}
                        </p>
                      </div>
                      {selectedSavedCard === card.id && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </button>
                  ))}

                  {/* Pay with saved card button */}
                  <Button
                    onClick={handlePayWithSavedCard}
                    disabled={!selectedSavedCard || payingWithSavedCard}
                    className="w-full mt-2 h-11"
                  >
                    {payingWithSavedCard ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        Pagar R$ {chamado.valor?.toFixed(2)}
                      </>
                    )}
                  </Button>

                  <div className="relative my-3">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border/50" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase">
                      <span className="bg-card px-2 text-muted-foreground">ou pague com</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payment methods selection - compact */}
          <div className="p-3 border-b border-border/30">
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Forma de pagamento</p>
            <div className="space-y-1.5">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => method.available && handlePaymentMethodChange(method.id)}
                  disabled={!method.available || isProcessing || loadingPayment}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all ${
                    selectedPayment === method.id
                      ? 'bg-primary/10 border border-primary'
                      : 'bg-secondary/80 border border-transparent'
                  } ${!method.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    selectedPayment === method.id ? 'bg-primary text-primary-foreground' : 'bg-background'
                  }`}>
                    <method.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-sm">{method.name}</p>
                    <p className="text-xs text-muted-foreground">{method.description}</p>
                  </div>
                  {selectedPayment === method.id && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Form - compact - CONDITIONAL RENDERING */}
          <div className="p-3 space-y-3">
            {paymentError && (
              <div className="flex items-center gap-2 p-2 bg-destructive/10 text-destructive rounded-lg text-xs">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {paymentError}
              </div>
            )}

            {loadingPayment && selectedPayment !== 'direct_payment' && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}

            {/* CARD PAYMENT - Only show when card is selected */}
            {selectedPayment === 'credit_card' && !loadingPayment && (
              <>
                {clientSecret && stripePromise ? (
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
                ) : !paymentError ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : null}
              </>
            )}

            {/* WALLET PAYMENT - Only show when wallet is selected */}
            {selectedPayment === 'wallet' && !loadingPayment && (
              <>
                {clientSecret && stripePromise ? (
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
                ) : !paymentError ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : null}
              </>
            )}

            {/* DIRECT PAYMENT (PIX/CASH) - Only show when direct_payment is selected */}
            {selectedPayment === 'direct_payment' && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-700 dark:text-amber-300">
                    <p className="font-medium">Atenção: Taxa do App</p>
                    <p className="mt-0.5">
                      Ao pagar diretamente ao prestador, será gerada uma taxa de {' '}
                      {!isNaN(commissionPercentage) ? commissionPercentage : 0}% {' '}
                      (R$ {!isNaN(commissionPercentage) && chamado.valor ? ((chamado.valor * commissionPercentage) / 100).toFixed(2) : '0.00'}) {' '}
                      que o prestador deverá pagar ao app.
                    </p>
                  </div>
                </div>
                
                {/* Single CTA button */}
                <Button 
                  onClick={handleDirectPaymentClick}
                  className="w-full h-12"
                  disabled={processingDirectPayment}
                >
                  {processingDirectPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Banknote className="w-4 h-4 mr-2" />
                      Confirmar Pagamento ao Prestador
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Retry button for card/wallet errors */}
            {!clientSecret && !loadingPayment && paymentError && selectedPayment !== 'direct_payment' && (
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
              disabled={isProcessing || loadingPayment || processingDirectPayment}
              className="w-full text-center text-sm text-destructive py-2 disabled:opacity-50"
            >
              Cancelar serviço
            </button>
          </div>
        </div>
      </div>

      {/* Direct Payment Confirmation Dialog */}
      <AlertDialog open={showDirectPaymentDialog} onOpenChange={setShowDirectPaymentDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirmar Pagamento Direto
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Você escolheu pagar <strong>R$ {chamado.valor?.toFixed(2)}</strong> diretamente ao prestador via PIX ou dinheiro.
              </p>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-amber-800 dark:text-amber-200 text-sm font-medium">
                  ⚠️ Uma taxa de {commissionPercentage}% (R$ {((chamado.valor || 0) * commissionPercentage / 100).toFixed(2)}) será gerada para o prestador pagar ao app.
                </p>
              </div>
              <p className="text-sm">
                O serviço será iniciado após confirmar. Pague diretamente ao prestador quando ele chegar.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processingDirectPayment}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDirectPayment}
              disabled={processingDirectPayment}
              className="bg-primary hover:bg-primary/90"
            >
              {processingDirectPayment ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Processando...
                </>
              ) : (
                'Confirmar Pagamento'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
