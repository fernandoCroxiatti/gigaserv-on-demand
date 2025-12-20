import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, AlertCircle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

type PaymentStatus = 'checking' | 'confirmed' | 'pending' | 'failed';

export default function PixSucesso() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<PaymentStatus>('checking');
  const [attempts, setAttempts] = useState(0);
  
  const sessionId = searchParams.get('session_id');
  const chamadoId = searchParams.get('chamado_id');

  // Check payment status via backend
  useEffect(() => {
    if (!chamadoId) {
      setStatus('failed');
      return;
    }

    const checkPaymentStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('check-payment-status', {
          body: { chamado_id: chamadoId },
        });

        if (error) {
          console.error('Error checking payment status:', error);
          setAttempts(prev => prev + 1);
          return;
        }

        if (data?.is_confirmed) {
          setStatus('confirmed');
          // Redirect to main app after showing confirmation
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 3000);
        } else if (data?.payment_status === 'failed') {
          setStatus('failed');
        } else {
          setStatus('pending');
          setAttempts(prev => prev + 1);
        }
      } catch (err) {
        console.error('Error:', err);
        setAttempts(prev => prev + 1);
      }
    };

    // Initial check
    checkPaymentStatus();

    // Poll every 2 seconds for up to 60 seconds
    const interval = setInterval(() => {
      if (status === 'confirmed' || status === 'failed' || attempts > 30) {
        clearInterval(interval);
        return;
      }
      checkPaymentStatus();
    }, 2000);

    return () => clearInterval(interval);
  }, [chamadoId, attempts, status, navigate]);

  // Listen for realtime updates
  useEffect(() => {
    if (!chamadoId || status === 'confirmed') return;

    const channel = supabase
      .channel(`pix-success-${chamadoId}`)
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
          
          if (newData.payment_status === 'paid_stripe' && newData.status === 'in_service') {
            setStatus('confirmed');
            setTimeout(() => {
              navigate('/', { replace: true });
            }, 3000);
          }
          
          if (newData.payment_status === 'failed') {
            setStatus('failed');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chamadoId, status, navigate]);

  const handleRetry = () => {
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary">GIGA S.O.S</h1>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl shadow-lg p-8">
          {status === 'checking' && (
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
              </div>
              <h2 className="text-xl font-semibold">Confirmando pagamento...</h2>
              <p className="text-muted-foreground">
                Verificando a confirmação do seu banco. Aguarde um momento.
              </p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                <span>Aguardando confirmação</span>
              </div>
            </div>
          )}

          {status === 'pending' && (
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 bg-status-searching/10 rounded-full flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-status-searching" />
              </div>
              <h2 className="text-xl font-semibold">Processando pagamento...</h2>
              <p className="text-muted-foreground">
                Seu pagamento PIX está sendo processado. Isso pode levar alguns segundos.
              </p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-status-searching rounded-full animate-pulse" />
                <span>Verificando com o banco</span>
              </div>
            </div>
          )}

          {status === 'confirmed' && (
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 bg-status-finished/20 rounded-full flex items-center justify-center animate-scale-in">
                <CheckCircle className="w-12 h-12 text-status-finished" />
              </div>
              <h2 className="text-xl font-semibold text-status-finished">Pagamento confirmado!</h2>
              <p className="text-muted-foreground">
                Seu pagamento foi processado com sucesso. O serviço será iniciado agora.
              </p>
              <p className="text-sm text-muted-foreground">
                Redirecionando para o app...
              </p>
            </div>
          )}

          {status === 'failed' && (
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 bg-destructive/20 rounded-full flex items-center justify-center">
                <AlertCircle className="w-12 h-12 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold text-destructive">Erro no pagamento</h2>
              <p className="text-muted-foreground">
                Não foi possível confirmar seu pagamento. Por favor, tente novamente.
              </p>
              <Button onClick={handleRetry} className="w-full mt-4">
                Voltar e tentar novamente
              </Button>
            </div>
          )}
        </div>

        {/* Security badge */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-6">
          <Shield className="w-4 h-4" />
          <span>Transação segura e criptografada</span>
        </div>
      </div>
    </div>
  );
}
