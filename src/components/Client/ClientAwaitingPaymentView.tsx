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
  CheckCircle
} from 'lucide-react';
import { PaymentMethod } from '@/types/chamado';
import type { Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getStripePromise } from '@/lib/stripe';

const paymentMethods: { id: PaymentMethod; name: string; icon: React.ElementType; description: string; available: boolean }[] = [
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

function PixPaymentForm({
  clientSecret,
  onSuccess,
  onError,
  amount,
}: {
  clientSecret: string;
  onSuccess: () => void;
  onError: (error: string) => void;
  amount: number;
}) {
  const [pixInfo, setPixInfo] = useState<PixPaymentInfo | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [stripe, setStripe] = useState<Stripe | null>(null);

  // Initialize Stripe lazily (avoid calling Stripe() with empty key at import time)
  useEffect(() => {
    getStripePromise()
      .then((s) => setStripe(s))
      .catch((e) => onError(e?.message || 'Stripe não configurado'));
  }, [onError]);

  // Confirm PIX payment and get QR code
  useEffect(() => {
    if (!stripe || !clientSecret) return;

    const confirmPix = async () => {
      setIsProcessing(true);
      try {
        const { paymentIntent, error } = await stripe.confirmPixPayment(clientSecret, {
          payment_method: {},
        });

        if (error) {
          onError(error.message || 'Erro ao gerar PIX');
          return;
        }

        // Access next_action with type assertion for PIX
        const nextAction = paymentIntent?.next_action as any;
        if (nextAction?.pix_display_qr_code) {
          const pixData = nextAction.pix_display_qr_code;
          setPixInfo({
            qrCode: pixData.data || '',
            qrCodeUrl: pixData.image_url_png || '',
            expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
          });
        }
      } catch (err) {
        onError('Erro ao iniciar pagamento PIX');
      } finally {
        setIsProcessing(false);
      }
    };

    confirmPix();
  }, [stripe, clientSecret]);

  // Poll for payment confirmation
  useEffect(() => {
    if (!stripe || !clientSecret || !pixInfo) return;

    const interval = setInterval(async () => {
      setChecking(true);
      try {
        const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
        if (paymentIntent?.status === 'succeeded') {
          clearInterval(interval);
          onSuccess();
        }
      } catch (err) {
        console.error('Error checking payment status:', err);
      } finally {
        setChecking(false);
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, [stripe, clientSecret, pixInfo, onSuccess]);

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

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Gerando QR Code PIX...</p>
      </div>
    );
  }

  if (!pixInfo) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <AlertCircle className="w-8 h-8 text-destructive" />
        <p className="text-sm text-muted-foreground">Erro ao gerar PIX. Tente outro método.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
          {checking ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Clock className="w-4 h-4" />
          )}
          <span>Aguardando pagamento...</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        O pagamento será confirmado automaticamente após a transferência
      </p>
    </div>
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
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState<PaymentMethod | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);

  useEffect(() => {
    setStripePromise(getStripePromise());
  }, []);

  const provider = availableProviders.find(p => p.id === chamado?.prestadorId);

  const createPaymentIntent = useCallback(async (paymentMethod: PaymentMethod) => {
    if (!chamado?.id) return;

    setLoadingPayment(true);
    setPaymentError(null);
    setClientSecret(null);

    try {
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: { 
          chamado_id: chamado.id,
          payment_method_type: paymentMethod === 'pix' ? 'pix' : 'card'
        }
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
        setCurrentPaymentMethod(paymentMethod);
      }
    } catch (err) {
      console.error('Error:', err);
      setPaymentError('Erro ao conectar com servidor de pagamentos');
    } finally {
      setLoadingPayment(false);
    }
  }, [chamado?.id]);

  useEffect(() => {
    if (chamado?.id) {
      createPaymentIntent(selectedPayment);
    }
  }, [chamado?.id]);

  // When payment method changes, create new payment intent
  const handlePaymentMethodChange = (method: PaymentMethod) => {
    if (method === selectedPayment) return;
    setSelectedPayment(method);
    createPaymentIntent(method);
  };

  const handlePaymentSuccess = () => {
    toast.success('Pagamento confirmado! O serviço será iniciado.');
    processPayment();
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
            {clientSecret && !loadingPayment && currentPaymentMethod === 'pix' && (
              <PixPaymentForm
                clientSecret={clientSecret}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                amount={paymentAmount}
              />
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
