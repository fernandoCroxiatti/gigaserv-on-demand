import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type FeeType = 'STRIPE' | 'MANUAL_PIX';
export type FinancialStatus = 'PAGO' | 'DEVENDO' | 'AGUARDANDO_APROVACAO';

export interface ProviderFee {
  id: string;
  chamadoId: string;
  providerId: string;
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

export interface ProviderFinancialStatus {
  status: FinancialStatus;
  pendingBalance: number;
  isBlocked: boolean;
  blockReason: string | null;
}

export interface PixConfig {
  key_type: 'random' | 'cpf_cnpj' | 'email' | 'phone';
  key: string;
  recipient_name: string;
  bank_name: string;
}

export function useProviderFees() {
  const { user } = useAuth();
  const [fees, setFees] = useState<ProviderFee[]>([]);
  const [financialStatus, setFinancialStatus] = useState<ProviderFinancialStatus | null>(null);
  const [pixConfig, setPixConfig] = useState<PixConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFees = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch provider fees
      const { data: feesData, error: feesError } = await supabase
        .from('provider_fees')
        .select('*')
        .eq('provider_id', user.id)
        .order('created_at', { ascending: false });

      if (feesError) throw feesError;

      const mappedFees: ProviderFee[] = (feesData || []).map((f: any) => ({
        id: f.id,
        chamadoId: f.chamado_id,
        providerId: f.provider_id,
        serviceValue: f.service_value,
        feePercentage: f.fee_percentage,
        feeAmount: f.fee_amount,
        feeType: f.fee_type,
        status: f.status,
        paymentDeclaredAt: f.payment_declared_at,
        paymentApprovedAt: f.payment_approved_at,
        paymentProofUrl: f.payment_proof_url,
        createdAt: f.created_at,
      }));

      setFees(mappedFees);

      // Fetch provider financial status
      const { data: providerData, error: providerError } = await supabase
        .from('provider_data')
        .select('financial_status, pending_fee_balance, financial_blocked, financial_block_reason')
        .eq('user_id', user.id)
        .single();

      if (providerError && providerError.code !== 'PGRST116') throw providerError;

      if (providerData) {
        setFinancialStatus({
          status: providerData.financial_status || 'PAGO',
          pendingBalance: providerData.pending_fee_balance || 0,
          isBlocked: providerData.financial_blocked || false,
          blockReason: providerData.financial_block_reason,
        });
      }

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
      console.error('Error fetching fees:', err);
      setError('Erro ao carregar dados financeiros');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('provider-fees')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'provider_fees',
          filter: `provider_id=eq.${user.id}`,
        },
        () => {
          fetchFees();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchFees]);

  const declarePayment = async (proofUrl?: string) => {
    if (!user?.id) return { success: false, error: 'Usuário não autenticado' };

    try {
      // Update all DEVENDO fees to AGUARDANDO_APROVACAO
      const { error: updateError } = await supabase
        .from('provider_fees')
        .update({
          status: 'AGUARDANDO_APROVACAO',
          payment_declared_at: new Date().toISOString(),
          payment_proof_url: proofUrl || null,
        })
        .eq('provider_id', user.id)
        .eq('status', 'DEVENDO');

      if (updateError) throw updateError;

      // Update provider financial status
      const { error: providerError } = await supabase
        .from('provider_data')
        .update({
          financial_status: 'AGUARDANDO_APROVACAO',
        })
        .eq('user_id', user.id);

      if (providerError) throw providerError;

      // Get provider name for notification
      const { data: profileData } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', user.id)
        .single();

      const providerName = profileData?.name || 'Prestador';
      const pendingAmount = pendingFees.reduce((acc, f) => acc + f.feeAmount, 0);

      // Notify all admins about the payment declaration
      try {
        await supabase.functions.invoke('notify-admin-payment', {
          body: {
            providerId: user.id,
            providerName,
            amount: pendingAmount,
          }
        });
      } catch (notifErr) {
        console.error('Error sending admin notification:', notifErr);
        // Don't block the flow
      }

      await fetchFees();
      return { success: true };
    } catch (err) {
      console.error('Error declaring payment:', err);
      return { success: false, error: 'Erro ao declarar pagamento' };
    }
  };

  // Calculate totals
  const stripeFees = fees.filter(f => f.feeType === 'STRIPE');
  const manualFees = fees.filter(f => f.feeType === 'MANUAL_PIX');
  const pendingFees = manualFees.filter(f => f.status === 'DEVENDO');
  const awaitingApprovalFees = manualFees.filter(f => f.status === 'AGUARDANDO_APROVACAO');

  const totalStripeFees = stripeFees.reduce((acc, f) => acc + f.feeAmount, 0);
  const totalManualFees = manualFees.reduce((acc, f) => acc + f.feeAmount, 0);
  const pendingBalance = pendingFees.reduce((acc, f) => acc + f.feeAmount, 0);

  return {
    fees,
    stripeFees,
    manualFees,
    pendingFees,
    awaitingApprovalFees,
    financialStatus,
    pixConfig,
    loading,
    error,
    refetch: fetchFees,
    declarePayment,
    totals: {
      stripeFees: totalStripeFees,
      manualFees: totalManualFees,
      pendingBalance,
    },
  };
}
