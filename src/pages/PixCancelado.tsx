import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { XCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PixCancelado() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const chamadoId = searchParams.get('chamado_id');

  const handleTryAgain = () => {
    // Navigate back to main page where payment can be retried
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
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center">
              <XCircle className="w-12 h-12 text-muted-foreground" />
            </div>
            
            <h2 className="text-xl font-semibold">Pagamento cancelado</h2>
            
            <p className="text-muted-foreground">
              O pagamento PIX foi cancelado. Você pode tentar novamente ou escolher outra forma de pagamento.
            </p>

            <div className="w-full space-y-3 pt-4">
              <Button onClick={handleTryAgain} className="w-full" size="lg">
                <RefreshCw className="w-4 h-4 mr-2" />
                Tentar novamente
              </Button>
              
              <Button 
                onClick={handleTryAgain} 
                variant="outline" 
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao app
              </Button>
            </div>
          </div>
        </div>

        {/* Info text */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          O prestador continua aguardando. Complete o pagamento para iniciar o serviço.
        </p>
      </div>
    </div>
  );
}
