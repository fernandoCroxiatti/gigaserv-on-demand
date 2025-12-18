import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function StripeCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'refresh' | 'error'>('loading');
  const [message, setMessage] = useState('Verificando status da conta...');

  useEffect(() => {
    const type = searchParams.get('type');
    
    if (type === 'success') {
      checkStripeStatus();
    } else if (type === 'refresh') {
      setStatus('refresh');
      setMessage('O cadastro ainda não foi finalizado. Clique abaixo para continuar.');
    } else {
      setStatus('error');
      setMessage('Parâmetro inválido');
    }
  }, [searchParams]);

  const checkStripeStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-connect-status');
      
      if (error) {
        throw error;
      }

      if (data?.charges_enabled && data?.payouts_enabled) {
        setStatus('success');
        setMessage('Conta Stripe configurada com sucesso! Você já pode receber pagamentos.');
      } else if (data?.has_account) {
        setStatus('refresh');
        setMessage('Cadastro incompleto. Finalize seu cadastro para começar a receber.');
      } else {
        setStatus('refresh');
        setMessage('Não foi possível verificar a conta. Tente novamente.');
      }
    } catch (err) {
      console.error('Error checking status:', err);
      setStatus('error');
      setMessage('Erro ao verificar status da conta.');
    }
  };

  const handleContinueOnboarding = async () => {
    setStatus('loading');
    setMessage('Gerando link de cadastro...');
    
    try {
      const { data, error } = await supabase.functions.invoke('create-connect-account');
      
      if (error) {
        throw error;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('URL não retornada');
      }
    } catch (err) {
      console.error('Error:', err);
      setStatus('error');
      setMessage('Erro ao gerar link. Tente novamente pelo perfil.');
    }
  };

  const handleGoToProfile = () => {
    navigate('/profile');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 animate-spin text-provider-primary mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Aguarde</h1>
            <p className="text-muted-foreground">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-20 h-20 rounded-full bg-status-finished/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-status-finished" />
            </div>
            <h1 className="text-xl font-bold mb-2 text-status-finished">Sucesso!</h1>
            <p className="text-muted-foreground mb-6">{message}</p>
            <Button variant="provider" className="w-full" onClick={handleGoToProfile}>
              Voltar ao perfil
            </Button>
          </>
        )}

        {status === 'refresh' && (
          <>
            <div className="w-20 h-20 rounded-full bg-status-searching/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-10 h-10 text-status-searching" />
            </div>
            <h1 className="text-xl font-bold mb-2">Cadastro Incompleto</h1>
            <p className="text-muted-foreground mb-6">{message}</p>
            <div className="space-y-3">
              <Button variant="provider" className="w-full" onClick={handleContinueOnboarding}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Continuar cadastro
              </Button>
              <Button variant="outline" className="w-full" onClick={handleGoToProfile}>
                Voltar ao perfil
              </Button>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-10 h-10 text-destructive" />
            </div>
            <h1 className="text-xl font-bold mb-2 text-destructive">Erro</h1>
            <p className="text-muted-foreground mb-6">{message}</p>
            <Button variant="outline" className="w-full" onClick={handleGoToProfile}>
              Voltar ao perfil
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
