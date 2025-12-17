import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { ClientIdleView } from './Client/ClientIdleView';
import { ClientSearchingView } from './Client/ClientSearchingView';
import { ClientNegotiatingView } from './Client/ClientNegotiatingView';
import { ClientConfirmedView } from './Client/ClientConfirmedView';
import { ClientInServiceView } from './Client/ClientInServiceView';
import { ClientFinishedView } from './Client/ClientFinishedView';

export function ClientView() {
  const { chamado } = useApp();
  const status = chamado?.status || 'idle';

  // State-driven UI - render based on chamado status
  switch (status) {
    case 'idle':
      return <ClientIdleView />;
    case 'searching':
      return <ClientSearchingView />;
    case 'accepted':
    case 'negotiating':
      return <ClientNegotiatingView />;
    case 'confirmed':
      return <ClientConfirmedView />;
    case 'in_service':
      return <ClientInServiceView />;
    case 'finished':
      return <ClientFinishedView />;
    case 'canceled':
      return <ClientIdleView />;
    default:
      return <ClientIdleView />;
  }
}
