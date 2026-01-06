import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SERVICE_CONFIG, ServiceType } from '@/types/chamado';
import { Loader2, MapPin, Clock, DollarSign, Filter } from 'lucide-react';
import { format, isToday, isThisWeek, isThisMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ChamadoRow {
  id: string;
  status: string;
  tipo_servico: string;
  origem_address: string;
  destino_address: string | null;
  valor: number | null;
  provider_amount: number | null;
  commission_percentage: number | null;
  commission_amount: number | null;
  payment_status: string | null;
  created_at: string;
}

type FilterType = 'all' | 'paid' | 'pending';
type PeriodType = 'all' | 'today' | 'week' | 'month';

const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  paid_stripe: { label: 'Pago', color: 'bg-status-finished text-white' },
  paid_mock: { label: 'Pago', color: 'bg-status-finished text-white' },
  pending: { label: 'Pendente', color: 'bg-status-searching text-white' },
  failed: { label: 'Falhou', color: 'bg-destructive text-white' },
  refunded: { label: 'Reembolsado', color: 'bg-muted text-muted-foreground' },
};

export function ProviderRidesHistoryTab() {
  const { user } = useAuth();
  const [rides, setRides] = useState<ChamadoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [period, setPeriod] = useState<PeriodType>('all');

  useEffect(() => {
    if (!user) return;

    const loadRides = async () => {
      const { data, error } = await supabase
        .from('chamados')
        .select('id, status, tipo_servico, origem_address, destino_address, valor, provider_amount, commission_percentage, commission_amount, payment_status, created_at')
        .eq('prestador_id', user.id)
        .eq('status', 'finished')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading rides:', error);
      } else {
        setRides(data || []);
      }
      setLoading(false);
    };

    loadRides();

    // Subscribe to changes
    const channel = supabase
      .channel('provider-rides-history')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chamados',
          filter: `prestador_id=eq.${user.id}`,
        },
        () => {
          loadRides();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const filteredRides = useMemo(() => {
    return rides.filter(ride => {
      // Payment filter
      if (filter === 'paid') {
        if (!['paid_stripe', 'paid_mock'].includes(ride.payment_status || '')) return false;
      } else if (filter === 'pending') {
        if (!['pending'].includes(ride.payment_status || '')) return false;
      }

      // Period filter
      const rideDate = new Date(ride.created_at);
      if (period === 'today' && !isToday(rideDate)) return false;
      if (period === 'week' && !isThisWeek(rideDate)) return false;
      if (period === 'month' && !isThisMonth(rideDate)) return false;

      return true;
    });
  }, [rides, filter, period]);

  const stats = useMemo(() => {
    const total = filteredRides.length;
    const totalValue = filteredRides.reduce((sum, r) => sum + (r.provider_amount || r.valor || 0), 0);
    return { total, totalValue };
  }, [filteredRides]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-provider-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtros</span>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            Todos
          </Button>
          <Button
            size="sm"
            variant={filter === 'paid' ? 'default' : 'outline'}
            onClick={() => setFilter('paid')}
          >
            Pagos
          </Button>
          <Button
            size="sm"
            variant={filter === 'pending' ? 'default' : 'outline'}
            onClick={() => setFilter('pending')}
          >
            Pendentes
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={period === 'all' ? 'secondary' : 'ghost'}
            onClick={() => setPeriod('all')}
          >
            Todo período
          </Button>
          <Button
            size="sm"
            variant={period === 'today' ? 'secondary' : 'ghost'}
            onClick={() => setPeriod('today')}
          >
            Hoje
          </Button>
          <Button
            size="sm"
            variant={period === 'week' ? 'secondary' : 'ghost'}
            onClick={() => setPeriod('week')}
          >
            Esta semana
          </Button>
          <Button
            size="sm"
            variant={period === 'month' ? 'secondary' : 'ghost'}
            onClick={() => setPeriod('month')}
          >
            Este mês
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-provider-primary">{stats.total}</p>
          <p className="text-sm text-muted-foreground">Corridas</p>
        </div>
        <div className="bg-card rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-provider-primary">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalValue)}
          </p>
          <p className="text-sm text-muted-foreground">Valor recebido</p>
        </div>
      </div>

      {/* Rides list */}
      {filteredRides.length === 0 ? (
        <div className="bg-card rounded-2xl p-8 text-center">
          <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold text-lg mb-2">Nenhuma corrida encontrada</h3>
          <p className="text-muted-foreground">
            Ajuste os filtros ou complete mais corridas
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRides.map((ride) => {
            const serviceConfig = SERVICE_CONFIG[ride.tipo_servico as ServiceType];
            const paymentConfig = PAYMENT_STATUS_LABELS[ride.payment_status || 'pending'] || PAYMENT_STATUS_LABELS.pending;
            const value = ride.provider_amount || ride.valor || 0;
            
            return (
              <div 
                key={ride.id}
                className="bg-card rounded-2xl p-4"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center shrink-0">
                    <span className="text-2xl">{serviceConfig?.icon || '🚗'}</span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{serviceConfig?.label || 'Serviço'}</h4>
                      <Badge className={paymentConfig.color}>
                        {paymentConfig.label}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground truncate mb-2">
                      {ride.origem_address}
                    </p>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(ride.created_at), "dd MMM, HH:mm", { locale: ptBR })}
                      </div>
                      <div className="flex items-center gap-1 text-provider-primary font-medium">
                        <DollarSign className="w-3 h-3" />
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                      </div>
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