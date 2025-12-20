import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SERVICE_CONFIG, ServiceType } from '@/types/chamado';
import { Loader2, MapPin, Clock, DollarSign, Filter, ChevronRight } from 'lucide-react';
import { format, subDays, subMonths, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  finished: { label: 'Concluída', color: 'bg-status-finished text-white' },
  canceled: { label: 'Cancelada', color: 'bg-muted text-muted-foreground' },
};

type PeriodFilter = 'all' | 'today' | 'week' | 'month';
type StatusFilter = 'all' | 'finished' | 'canceled' | 'in_progress';

export function ClientRidesTab() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ChamadoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    if (!user) return;
    loadRequests();
  }, [user]);

  const loadRequests = async () => {
    if (!user) return;
    
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

  const getFilteredRequests = () => {
    let filtered = [...requests];

    // Period filter
    const now = new Date();
    if (periodFilter === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      filtered = filtered.filter(r => isAfter(new Date(r.created_at), todayStart));
    } else if (periodFilter === 'week') {
      filtered = filtered.filter(r => isAfter(new Date(r.created_at), subDays(now, 7)));
    } else if (periodFilter === 'month') {
      filtered = filtered.filter(r => isAfter(new Date(r.created_at), subMonths(now, 1)));
    }

    // Status filter
    if (statusFilter === 'finished') {
      filtered = filtered.filter(r => r.status === 'finished');
    } else if (statusFilter === 'canceled') {
      filtered = filtered.filter(r => r.status === 'canceled');
    } else if (statusFilter === 'in_progress') {
      filtered = filtered.filter(r => !['finished', 'canceled', 'idle'].includes(r.status));
    }

    return filtered;
  };

  const filteredRequests = getFilteredRequests();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Filters */}
      <div className="bg-card rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">Filtros</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo período</SelectItem>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Última semana</SelectItem>
              <SelectItem value="month">Último mês</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="finished">Concluídas</SelectItem>
              <SelectItem value="canceled">Canceladas</SelectItem>
              <SelectItem value="in_progress">Em andamento</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground px-1">
        {filteredRequests.length} corrida{filteredRequests.length !== 1 ? 's' : ''} encontrada{filteredRequests.length !== 1 ? 's' : ''}
      </p>

      {/* Rides List */}
      {filteredRequests.length === 0 ? (
        <div className="bg-card rounded-2xl p-8 text-center">
          <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold text-lg mb-2">Nenhuma corrida</h3>
          <p className="text-muted-foreground">
            {statusFilter !== 'all' || periodFilter !== 'all' 
              ? 'Nenhuma corrida encontrada com os filtros selecionados'
              : 'Suas corridas aparecerão aqui'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((request) => {
            const serviceConfig = SERVICE_CONFIG[request.tipo_servico as ServiceType];
            const statusConfig = STATUS_LABELS[request.status] || STATUS_LABELS.canceled;
            
            return (
              <div 
                key={request.id}
                className="bg-card rounded-2xl p-4 hover:bg-card/80 transition-colors"
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
                        <div className="flex items-center gap-1 text-primary font-medium">
                          <DollarSign className="w-3 h-3" />
                          R$ {Number(request.valor).toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
