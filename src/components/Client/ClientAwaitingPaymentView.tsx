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
  Copy,
  QrCode,
  CheckCircle,
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

interface PixPaymentInfo {
  qrCode: string;
  qrCodeUrl: string;
  expiresAt: Date;
}

type PixStatus = 'generating' | 'waiting' | 'processing' | 'success' | 'expired' | 'failed';

function PixPaymentForm({
  clientSecret,
  onSuccess,
  onError,
  amount,
  chamadoId,
}: {
  clientSecret: string;
  onSuccess: () => void;
  onError: (error: string) => void;
  amount: number;
  chamadoId: string;
}) {
  const [pixInfo, setPixInfo] = useState<PixPaymentInfo | null>(null);
  const [pixStatus, setPixStatus] = useState<PixStatus>('generating');
  const [copied, setCopied] = useState(false);
  const [stripe, setStripe] = useState<Stripe | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // PIX expiration time in minutes
  const PIX_EXPIRATION_MINUTES = 15;

  // Initialize Stripe lazily
  useEffect(() => {
    getStripePromise()
      .then((s) => setStripe(s))
      .catch((e) => {
        setPixStatus('failed');
        onError(e?.message || 'Stripe não configurado');
      });
  }, [onError]);

  // Confirm PIX payment and get QR code
  useEffect(() => {
    if (!stripe || !clientSecret) return;

    const confirmPix = async () => {
      setPixStatus('generating');
      try {
        const { paymentIntent, error } = await stripe.confirmPixPayment(clientSecret, {
          payment_method: {},
        });

        if (error) {
          setPixStatus('failed');
          onError(getPixErrorMessage(error.code || 'unknown'));
          return;
        }

        // Access next_action with type assertion for PIX
        const nextAction = paymentIntent?.next_action as any;
        if (nextAction?.pix_display_qr_code) {
          const pixData = nextAction.pix_display_qr_code;
          const expiresAt = new Date(Date.now() + PIX_EXPIRATION_MINUTES * 60 * 1000);
          setPixInfo({
            qrCode: pixData.data || '',
            qrCodeUrl: pixData.image_url_png || '',
            expiresAt,
          });
          setPixStatus('waiting');
        } else {
          setPixStatus('failed');
          onError('Erro ao gerar QR Code PIX');
        }
      } catch (err) {
        setPixStatus('failed');
        onError('Erro ao iniciar pagamento PIX');
      }
    };

    confirmPix();
  }, [stripe, clientSecret, onError]);

  // Timer for expiration countdown
  useEffect(() => {
    if (!pixInfo || pixStatus !== 'waiting') return;

    const updateTimer = () => {
      const now = new Date();
      const diff = Math.max(0, Math.floor((pixInfo.expiresAt.getTime() - now.getTime()) / 1000));
      setTimeRemaining(diff);

      if (diff === 0 && pixStatus === 'waiting') {
        setPixStatus('expired');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [pixInfo, pixStatus]);

  // Listen to realtime database updates for payment confirmation via webhook
  // This is the CORRECT way - don't poll Stripe directly, wait for webhook to update DB
  useEffect(() => {
    if (!chamadoId || pixStatus === 'expired' || pixStatus === 'success') return;

    const channel = supabase
      .channel(`pix-payment-${chamadoId}`)
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
          
          // Payment confirmed by webhook
          if (newData.payment_status === 'paid_stripe' || newData.status === 'in_service') {
            setPixStatus('success');
            onSuccess();
          }
          
          // Payment failed
          if (newData.payment_status === 'failed') {
            setPixStatus('failed');
            onError('Falha no pagamento. Tente novamente.');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chamadoId, pixStatus, onSuccess, onError]);

  const handleCopyCode = async () => {
    if (!pixInfo?.qrCode) return;
    
    try {
      await navigator.clipboard.writeText(pixInfo.qrCode);
      setCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      toast.error('Erro ao copiar código');
    }
  };

  const handleRetryPix = () => {
    // Reload page to generate new PIX
    window.location.reload();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Status messages
  const getStatusMessage = () => {
    switch (pixStatus) {
      case 'generating':
        return 'Gerando QR Code PIX...';
      case 'waiting':
        return 'Aguardando pagamento do PIX';
      case 'processing':
        return 'Processando pagamento...';
      case 'success':
        return 'Pagamento confirmado com sucesso!';
      case 'expired':
        return 'PIX expirado. Gere um novo pagamento.';
      case 'failed':
        return 'Falha no pagamento. Tente novamente.';
      default:
        return 'Aguardando...';
    }
  };

  if (pixStatus === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Gerando QR Code PIX...</p>
      </div>
    );
  }

  if (pixStatus === 'success') {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <div className="w-16 h-16 bg-status-finished/20 rounded-full flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-status-finished" />
        </div>
        <p className="text-lg font-semibold text-status-finished">Pagamento confirmado!</p>
        <p className="text-sm text-muted-foreground text-center">
          O serviço será iniciado em instantes.
        </p>
      </div>
    );
  }

  if (pixStatus === 'expired') {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <div className="w-16 h-16 bg-status-searching/20 rounded-full flex items-center justify-center">
          <Clock className="w-10 h-10 text-status-searching" />
        </div>
        <p className="text-lg font-semibold text-status-searching">PIX expirado</p>
        <p className="text-sm text-muted-foreground text-center">
          O tempo para pagamento expirou. Gere um novo QR Code para continuar.
        </p>
        <Button onClick={handleRetryPix} className="w-full">
          Gerar novo PIX
        </Button>
      </div>
    );
  }

  if (pixStatus === 'failed' || !pixInfo) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center">
          <AlertCircle className="w-10 h-10 text-destructive" />
        </div>
        <p className="text-lg font-semibold text-destructive">Falha no pagamento</p>
        <p className="text-sm text-muted-foreground text-center">
          Não foi possível processar o PIX. Tente outro método de pagamento.
        </p>
        <Button onClick={handleRetryPix} variant="outline" className="w-full">
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status indicator */}
      <div className="flex items-center justify-center gap-2 p-2 bg-status-searching/10 rounded-lg">
        <Loader2 className="w-4 h-4 animate-spin text-status-searching" />
        <span className="text-sm font-medium text-status-searching">{getStatusMessage()}</span>
      </div>

      {/* QR Code */}
      <div className="flex flex-col items-center p-6 bg-white rounded-xl">
        {pixInfo.qrCodeUrl ? (
          <img 
            src={pixInfo.qrCodeUrl} 
            alt="QR Code PIX" 
            className="w-48 h-48"
          />
        ) : (
          <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center">
            <QrCode className="w-16 h-16 text-muted-foreground" />
          </div>
        )}
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Escaneie o QR Code com o app do seu banco
        </p>
      </div>

      {/* Expiration timer */}
      <div className="flex items-center justify-center gap-2 text-sm">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <span className="text-muted-foreground">
          Expira em: <span className={`font-mono font-semibold ${timeRemaining < 120 ? 'text-destructive' : 'text-foreground'}`}>
            {formatTime(timeRemaining)}
          </span>
        </span>
      </div>

      {/* Copy Code */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground text-center">
          Ou copie o código PIX
        </p>
        <Button 
          variant="outline" 
          className="w-full" 
          onClick={handleCopyCode}
        >
          {copied ? (
            <>
              <CheckCircle className="w-4 h-4 mr-2 text-status-finished" />
              Código copiado!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" />
              Copiar código PIX
            </>
          )}
        </Button>
      </div>

      {/* Amount and status */}
      <div className="p-4 bg-secondary rounded-xl text-center space-y-2">
        <p className="text-sm text-muted-foreground">Valor a pagar</p>
        <p className="text-2xl font-bold">R$ {(amount / 100).toFixed(2)}</p>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Aguardando confirmação do pagamento...</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        O serviço será liberado automaticamente após a confirmação do pagamento pelo seu banco.
      </p>
    </div>
  );
}

// Helper function for PIX error messages
function getPixErrorMessage(errorCode: string): string {
  const errorMessages: Record<string, string> = {
    'payment_intent_unexpected_state': 'Pagamento já foi processado ou expirou.',
    'expired_card': 'Método de pagamento expirado.',
    'processing_error': 'Erro ao processar. Tente novamente.',
    'insufficient_funds': 'Saldo insuficiente.',
  };
  return errorMessages[errorCode] || 'Erro ao processar PIX. Tente novamente.';
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
  const [pixAvailable, setPixAvailable] = useState(true);

  useEffect(() => {
    setStripePromise(getStripePromise());
  }, []);

  // Filter payment methods based on wallet availability + PIX availability
  const paymentMethods = basePaymentMethods
    .filter((method) => {
      if (method.walletOnly) {
        return walletAvailable === true;
      }
      return true;
    })
    .map((method) => {
      if (method.id === 'pix' && !pixAvailable) {
        return {
          ...method,
          available: false,
          description: 'Indisponível no momento',
        };
      }
      return method;
    });

  const provider = availableProviders.find(p => p.id === chamado?.prestadorId);

  const createPaymentIntent = useCallback(async (paymentMethod: ExtendedPaymentMethod) => {
    if (!chamado?.id) return;

    setLoadingPayment(true);
    setPaymentError(null);
    setClientSecret(null);

    // For wallet payments, use 'card' as the payment method type (Apple Pay/Google Pay use card rails)
    const paymentMethodType = paymentMethod === 'pix' ? 'pix' : 'card';

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
        const msg = (error as any)?.message || 'Erro ao preparar pagamento. Tente novamente.';

        // If user selected PIX but it's not available, disable it in the UI.
        if (paymentMethod === 'pix' && /\bpix\b/i.test(msg)) {
          setPixAvailable(false);
        }

        setPaymentError('Erro ao preparar pagamento. Tente novamente.');
        return;
      }

      // App-level error (2xx but with error payload)
      if (data?.error) {
        if (data?.error_code === 'pix_not_enabled') {
          setPixAvailable(false);

          // If user selected PIX, automatically fallback to card so they can complete payment
          if (paymentMethod === 'pix') {
            setSelectedPayment('credit_card');
            await createPaymentIntent('credit_card');
            return;
          }
        }

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
  }, [chamado?.id]);

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

            {/* PIX Payment */}
            {clientSecret && !loadingPayment && currentPaymentMethod === 'pix' && chamado && (
              <PixPaymentForm
                clientSecret={clientSecret}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                amount={paymentAmount}
                chamadoId={chamado.id}
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
