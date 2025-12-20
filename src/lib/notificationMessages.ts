// Notification messages for GIGA S.O.S
// Following Uber-like patterns for professional, non-intrusive messaging

// ====================================
// PROVIDER MOTIVATIONAL MESSAGES
// ====================================
export const PROVIDER_MOTIVATIONAL_MESSAGES = [
  {
    title: 'Chamados na sua região',
    body: 'Chamados disponíveis na sua região agora.'
  },
  {
    title: 'Clientes próximos',
    body: 'Clientes próximos precisam de assistência.'
  },
  {
    title: 'Fique online',
    body: 'Fique online para receber novas oportunidades.'
  },
  {
    title: 'Movimento ativo',
    body: 'Movimento ativo na sua área neste momento.'
  },
  {
    title: 'Prestadores atendendo',
    body: 'Prestadores ativos estão atendendo chamados agora.'
  },
  {
    title: 'Novas oportunidades',
    body: 'Novos chamados podem surgir a qualquer momento.'
  }
];

// ====================================
// PROVIDER EVENT MESSAGES
// ====================================
export const PROVIDER_EVENT_MESSAGES = {
  new_chamado: {
    title: '🚨 Novo chamado disponível!',
    body: 'Um cliente próximo precisa de assistência. Toque para ver.',
    priority: 'high',
    tag: 'chamado'
  },
  chamado_accepted: {
    title: '✅ Chamado confirmado',
    body: 'Você aceitou o chamado. Dirija-se ao cliente.',
    priority: 'normal',
    tag: 'chamado'
  },
  chamado_canceled: {
    title: '❌ Chamado cancelado',
    body: 'O cliente cancelou o chamado.',
    priority: 'normal',
    tag: 'chamado'
  },
  chamado_expired: {
    title: '⏰ Chamado expirado',
    body: 'O tempo para aceitar o chamado esgotou.',
    priority: 'normal',
    tag: 'chamado'
  },
  payment_received: {
    title: '💰 Pagamento recebido',
    body: 'O pagamento do serviço foi confirmado.',
    priority: 'normal',
    tag: 'payment'
  }
};

// ====================================
// CLIENT STATUS MESSAGES
// ====================================
export const CLIENT_STATUS_MESSAGES = {
  chamado_received: {
    title: 'Pedido recebido',
    body: 'Seu pedido foi recebido com sucesso.'
  },
  searching_provider: {
    title: 'Procurando prestador',
    body: 'Estamos procurando um prestador próximo.'
  },
  provider_accepted: {
    title: 'Prestador a caminho',
    body: 'Seu atendimento está a caminho.'
  },
  provider_arrived: {
    title: 'Prestador chegou',
    body: 'O prestador chegou ao local.'
  },
  service_started: {
    title: 'Serviço iniciado',
    body: 'O serviço está sendo realizado.'
  },
  service_completed: {
    title: 'Serviço concluído',
    body: 'O serviço foi finalizado. Avalie sua experiência.'
  }
};

// ====================================
// CLIENT REENGAGEMENT MESSAGES
// ====================================
export const CLIENT_REENGAGEMENT_MESSAGES = [
  {
    title: 'Precisa de ajuda?',
    body: 'Precisa de assistência? O GIGA S.O.S está disponível.'
  },
  {
    title: 'Estamos aqui',
    body: 'Estamos prontos para ajudar quando você precisar.'
  },
  {
    title: 'GIGA S.O.S',
    body: 'Conte com o GIGA S.O.S para emergências veiculares.'
  }
];

// Helper to get random message from array
export function getRandomMessage<T>(messages: T[]): T {
  return messages[Math.floor(Math.random() * messages.length)];
}

// Check if within preferred notification hours
export function isWithinPreferredHours(): boolean {
  const hour = new Date().getHours();
  // Morning: 7h-9h or Evening: 17h-19h
  return (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
}
