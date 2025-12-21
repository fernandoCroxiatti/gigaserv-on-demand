import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type FeeType = 'STRIPE' | 'MANUAL_PIX';
export type FinancialStatus = 'PAGO' | 'DEVENDO' | 'AGUARDANDO_APROVACAO';

export interface AdminProviderFee {
  id: string;
  chamadoId: string;
  providerId: string;
  providerName: string;
  providerEmail: string;
  serviceValue: number;
  feePercentage: number;
  feeAmount: number;
  feeType: FeeType;
  status: FinancialStatus;
  paymentDeclaredAt: string | null;
  paymentApprovedAt: string | null;
  paymentProofUrl: string | null;
  createdAt: string;
}

export interface AdminProviderFinancial {
  providerId: string;
  providerName: string;
  providerEmail: string;
  pendingBalance: number;
  financialStatus: FinancialStatus;
  lastPaymentAt: string | null;
  isBlocked: boolean;
  totalFees: number;
  stripeFees: number;
  manualFees: number;
  proofUrl: string | null;
}

export interface PixConfig {
  key_type: 'random' | 'cpf_cnpj' | 'email' | 'phone';
  key: string;
  recipient_name: string;
  bank_name: string;
}

type FilterType = 'all' | 'PAGO' | 'DEVENDO' | 'AGUARDANDO_APROVACAO' | 'STRIPE' | 'MANUAL_PIX';

export function useAdminFees(filter: FilterType = 'all') {
  const [providers, setProviders] = useState<AdminProviderFinancial[]>([]);
  const [fees, setFees] = useState<AdminProviderFee[]>([]);
  const [pixConfig, setPixConfig] = useState<PixConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all fees
      const { data: feesData, error: feesError } = await supabase
        .from('provider_fees')
        .select('*')
        .order('created_at', { ascending: false });

      if (feesError) throw feesError;

      // Fetch all provider profiles
      const providerIds = [...new Set(feesData?.map(f => f.provider_id) || [])];
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', providerIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      // Fetch provider data for financial status
      const { data: providerDataList, error: providerError } = await supabase
        .from('provider_data')
        .select('user_id, financial_status, pending_fee_balance, financial_blocked');

      if (providerError) throw providerError;

      const providerDataMap = new Map(providerDataList?.map(pd => [pd.user_id, pd]) || []);

      // Map fees with provider info
      const mappedFees: AdminProviderFee[] = (feesData || []).map((f: any) => {
        const profile = profileMap.get(f.provider_id);
        return {
          id: f.id,
          chamadoId: f.chamado_id,
          providerId: f.provider_id,
          providerName: profile?.name || 'Desconhecido',
          providerEmail: profile?.email || '',
          serviceValue: f.service_value,
          feePercentage: f.fee_percentage,
          feeAmount: f.fee_amount,
          feeType: f.fee_type,
          status: f.status,
          paymentDeclaredAt: f.payment_declared_at,
          paymentApprovedAt: f.payment_approved_at,
          paymentProofUrl: f.payment_proof_url,
          createdAt: f.created_at,
        };
      });

      // Apply filters
      let filteredFees = mappedFees;
      if (filter === 'STRIPE' || filter === 'MANUAL_PIX') {
        filteredFees = mappedFees.filter(f => f.feeType === filter);
      } else if (filter === 'PAGO' || filter === 'DEVENDO' || filter === 'AGUARDANDO_APROVACAO') {
        filteredFees = mappedFees.filter(f => f.status === filter);
      }

      setFees(filteredFees);

      // Aggregate by provider
      const providerAggregates = new Map<string, AdminProviderFinancial>();

      for (const fee of mappedFees) {
        const existing = providerAggregates.get(fee.providerId);
        const providerData = providerDataMap.get(fee.providerId);

        if (existing) {
          existing.totalFees += fee.feeAmount;
          if (fee.feeType === 'STRIPE') {
            existing.stripeFees += fee.feeAmount;
          } else {
            existing.manualFees += fee.feeAmount;
            if (fee.status === 'DEVENDO') {
              existing.pendingBalance += fee.feeAmount;
            }
          }
          if (fee.paymentApprovedAt && (!existing.lastPaymentAt || fee.paymentApprovedAt > existing.lastPaymentAt)) {
            existing.lastPaymentAt = fee.paymentApprovedAt;
          }
          // Update proof URL if newer
          if (fee.paymentProofUrl && fee.status === 'AGUARDANDO_APROVACAO') {
            existing.proofUrl = fee.paymentProofUrl;
          }
        } else {
          providerAggregates.set(fee.providerId, {
            providerId: fee.providerId,
            providerName: fee.providerName,
            providerEmail: fee.providerEmail,
            pendingBalance: fee.feeType === 'MANUAL_PIX' && fee.status === 'DEVENDO' ? fee.feeAmount : 0,
            financialStatus: (providerData?.financial_status as FinancialStatus) || 'PAGO',
            lastPaymentAt: fee.paymentApprovedAt,
            isBlocked: providerData?.financial_blocked || false,
            totalFees: fee.feeAmount,
            stripeFees: fee.feeType === 'STRIPE' ? fee.feeAmount : 0,
            manualFees: fee.feeType === 'MANUAL_PIX' ? fee.feeAmount : 0,
            proofUrl: fee.paymentProofUrl,
          });
        }
      }

      let providersList = Array.from(providerAggregates.values());

      // Filter providers list
      if (filter === 'PAGO' || filter === 'DEVENDO' || filter === 'AGUARDANDO_APROVACAO') {
        providersList = providersList.filter(p => p.financialStatus === filter);
      }

      setProviders(providersList);

      // Fetch PIX config
      const { data: pixData, error: pixError } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'pix_config')
        .single();

      if (pixError && pixError.code !== 'PGRST116') throw pixError;

      if (pixData?.value) {
        setPixConfig(pixData.value as unknown as PixConfig);
      }

    } catch (err) {
      console.error('Error fetching admin fees:', err);
      setError('Erro ao carregar dados financeiros');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const approvePayment = async (providerId: string, adminId: string) => {
    try {
      // Update all AGUARDANDO_APROVACAO fees to PAGO
      const { error: feesError } = await supabase
        .from('provider_fees')
        .update({
          status: 'PAGO',
          payment_approved_at: new Date().toISOString(),
          payment_approved_by: adminId,
        })
        .eq('provider_id', providerId)
        .eq('status', 'AGUARDANDO_APROVACAO');

      if (feesError) throw feesError;

      // Update provider financial status
      const { error: providerError } = await supabase
        .from('provider_data')
        .update({
          financial_status: 'PAGO',
          pending_fee_balance: 0,
          financial_blocked: false,
          financial_block_reason: null,
        })
        .eq('user_id', providerId);

      if (providerError) throw providerError;

      // Log admin action
      await supabase.from('admin_logs').insert({
        admin_id: adminId,
        action: 'approve_fee_payment',
        target_type: 'provider',
        target_id: providerId,
      });

      // Send notification to provider
      try {
        await supabase.functions.invoke('send-notifications', {
          body: {
            action: 'event',
            userId: providerId,
            notificationType: 'payment_approved',
            title: '✅ Pagamento Confirmado',
            messageBody: 'Seu pagamento de taxa foi aprovado. Seu acesso foi liberado!',
            data: { type: 'payment_approved' },
          },
        });
      } catch (notifErr) {
        console.error('Error sending provider notification:', notifErr);
      }

      await fetchData();
      return { success: true };
    } catch (err) {
      console.error('Error approving payment:', err);
      return { success: false, error: 'Erro ao aprovar pagamento' };
    }
  };

  const rejectPayment = async (providerId: string, adminId: string) => {
    try {
      // Update all AGUARDANDO_APROVACAO fees back to DEVENDO
      const { error: feesError } = await supabase
        .from('provider_fees')
        .update({
          status: 'DEVENDO',
          payment_rejected_at: new Date().toISOString(),
          payment_rejected_by: adminId,
          payment_declared_at: null,
        })
        .eq('provider_id', providerId)
        .eq('status', 'AGUARDANDO_APROVACAO');

      if (feesError) throw feesError;

      // Calculate pending balance
      const { data: pendingFees } = await supabase
        .from('provider_fees')
        .select('fee_amount')
        .eq('provider_id', providerId)
        .eq('status', 'DEVENDO')
        .eq('fee_type', 'MANUAL_PIX');

      const pendingBalance = pendingFees?.reduce((acc, f) => acc + f.fee_amount, 0) || 0;

      // Update provider financial status
      const { error: providerError } = await supabase
        .from('provider_data')
        .update({
          financial_status: 'DEVENDO',
          pending_fee_balance: pendingBalance,
        })
        .eq('user_id', providerId);

      if (providerError) throw providerError;

      // Log admin action
      await supabase.from('admin_logs').insert({
        admin_id: adminId,
        action: 'reject_fee_payment',
        target_type: 'provider',
        target_id: providerId,
      });

      // Send notification to provider
      try {
        await supabase.functions.invoke('send-notifications', {
          body: {
            action: 'event',
            userId: providerId,
            notificationType: 'payment_rejected',
            title: '❌ Pagamento Recusado',
            messageBody: `Seu pagamento foi recusado. Saldo pendente: R$ ${pendingBalance.toFixed(2)}`,
            data: { type: 'payment_rejected', pendingBalance },
          },
        });
      } catch (notifErr) {
        console.error('Error sending provider notification:', notifErr);
      }

      await fetchData();
      return { success: true };
    } catch (err) {
      console.error('Error rejecting payment:', err);
      return { success: false, error: 'Erro ao recusar pagamento' };
    }
  };

  const updatePixConfig = async (config: PixConfig) => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({
          value: JSON.parse(JSON.stringify(config)),
          updated_at: new Date().toISOString(),
        })
        .eq('key', 'pix_config');

      if (error) throw error;

      setPixConfig(config);
      return { success: true };
    } catch (err) {
      console.error('Error updating PIX config:', err);
      return { success: false, error: 'Erro ao atualizar configuração PIX' };
    }
  };

  return {
    providers,
    fees,
    pixConfig,
    loading,
    error,
    refetch: fetchData,
    approvePayment,
    rejectPayment,
    updatePixConfig,
  };
}
