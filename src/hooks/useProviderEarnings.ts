import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface Earnings {
  today: number;
  week: number;
  month: number;
  total: number;
  todayRides: number;
  weekRides: number;
  monthRides: number;
  totalRides: number;
}

interface EarningsHook {
  earnings: Earnings;
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useProviderEarnings(): EarningsHook {
  const { user } = useAuth();
  const [chamados, setChamados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEarnings = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('chamados')
        .select('valor, commission_amount, provider_amount, created_at, status, payment_status')
        .eq('prestador_id', user.id)
        .eq('status', 'finished')
        .in('payment_status', ['paid_stripe', 'paid_mock']);

      if (error) {
        console.error('Error fetching earnings:', error);
        return;
      }

      setChamados(data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEarnings();
  }, [user?.id]);

  const earnings = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const calculateEarnings = (list: typeof chamados) => {
      return list.reduce((acc, c) => {
        // provider_amount is what provider receives (after commission deduction)
        // If not set, calculate from valor - commission_amount
        const providerReceives = c.provider_amount || 
          (c.valor - (c.commission_amount || c.valor * 0.15));
        return acc + (providerReceives || 0);
      }, 0);
    };

    const todayChamados = chamados.filter(c => new Date(c.created_at) >= todayStart);
    const weekChamados = chamados.filter(c => new Date(c.created_at) >= weekStart);
    const monthChamados = chamados.filter(c => new Date(c.created_at) >= monthStart);

    return {
      today: calculateEarnings(todayChamados),
      week: calculateEarnings(weekChamados),
      month: calculateEarnings(monthChamados),
      total: calculateEarnings(chamados),
      todayRides: todayChamados.length,
      weekRides: weekChamados.length,
      monthRides: monthChamados.length,
      totalRides: chamados.length,
    };
  }, [chamados]);

  return { earnings, loading, refetch: fetchEarnings };
}
