import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Balance {
  available: number;
  pending: number;
  paid: number;
}

export interface Earnings {
  today: number;
  week: number;
  month: number;
  total: number;
  todayRides: number;
  weekRides: number;
  monthRides: number;
  totalRides: number;
}

export interface Payout {
  id: string;
  stripePayoutId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'in_transit' | 'paid' | 'failed' | 'canceled';
  arrivalDate: string | null;
  paidAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: string;
}

export interface StripeStatus {
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  status: 'pending' | 'verified' | 'restricted' | 'not_configured';
}

export interface ProviderInfo {
  rating: number;
  totalServices: number;
}

export interface FinancialData {
  balance: Balance;
  earnings: Earnings;
  payouts: Payout[];
  stripeStatus: StripeStatus | null;
  providerInfo: ProviderInfo;
}

export function useProviderFinancialData() {
  const { user } = useAuth();
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke('provider-financial-data');

      if (invokeError) {
        console.error('Error fetching financial data:', invokeError);
        setError('Erro ao carregar dados financeiros');
        return;
      }

      if (result?.error) {
        console.error('API error:', result.error);
        setError(result.error);
        return;
      }

      setData(result as FinancialData);
    } catch (err) {
      console.error('Error:', err);
      setError('Erro ao carregar dados financeiros');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Subscribe to realtime payout updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('provider-payouts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'provider_payouts',
          filter: `provider_id=eq.${user.id}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchData]);

  return { data, loading, error, refetch: fetchData };
}