import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getDeviceId } from '@/lib/deviceFingerprint';

export interface FraudCheckResult {
  blocked: boolean;
  reason?: string;
  details?: {
    credentialType?: string;
    blockedAt?: string;
    originalReason?: string;
  };
}

export interface DebtCheckResult {
  isOverLimit: boolean;
  currentDebt: number;
  maxLimit: number;
}

export interface ProviderAcceptanceCheck {
  canAccept: boolean;
  blockReason?: string;
}

/**
 * Hook for anti-fraud checks during registration and operations.
 */
export function useAntiFraud() {
  const [isChecking, setIsChecking] = useState(false);

  /**
   * Check if any of the provided credentials are blocked.
   */
  const checkBlockedCredentials = useCallback(async (credentials: {
    cpf?: string;
    email?: string;
    phone?: string;
    deviceId?: string;
    vehiclePlate?: string;
    pixKey?: string;
  }): Promise<FraudCheckResult> => {
    setIsChecking(true);
    try {
      // Check each credential type sequentially to avoid Promise type issues
      if (credentials.cpf) {
        const { data } = await supabase.rpc('is_credential_blocked', { 
          _credential_type: 'cpf', 
          _credential_value: credentials.cpf 
        });
        if (data) {
          return {
            blocked: true,
            reason: getBlockedCredentialMessage('cpf'),
            details: { credentialType: 'cpf' }
          };
        }
      }

      if (credentials.email) {
        const { data } = await supabase.rpc('is_credential_blocked', { 
          _credential_type: 'email', 
          _credential_value: credentials.email 
        });
        if (data) {
          return {
            blocked: true,
            reason: getBlockedCredentialMessage('email'),
            details: { credentialType: 'email' }
          };
        }
      }

      if (credentials.phone) {
        const { data } = await supabase.rpc('is_credential_blocked', { 
          _credential_type: 'phone', 
          _credential_value: credentials.phone 
        });
        if (data) {
          return {
            blocked: true,
            reason: getBlockedCredentialMessage('phone'),
            details: { credentialType: 'phone' }
          };
        }
      }

      if (credentials.deviceId) {
        const { data } = await supabase.rpc('is_device_blocked', { 
          _device_id: credentials.deviceId 
        });
        if (data) {
          return {
            blocked: true,
            reason: getBlockedCredentialMessage('device_id'),
            details: { credentialType: 'device_id' }
          };
        }
      }

      if (credentials.vehiclePlate) {
        const { data } = await supabase.rpc('is_credential_blocked', { 
          _credential_type: 'vehicle_plate', 
          _credential_value: credentials.vehiclePlate.toUpperCase() 
        });
        if (data) {
          return {
            blocked: true,
            reason: getBlockedCredentialMessage('vehicle_plate'),
            details: { credentialType: 'vehicle_plate' }
          };
        }
      }

      if (credentials.pixKey) {
        const { data } = await supabase.rpc('is_credential_blocked', { 
          _credential_type: 'pix_key', 
          _credential_value: credentials.pixKey 
        });
        if (data) {
          return {
            blocked: true,
            reason: getBlockedCredentialMessage('pix_key'),
            details: { credentialType: 'pix_key' }
          };
        }
      }

      return { blocked: false };
    } catch (error) {
      console.error('[AntiFraud] Error checking blocked credentials:', error);
      return { blocked: false };
    } finally {
      setIsChecking(false);
    }
  }, []);

  /**
   * Check if provider exceeds debt limit.
   */
  const checkDebtLimit = useCallback(async (userId: string): Promise<DebtCheckResult> => {
    try {
      const { data, error } = await supabase.rpc('check_provider_debt_limit', { 
        _user_id: userId 
      });

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      
      return {
        isOverLimit: result?.is_over_limit ?? false,
        currentDebt: result?.current_debt ?? 0,
        maxLimit: result?.max_limit ?? 400
      };
    } catch (error) {
      console.error('[AntiFraud] Error checking debt limit:', error);
      return { isOverLimit: false, currentDebt: 0, maxLimit: 400 };
    }
  }, []);

  /**
   * Check if provider can accept chamados.
   */
  const checkProviderCanAccept = useCallback(async (userId: string): Promise<ProviderAcceptanceCheck> => {
    try {
      const { data, error } = await supabase.rpc('can_provider_accept_chamados', { 
        _user_id: userId 
      });

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      
      return {
        canAccept: result?.can_accept ?? true,
        blockReason: result?.block_reason ?? undefined
      };
    } catch (error) {
      console.error('[AntiFraud] Error checking provider acceptance:', error);
      return { canAccept: true };
    }
  }, []);

  /**
   * Register device ID for a provider.
   */
  const registerDeviceId = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const deviceId = await getDeviceId();
      
      const { error } = await supabase
        .from('provider_data')
        .update({
          device_id: deviceId,
          device_id_registered_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error('[AntiFraud] Error registering device ID:', error);
      return false;
    }
  }, []);

  /**
   * Full pre-registration check for providers.
   */
  const performPreRegistrationCheck = useCallback(async (credentials: {
    cpf: string;
    email: string;
    phone?: string;
    vehiclePlate?: string;
  }): Promise<FraudCheckResult> => {
    setIsChecking(true);
    try {
      const deviceId = await getDeviceId();
      
      return await checkBlockedCredentials({
        ...credentials,
        deviceId
      });
    } finally {
      setIsChecking(false);
    }
  }, [checkBlockedCredentials]);

  return {
    isChecking,
    checkBlockedCredentials,
    checkDebtLimit,
    checkProviderCanAccept,
    registerDeviceId,
    performPreRegistrationCheck,
    getDeviceId
  };
}

function getBlockedCredentialMessage(type: string): string {
  switch (type) {
    case 'cpf':
      return 'Este CPF está associado a uma conta bloqueada.';
    case 'email':
      return 'Este email está associado a uma conta bloqueada.';
    case 'phone':
      return 'Este telefone está associado a uma conta bloqueada.';
    case 'device_id':
      return 'Este dispositivo está associado a uma conta bloqueada.';
    case 'vehicle_plate':
      return 'Esta placa de veículo está associada a uma conta bloqueada.';
    case 'pix_key':
      return 'Esta chave PIX está associada a uma conta bloqueada.';
    default:
      return 'Credencial bloqueada.';
  }
}
