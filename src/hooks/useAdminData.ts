import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { Database } from '@/integrations/supabase/types';

const ADMIN_POLL_INTERVAL_MS = 12_000;

type ChamadoStatus = Database['public']['Enums']['chamado_status'];
type ServiceType = Database['public']['Enums']['service_type'];

interface DashboardStats {
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  totalCommission: number;
  totalPayout: number;
  todayRides: number;
  monthRides: number;
  activeRides: number;
  completedRides: number;
  canceledRides: number;
}

interface DailyStats {
  date: string;
  revenue: number;
  commission: number;
  rides: number;
}

function useAdminPolling(enabled: boolean, fn: () => void | Promise<void>, deps: any[]) {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const run = () => {
      if (cancelled) return;
      void fn();
    };

    run();
    const intervalId = window.setInterval(run, ADMIN_POLL_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') run();
    };

    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function useAdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;

    const isInitial = !hasLoadedRef.current;
    if (isInitial) setLoading(true);

    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data: chamados, error } = await supabase
        .from('chamados')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const finishedChamados = chamados?.filter((c) => c.status === 'finished' && c.valor) || [];
      const todayChamados = finishedChamados.filter((c) => new Date(c.created_at) >= new Date(todayStart));
      const weekChamados = finishedChamados.filter((c) => new Date(c.created_at) >= new Date(weekStart));
      const monthChamados = finishedChamados.filter((c) => new Date(c.created_at) >= new Date(monthStart));

      const calculateTotals = (list: typeof finishedChamados) => {
        return list.reduce(
          (acc, c) => {
            const valor = c.valor || 0;
            const commission = c.commission_amount || (valor * ((c.commission_percentage || 15) / 100));
            return {
              revenue: acc.revenue + valor,
              commission: acc.commission + commission,
              payout: acc.payout + (valor - commission),
            };
          },
          { revenue: 0, commission: 0, payout: 0 }
        );
      };

      const todayTotals = calculateTotals(todayChamados);
      const weekTotals = calculateTotals(weekChamados);
      const monthTotals = calculateTotals(monthChamados);
      const allTotals = calculateTotals(finishedChamados);

      // Only count truly active rides (in_service) - not abandoned searches
      // A search is considered abandoned if it's older than 30 minutes
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const activeRides =
        chamados?.filter((c) => {
          if (c.status === 'in_service') return true;
          if (['negotiating', 'awaiting_payment'].includes(c.status)) {
            return c.updated_at >= thirtyMinutesAgo;
          }
          if (c.status === 'searching') {
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
            return c.updated_at >= tenMinutesAgo;
          }
          return false;
        }).length || 0;

      setStats({
        todayRevenue: todayTotals.revenue,
        weekRevenue: weekTotals.revenue,
        monthRevenue: monthTotals.revenue,
        totalCommission: allTotals.commission,
        totalPayout: allTotals.payout,
        todayRides: todayChamados.length,
        monthRides: monthChamados.length,
        activeRides,
        completedRides: finishedChamados.length,
        canceledRides: chamados?.filter((c) => c.status === 'canceled').length || 0,
      });

      // Calculate daily stats for chart (last 30 days)
      const dailyMap = new Map<string, DailyStats>();
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyMap.set(dateStr, { date: dateStr, revenue: 0, commission: 0, rides: 0 });
      }

      finishedChamados.forEach((c) => {
        const dateStr = new Date(c.created_at).toISOString().split('T')[0];
        const existing = dailyMap.get(dateStr);
        if (existing) {
          const valor = c.valor || 0;
          const commission = c.commission_amount || (valor * ((c.commission_percentage || 15) / 100));
          existing.revenue += valor;
          existing.commission += commission;
          existing.rides += 1;
        }
      });

      setDailyStats(Array.from(dailyMap.values()));
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        setLoading(false);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setStats(null);
      setDailyStats([]);
      setLoading(false);
      hasLoadedRef.current = false;
      return;
    }

    // Reset state on (re)enter
    setStats(null);
    setDailyStats([]);
    setLoading(true);
    hasLoadedRef.current = false;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useAdminPolling(!!user, fetchDashboardData, [user?.id, fetchDashboardData]);

  return { stats, dailyStats, loading };
}

export interface PixConfig {
  key_type: 'random' | 'cpf_cnpj' | 'email' | 'phone';
  key: string;
  recipient_name: string;
  bank_name: string;
}

export function useAppSettings() {
  const { user } = useAuth();

  const [commissionPercentage, setCommissionPercentage] = useState<number>(15);
  const [maxPendingFeeLimit, setMaxPendingFeeLimit] = useState<number>(400);
  const [pixConfig, setPixConfig] = useState<PixConfig>({
    key_type: 'random',
    key: '',
    recipient_name: '',
    bank_name: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .in('key', ['app_commission_percentage', 'max_pending_fee_limit', 'pix_config']);

      if (error) throw error;

      data?.forEach((setting) => {
        if (setting.key === 'app_commission_percentage' && setting.value) {
          const val = setting.value as { value?: number } | number;
          setCommissionPercentage(typeof val === 'object' && val.value !== undefined ? val.value : Number(val));
        }
        if (setting.key === 'max_pending_fee_limit' && setting.value !== null) {
          setMaxPendingFeeLimit(Number(setting.value));
        }
        if (setting.key === 'pix_config' && setting.value) {
          setPixConfig(setting.value as unknown as PixConfig);
        }
      });
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useAdminPolling(!!user, fetchSettings, [fetchSettings]);

  const updateCommission = async (newPercentage: number) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({
          value: { value: newPercentage },
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        })
        .eq('key', 'app_commission_percentage');

      if (error) throw error;

      setCommissionPercentage(newPercentage);
      return { success: true };
    } catch (err) {
      console.error('Error updating commission:', err);
      return { success: false, error: err };
    } finally {
      setSaving(false);
    }
  };

  const updateMaxPendingFeeLimit = async (newLimit: number) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({
          value: newLimit,
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        })
        .eq('key', 'max_pending_fee_limit');

      if (error) throw error;

      setMaxPendingFeeLimit(newLimit);
      return { success: true };
    } catch (err) {
      console.error('Error updating max pending fee limit:', err);
      return { success: false, error: err };
    } finally {
      setSaving(false);
    }
  };

  const updatePixConfig = async (newConfig: PixConfig) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({
          value: JSON.parse(JSON.stringify(newConfig)),
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        })
        .eq('key', 'pix_config');

      if (error) throw error;

      setPixConfig(newConfig);
      return { success: true };
    } catch (err) {
      console.error('Error updating PIX config:', err);
      return { success: false, error: err };
    } finally {
      setSaving(false);
    }
  };

  return {
    commissionPercentage,
    maxPendingFeeLimit,
    pixConfig,
    loading,
    saving,
    updateCommission,
    updateMaxPendingFeeLimit,
    updatePixConfig,
  };
}

export function useSettingsHistory() {
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('settings_history')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    setHistory([]);
    setLoading(true);
  }, [user?.id]);

  useAdminPolling(!!user, fetchHistory, [fetchHistory]);

  return { history, loading };
}

export function useAdminProviders() {
  const { user } = useAuth();
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProviders = useCallback(async () => {
    if (!user) return;

    try {
      const { data: providerData, error: providerError } = await supabase.from('provider_data').select('*');
      if (providerError) throw providerError;

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('perfil_principal', 'provider');

      if (profilesError) throw profilesError;

      const combined =
        providerData?.map((pd) => ({
          ...pd,
          profile: profiles?.find((p) => p.user_id === pd.user_id),
        })) || [];

      setProviders(combined);
    } catch (err) {
      console.error('Error fetching providers:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    setProviders([]);
    setLoading(true);
  }, [user?.id]);

  useAdminPolling(!!user, fetchProviders, [fetchProviders]);

  const blockProvider = async (userId: string, reason: string, adminId: string) => {
    try {
      const { error } = await supabase
        .from('provider_data')
        .update({
          is_blocked: true,
          blocked_at: new Date().toISOString(),
          blocked_by: adminId,
          block_reason: reason,
          is_online: false,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;

      await supabase.from('admin_logs').insert({
        admin_id: adminId,
        action: 'block_provider',
        target_type: 'provider',
        target_id: userId,
        details: { reason },
      });

      await fetchProviders();
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  const unblockProvider = async (userId: string, adminId: string) => {
    try {
      const { error } = await supabase
        .from('provider_data')
        .update({
          is_blocked: false,
          blocked_at: null,
          blocked_by: null,
          block_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;

      await supabase.from('admin_logs').insert({
        admin_id: adminId,
        action: 'unblock_provider',
        target_type: 'provider',
        target_id: userId,
      });

      await fetchProviders();
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  const togglePayout = async (userId: string, enabled: boolean, adminId: string) => {
    try {
      const { error } = await supabase
        .from('provider_data')
        .update({ payout_enabled: enabled, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (error) throw error;

      await supabase.from('admin_logs').insert({
        admin_id: adminId,
        action: enabled ? 'enable_payout' : 'disable_payout',
        target_type: 'provider',
        target_id: userId,
      });

      await fetchProviders();
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  return { providers, loading, blockProvider, unblockProvider, togglePayout, refetch: fetchProviders };
}

export function useAdminClients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClients = useCallback(async () => {
    if (!user) return;

    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('perfil_principal', 'client');

      if (error) throw error;

      const clientsWithStats = await Promise.all(
        (profiles || []).map(async (profile) => {
          const { data: chamados } = await supabase
            .from('chamados')
            .select('valor, status')
            .eq('cliente_id', profile.user_id);

          const totalSpent =
            chamados?.filter((c) => c.status === 'finished').reduce((acc, c) => acc + (c.valor || 0), 0) || 0;
          const totalRides = chamados?.filter((c) => c.status === 'finished').length || 0;

          return {
            ...profile,
            totalSpent,
            totalRides,
          };
        })
      );

      setClients(clientsWithStats);
    } catch (err) {
      console.error('Error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    setClients([]);
    setLoading(true);
  }, [user?.id]);

  useAdminPolling(!!user, fetchClients, [fetchClients]);

  const blockClient = async (userId: string, reason: string, adminId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_blocked: true,
          blocked_at: new Date().toISOString(),
          blocked_by: adminId,
          block_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;

      await supabase.from('admin_logs').insert({
        admin_id: adminId,
        action: 'block_client',
        target_type: 'client',
        target_id: userId,
        details: { reason },
      });

      await fetchClients();
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  const unblockClient = async (userId: string, adminId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_blocked: false,
          blocked_at: null,
          blocked_by: null,
          block_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;

      await supabase.from('admin_logs').insert({
        admin_id: adminId,
        action: 'unblock_client',
        target_type: 'client',
        target_id: userId,
      });

      await fetchClients();
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  };

  return { clients, loading, blockClient, unblockClient, refetch: fetchClients };
}

export function useAdminChamados(filters?: {
  status?: ChamadoStatus;
  startDate?: string;
  endDate?: string;
  providerId?: string;
  serviceType?: ServiceType;
}) {
  const { user } = useAuth();
  const [chamados, setChamados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChamados = useCallback(async () => {
    if (!user) return;

    try {
      let query = supabase.from('chamados').select('*').order('created_at', { ascending: false });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.startDate) query = query.gte('created_at', `${filters.startDate}T00:00:00`);
      if (filters?.endDate) query = query.lte('created_at', `${filters.endDate}T23:59:59`);
      if (filters?.providerId) query = query.eq('prestador_id', filters.providerId);
      if (filters?.serviceType) query = query.eq('tipo_servico', filters.serviceType);

      const { data, error } = await query;
      if (error) throw error;

      const clientIds = [...new Set(data?.map((c) => c.cliente_id).filter(Boolean))];
      const providerIds = [...new Set(data?.map((c) => c.prestador_id).filter(Boolean))];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', [...clientIds, ...providerIds]);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));

      const enrichedChamados =
        data?.map((c) => ({
          ...c,
          cliente: profileMap.get(c.cliente_id),
          prestador: profileMap.get(c.prestador_id),
        })) || [];

      setChamados(enrichedChamados);
    } catch (err) {
      console.error('Error fetching chamados:', err);
    } finally {
      setLoading(false);
    }
  }, [
    user?.id,
    filters?.status,
    filters?.startDate,
    filters?.endDate,
    filters?.providerId,
    filters?.serviceType,
  ]);

  useEffect(() => {
    if (!user) return;
    setChamados([]);
    setLoading(true);
  }, [
    user?.id,
    filters?.status,
    filters?.startDate,
    filters?.endDate,
    filters?.providerId,
    filters?.serviceType,
  ]);

  useAdminPolling(!!user, fetchChamados, [fetchChamados]);

  return { chamados, loading };
}

export function useAdminLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('admin_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const adminIds = [...new Set(data?.map((l) => l.admin_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', adminIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p]));

      const enrichedLogs =
        data?.map((l) => ({
          ...l,
          admin: profileMap.get(l.admin_id),
        })) || [];

      setLogs(enrichedLogs);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    setLogs([]);
    setLoading(true);
  }, [user?.id]);

  useAdminPolling(!!user, fetchLogs, [fetchLogs]);

  return { logs, loading };
}
