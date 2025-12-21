import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface FinancialBlockStatus {
  isBlocked: boolean;
  reason: string | null;
  pendingBalance: number;
  financialStatus: 'PAGO' | 'DEVENDO' | 'AGUARDANDO_APROVACAO' | null;
}

export function useProviderFinancialBlock() {
  const { user } = useAuth();
  const [checking, setChecking] = useState(false);

  const checkFinancialBlock = useCallback(async (): Promise<FinancialBlockStatus> => {
    if (!user?.id) {
      return {
        isBlocked: false,
        reason: null,
        pendingBalance: 0,
        financialStatus: null,
      };
    }

    setChecking(true);

    try {
      // Fetch provider data with financial status
      const { data: providerData, error } = await supabase
        .from('provider_data')
        .select('financial_status, pending_fee_balance, financial_blocked, financial_block_reason')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error checking financial block:', error);
        return {
          isBlocked: false,
          reason: null,
          pendingBalance: 0,
          financialStatus: null,
        };
      }

      const status = providerData?.financial_status as 'PAGO' | 'DEVENDO' | 'AGUARDANDO_APROVACAO' | null;
      const pendingBalance = Number(providerData?.pending_fee_balance) || 0;
      const isBlocked = providerData?.financial_blocked || false;
      const blockReason = providerData?.financial_block_reason || null;

      // Block conditions:
      // 1. financial_blocked is true
      // 2. Status is DEVENDO with pending balance > 0
      // 3. Status is AGUARDANDO_APROVACAO (waiting for admin approval)
      const shouldBlock = isBlocked || 
        (status === 'DEVENDO' && pendingBalance > 0) ||
        status === 'AGUARDANDO_APROVACAO';

      let reason = blockReason;
      if (!reason && shouldBlock) {
        if (status === 'AGUARDANDO_APROVACAO') {
          reason = 'Aguardando aprovação do pagamento da taxa';
        } else if (status === 'DEVENDO' && pendingBalance > 0) {
          reason = `Você possui taxas pendentes de R$ ${pendingBalance.toFixed(2)}`;
        }
      }

      return {
        isBlocked: shouldBlock,
        reason,
        pendingBalance,
        financialStatus: status,
      };
    } catch (err) {
      console.error('Error:', err);
      return {
        isBlocked: false,
        reason: null,
        pendingBalance: 0,
        financialStatus: null,
      };
    } finally {
      setChecking(false);
    }
  }, [user?.id]);

  return { checkFinancialBlock, checking };
}
