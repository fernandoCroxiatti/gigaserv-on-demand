import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { ProviderIdleView } from './Provider/ProviderIdleView';
import { ProviderNegotiatingView } from './Provider/ProviderNegotiatingView';
import { ProviderAwaitingPaymentView } from './Provider/ProviderAwaitingPaymentView';
import { ProviderInServiceView } from './Provider/ProviderInServiceView';
import { ProviderFinishedView } from './Provider/ProviderFinishedView';
import { IncomingRequestCard } from './Provider/IncomingRequestCard';
import { TermsAcceptanceModal } from './Provider/TermsAcceptanceModal';
import { useTermsAcceptance } from '@/hooks/useTermsAcceptance';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export function ProviderView() {
  const { chamado, incomingRequest } = useApp();
  const { user } = useAuth();
  const status = chamado?.status || 'idle';
  
  const { needsAcceptance, isLoading: termsLoading, acceptTerms } = useTermsAcceptance(
    user?.id || null,
    true // Always true since we're in ProviderView
  );

  // Show loading while checking terms
  if (termsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Block access if terms need acceptance
  if (needsAcceptance) {
    return (
      <>
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
          <div className="text-muted-foreground">
            <p className="text-lg font-medium mb-2">Acesso Bloqueado</p>
            <p className="text-sm">Por favor, aceite os novos Termos de Uso para continuar.</p>
          </div>
        </div>
        <TermsAcceptanceModal 
          open={needsAcceptance} 
          onAccept={acceptTerms}
        />
      </>
    );
  }

  return (
    <>
      {/* Incoming request overlay */}
      {incomingRequest && <IncomingRequestCard />}
      
      {/* State-driven UI - render based on chamado status */}
      {(() => {
        switch (status) {
          case 'idle':
            return <ProviderIdleView />;
          case 'searching':
            return <ProviderIdleView />;
          case 'accepted':
          case 'negotiating':
            return <ProviderNegotiatingView />;
          case 'awaiting_payment':
            return <ProviderAwaitingPaymentView />;
          case 'confirmed':
          case 'in_service':
            return <ProviderInServiceView />;
          case 'finished':
            return <ProviderFinishedView />;
          case 'canceled':
            return <ProviderIdleView />;
          default:
            return <ProviderIdleView />;
        }
      })()}
    </>
  );
}
