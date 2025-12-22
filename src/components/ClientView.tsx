import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { ClientIdleView } from './Client/ClientIdleView';
import { ClientSearchingView } from './Client/ClientSearchingView';
import { ClientNegotiatingView } from './Client/ClientNegotiatingView';
import { ClientAwaitingPaymentView } from './Client/ClientAwaitingPaymentView';
import { ClientInServiceView } from './Client/ClientInServiceView';
import { ClientPendingConfirmationView } from './Client/ClientPendingConfirmationView';
import { ClientFinishedView } from './Client/ClientFinishedView';

export function ClientView() {
  const { chamado } = useApp();
  const status = chamado?.status || 'idle';

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
