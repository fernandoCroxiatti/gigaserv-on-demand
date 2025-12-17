import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { Header } from '@/components/Header';
import { ClientView } from '@/components/ClientView';
import { ProviderView } from '@/components/ProviderView';

const Index = () => {
  const { user } = useApp();
  const isClient = user.activeProfile === 'client';

  return (
    <div className={`h-full ${!isClient ? 'provider-theme' : ''}`}>
      <Header />
      {isClient ? <ClientView /> : <ProviderView />}
    </div>
  );
};

export default Index;
