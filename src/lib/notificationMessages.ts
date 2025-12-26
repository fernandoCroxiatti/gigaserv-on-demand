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
    body: 'Seu pedido foi recebido com sucesso.',
    priority: 'normal',
    tag: 'chamado-status'
  },
  searching_provider: {
    title: 'Procurando prestador',
    body: 'Estamos procurando um prestador próximo.',
    priority: 'normal',
    tag: 'chamado-status'
  },
  provider_accepted: {
    title: '🚗 Prestador a caminho!',
    body: 'Um prestador aceitou seu chamado e está indo até você.',
    priority: 'high',  // HIGH PRIORITY - alert sound for client
    tag: 'chamado-provider-accepted'
  },
  provider_arrived: {
    title: 'Prestador chegou',
    body: 'O prestador chegou ao local.',
    priority: 'high',
    tag: 'chamado-status'
  },
  service_started: {
    title: 'Serviço iniciado',
    body: 'O serviço está sendo realizado.',
    priority: 'normal',
    tag: 'chamado-status'
  },
  service_completed: {
    title: 'Serviço concluído',
    body: 'O serviço foi finalizado. Avalie sua experiência.',
    priority: 'high',
    tag: 'chamado-status'
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

// Check if within preferred notification hours (08h-20h Brazil time)
export function isWithinPreferredHours(): boolean {
  const now = new Date();
  // Brazil is UTC-3
  const utcHour = now.getUTCHours();
  const brazilHour = utcHour - 3 < 0 ? utcHour - 3 + 24 : utcHour - 3;
  // Allow notifications between 08:00 and 20:00
  return brazilHour >= 8 && brazilHour <= 20;
}
