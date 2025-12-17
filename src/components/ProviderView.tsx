import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { ProviderIdleView } from './Provider/ProviderIdleView';
import { ProviderNegotiatingView } from './Provider/ProviderNegotiatingView';
import { ProviderAwaitingPaymentView } from './Provider/ProviderAwaitingPaymentView';
import { ProviderInServiceView } from './Provider/ProviderInServiceView';
import { ProviderFinishedView } from './Provider/ProviderFinishedView';
import { IncomingRequestCard } from './Provider/IncomingRequestCard';

export function ProviderView() {
  const { chamado, incomingRequest } = useApp();
  const status = chamado?.status || 'idle';

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
