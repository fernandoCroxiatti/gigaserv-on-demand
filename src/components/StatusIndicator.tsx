import React from 'react';
import { ChamadoStatus } from '@/types/chamado';
import { useApp } from '@/contexts/AppContext';
import { Search, Check, MessageCircle, CreditCard, Navigation, Flag, XCircle } from 'lucide-react';

const statusConfig: Record<ChamadoStatus, { label: string; icon: React.ElementType; color: string }> = {
  idle: { label: 'Disponível', icon: Check, color: 'bg-muted text-muted-foreground' },
  searching: { label: 'Buscando...', icon: Search, color: 'bg-status-searching/10 text-status-searching' },
  accepted: { label: 'Aceito', icon: Check, color: 'bg-status-accepted/10 text-status-accepted' },
  negotiating: { label: 'Negociando', icon: MessageCircle, color: 'bg-provider-primary/10 text-provider-primary' },
  confirmed: { label: 'Confirmado', icon: CreditCard, color: 'bg-status-accepted/10 text-status-accepted' },
  in_service: { label: 'Em serviço', icon: Navigation, color: 'bg-status-inService/10 text-status-inService' },
  finished: { label: 'Finalizado', icon: Flag, color: 'bg-status-finished/10 text-status-finished' },
  canceled: { label: 'Cancelado', icon: XCircle, color: 'bg-status-canceled/10 text-status-canceled' },
};

export function StatusIndicator() {
  const { chamado } = useApp();
  
  const status = chamado?.status || 'idle';
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={`status-badge ${config.color}`}>
      <Icon className="w-3 h-3" />
      <span>{config.label}</span>
    </div>
  );
}
