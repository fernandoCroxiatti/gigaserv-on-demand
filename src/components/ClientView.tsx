/**
 * ClientView - State-driven UI controller for client-side experience
 * 
 * ARCHITECTURE NOTES:
 * - This component acts as a router based on chamado.status
 * - All state transitions are driven by database changes, never by UI clicks
 * - Each status maps to a dedicated view component
 * 
 * STATUS FLOW:
 * idle → searching → negotiating → awaiting_payment → in_service → pending_client_confirmation → finished
 * 
 * IMPORTANT: Do not add business logic here. This is purely a view dispatcher.
 */
import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { ClientIdleView } from './Client/ClientIdleView';
import { ClientSearchingView } from './Client/ClientSearchingView';
import { ClientNegotiatingView } from './Client/ClientNegotiatingView';
import { ClientAwaitingPaymentView } from './Client/ClientAwaitingPaymentView';
import { ClientInServiceView } from './Client/ClientInServiceView';
import { ClientPendingConfirmationView } from './Client/ClientPendingConfirmationView';
import { ClientFinishedView } from './Client/ClientFinishedView';
import { useProviderFoundSound } from '@/hooks/useProviderFoundSound';

export function ClientView() {
  const { chamado } = useApp();
  const status = chamado?.status || 'idle';

  // Som de notificação quando prestador é encontrado (não invasivo)
  useProviderFoundSound(status, chamado?.id);

  // State-driven UI - render based on chamado status
  // Flow: idle → searching → negotiating → awaiting_payment → in_service → pending_client_confirmation → finished
  switch (status) {
    case 'idle':
      return <ClientIdleView />;
    case 'searching':
      return <ClientSearchingView />;
    case 'accepted':
    case 'negotiating':
      return <ClientNegotiatingView />;
    case 'awaiting_payment':
      return <ClientAwaitingPaymentView />;
    case 'confirmed': // Legacy status, redirect to in_service view
    case 'in_service':
      return <ClientInServiceView />;
    case 'pending_client_confirmation':
      return <ClientPendingConfirmationView />;
    case 'finished':
      return <ClientFinishedView />;
    case 'canceled':
      return <ClientIdleView />;
    default:
      return <ClientIdleView />;
  }
}
