import React, { useState, useEffect } from 'react';
import { PaymentRequestButtonElement, useStripe, useElements } from '@stripe/react-stripe-js';
import type { PaymentRequest, StripePaymentRequestButtonElementOptions } from '@stripe/stripe-js';
import { Loader2, Smartphone } from 'lucide-react';

interface WalletPaymentFormProps {
  clientSecret: string;
  onSuccess: () => void;
  onError: (error: string) => void;
  amount: number;
  onNotAvailable: () => void;
}

export function WalletPaymentForm({
  clientSecret,
  onSuccess,
  onError,
  amount,
  onNotAvailable,
}: WalletPaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!stripe || !amount) return;

    // Create Payment Request (Apple Pay / Google Pay)
    const pr = stripe.paymentRequest({
      country: 'BR',
      currency: 'brl',
      total: {
        label: 'GigaSOS - Serviço',
        amount: amount, // amount in cents
      },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    // Check if wallet is available on this device
    pr.canMakePayment().then((result) => {
      if (result) {
        console.log('Wallet payment available:', result);
        setPaymentRequest(pr);
        setIsAvailable(true);
      } else {
        console.log('Wallet payment not available');
        setIsAvailable(false);
        onNotAvailable();
      }
    });

    // Handle payment method event
    pr.on('paymentmethod', async (event) => {
      setIsProcessing(true);
      
      try {
        // Confirm the payment with the payment method from wallet
        const { error, paymentIntent } = await stripe.confirmCardPayment(
          clientSecret,
          {
            payment_method: event.paymentMethod.id,
          },
          { handleActions: false }
        );

        if (error) {
          event.complete('fail');
          onError(error.message || 'Erro no pagamento');
          setIsProcessing(false);
          return;
        }

        if (paymentIntent?.status === 'requires_action') {
          // Handle 3D Secure authentication if needed
          const { error: confirmError, paymentIntent: confirmedIntent } = 
            await stripe.confirmCardPayment(clientSecret);
          
          if (confirmError) {
            event.complete('fail');
            onError(confirmError.message || 'Autenticação falhou');
            setIsProcessing(false);
            return;
          }
          
          if (confirmedIntent?.status === 'succeeded') {
            event.complete('success');
            onSuccess();
          }
        } else if (paymentIntent?.status === 'succeeded') {
          event.complete('success');
          onSuccess();
        } else {
          event.complete('fail');
          onError('Status de pagamento inesperado');
        }
      } catch (err) {
        event.complete('fail');
        onError('Erro ao processar pagamento');
      } finally {
        setIsProcessing(false);
      }
    });

    return () => {
      // Cleanup: remove event listeners
      pr.off('paymentmethod');
    };
  }, [stripe, amount, clientSecret, onSuccess, onError, onNotAvailable]);

  // Loading state while checking availability
  if (isAvailable === null) {
    return (
      <div className="flex flex-col items-center justify-center py-6 space-y-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Verificando carteiras digitais...</p>
      </div>
    );
  }

  // Not available
  if (!isAvailable || !paymentRequest) {
    return null;
  }

  // Processing payment
  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center py-6 space-y-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Processando pagamento...</p>
      </div>
    );
  }

  const buttonOptions: StripePaymentRequestButtonElementOptions = {
    paymentRequest,
    style: {
      paymentRequestButton: {
        type: 'default',
        theme: 'dark',
        height: '48px',
      },
    },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
        <Smartphone className="w-4 h-4" />
        <span>Pague com sua carteira digital</span>
      </div>
      
      <PaymentRequestButtonElement options={buttonOptions} />
      
      <p className="text-xs text-muted-foreground text-center">
        Pagamento seguro via Apple Pay ou Google Pay
      </p>
    </div>
  );
}
