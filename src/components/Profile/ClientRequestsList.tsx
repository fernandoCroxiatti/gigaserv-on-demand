import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SERVICE_CONFIG, ServiceType, ChamadoStatus } from '@/types/chamado';
import { Loader2, MapPin, Clock, DollarSign, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChamadoRow {
  id: string;
  status: string;
  tipo_servico: string;
  origem_address: string;
  destino_address: string | null;
  valor: number | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  searching: { label: 'Buscando', color: 'bg-status-searching text-white' },
  accepted: { label: 'Aceito', color: 'bg-primary text-white' },
  negotiating: { label: 'Negociando', color: 'bg-status-searching text-white' },
  awaiting_payment: { label: 'Aguardando pagamento', color: 'bg-status-searching text-white' },
  in_service: { label: 'Em andamento', color: 'bg-status-in-service text-white' },
  finished: { label: 'Finalizado', color: 'bg-status-finished text-white' },
  canceled: { label: 'Cancelado', color: 'bg-muted text-muted-foreground' },
};

export function ClientRequestsList() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ChamadoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const loadRequests = async () => {
      const { data, error } = await supabase
        .from('chamados')
        .select('*')
        .eq('cliente_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading requests:', error);
      } else {
        setRequests(data || []);
      }
      setLoading(false);
    };

    loadRequests();

    // Subscribe to changes
    const channel = supabase
      .channel('client-chamados')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chamados',
          filter: `cliente_id=eq.${user.id}`,
        },
        () => {
          loadRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="bg-card rounded-2xl p-8 text-center">
        <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="font-semibold text-lg mb-2">Nenhuma solicitação</h3>
        <p className="text-muted-foreground">
          Suas solicitações de serviço aparecerão aqui
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => {
        const serviceConfig = SERVICE_CONFIG[request.tipo_servico as ServiceType];
        const statusConfig = STATUS_LABELS[request.status] || STATUS_LABELS.canceled;
        
        return (
          <div 
            key={request.id}
            className="bg-card rounded-2xl p-4 hover:bg-card/80 transition-colors cursor-pointer"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center shrink-0">
                <span className="text-2xl">{serviceConfig?.icon || '🚗'}</span>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold">{serviceConfig?.label || 'Serviço'}</h4>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                    {statusConfig.label}
                  </span>
                </div>
                
                <p className="text-sm text-muted-foreground truncate mb-2">
                  {request.origem_address}
                </p>
                
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(request.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                  </div>
                  {request.valor && (
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      R$ {Number(request.valor).toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
              
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
