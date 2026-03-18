/**
 * ProviderView - State-driven UI controller for provider-side experience
 * 
 * ARCHITECTURE NOTES:
 * - This component acts as a router based on chamado.status
 * - Handles incoming request overlay for new chamados
 * - Terms acceptance modal blocks access until provider accepts new terms
 * 
 * STATUS FLOW (Provider perspective):
 * idle → negotiating → awaiting_payment → in_service → pending_client_confirmation → finished
 * 
 * IMPORTANT: 
 * - Provider never sees 'searching' status (that's client-only)
 * - IncomingRequestCard appears as overlay when new chamado is available
 * - TermsAcceptanceModal blocks all features until terms are accepted
 */
import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { ProviderIdleView } from './Provider/ProviderIdleView';
import { ProviderNegotiatingView } from './Provider/ProviderNegotiatingView';
import { ProviderAwaitingPaymentView } from './Provider/ProviderAwaitingPaymentView';
import { ProviderInServiceView } from './Provider/ProviderInServiceView';
import { ProviderPendingConfirmationView } from './Provider/ProviderPendingConfirmationView';
import { ProviderFinishedView } from './Provider/ProviderFinishedView';
import { IncomingRequestCard } from './Provider/IncomingRequestCard';
import { TermsAcceptanceModal } from './Provider/TermsAcceptanceModal';
import { useTermsAcceptance } from '@/hooks/useTermsAcceptance';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Clock, AlertCircle, XCircle, Camera } from 'lucide-react';
import { CNHUpload } from './Provider/Onboarding/CNHUpload';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function ProviderView() {
  const { chamado, incomingRequest, providerData } = useApp();
  const { user } = useAuth();
  const status = chamado?.status || 'idle';
  
  const approvalStatus = providerData?.approval_status || 'pending';

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

  // Handle Approval Status blocking
  if (approvalStatus !== 'approved') {
    const hasCnh = !!providerData?.cnh_url;

    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center animate-fade-in overflow-y-auto">
        {!hasCnh ? (
          <>
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Camera className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Documentação Pendente</h2>
            <p className="text-muted-foreground mb-8 max-w-xs">
              Para começar a atender, precisamos de uma foto da sua CNH para validação do perfil.
            </p>
            <div className="w-full max-w-sm">
              <CNHUpload
                userId={user?.id || ''}
                onUploadComplete={async (url) => {
                  try {
                    const { error } = await supabase
                      .from('provider_data')
                      .update({
                        cnh_url: url,
                        approval_status: 'pending',
                        updated_at: new Date().toISOString()
                      })
                      .eq('user_id', user?.id);

                    if (error) throw error;
                    toast.success('Documento enviado! Entraremos em análise.');
                    // The AppContext should naturally refetch or we can force reload
                    window.location.reload();
                  } catch (err) {
                    console.error('Error updating CNH:', err);
                    toast.error('Erro ao salvar documento');
                  }
                }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              {approvalStatus === 'pending' ? (
                <Clock className="w-10 h-10 text-primary animate-pulse" />
              ) : (
                <XCircle className="w-10 h-10 text-destructive" />
              )}
            </div>

            <h2 className="text-2xl font-bold mb-3">
              {approvalStatus === 'pending' ? 'Perfil em Análise' : 'Perfil Rejeitado'}
            </h2>

            <p className="text-muted-foreground mb-6 max-w-xs">
              {approvalStatus === 'pending'
                ? 'Sua documentação foi enviada e está sendo revisada por nossa equipe. Você receberá uma notificação assim que for aprovado.'
                : `Seu cadastro não pôde ser aprovado. Motivo: ${providerData?.rejection_reason || 'Documentação inválida'}`}
            </p>

            {approvalStatus === 'rejected' && (
              <div className="w-full max-w-sm mb-6">
                <CNHUpload
                  userId={user?.id || ''}
                  onUploadComplete={async (url) => {
                    try {
                      const { error } = await supabase
                        .from('provider_data')
                        .update({
                          cnh_url: url,
                          approval_status: 'pending',
                          rejection_reason: null,
                          updated_at: new Date().toISOString()
                        })
                        .eq('user_id', user?.id);

                      if (error) throw error;
                      toast.success('Novo documento enviado para reanálise!');
                      window.location.reload();
                    } catch (err) {
                      console.error('Error updating CNH:', err);
                    }
                  }}
                />
              </div>
            )}

            <div className="flex items-start gap-3 p-4 bg-secondary/30 rounded-2xl text-left max-w-sm border border-border">
              <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-semibold">O que acontece agora?</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {approvalStatus === 'pending'
                    ? 'Nosso prazo médio de análise é de 24 horas úteis. Fique atento às suas notificações!'
                    : 'Você pode reenviar sua CNH acima para uma nova análise se acreditar que houve um erro.'}
                </p>
              </div>
            </div>
          </>
        )}
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

  // Determine if we have an active ride (to prevent duplicate cards)
  const hasActiveRide = chamado && ['accepted', 'negotiating', 'awaiting_payment', 'in_service', 'pending_client_confirmation'].includes(status);

  // Only show IncomingRequestCard when:
  // 1. There's an incomingRequest AND
  // 2. There's NO active ride already in progress
  const shouldShowIncomingRequest = incomingRequest && !hasActiveRide;

  return (
    <>
      {/* Incoming request overlay - only when no active ride */}
      {shouldShowIncomingRequest && <IncomingRequestCard />}
      
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
          case 'pending_client_confirmation':
            return <ProviderPendingConfirmationView />;
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
