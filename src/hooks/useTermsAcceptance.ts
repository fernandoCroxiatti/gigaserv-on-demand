import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const CURRENT_TERMS_VERSION = '2024-12-21';

interface UseTermsAcceptanceReturn {
  needsAcceptance: boolean;
  isLoading: boolean;
  acceptTerms: () => Promise<boolean>;
  checkAcceptance: () => Promise<void>;
}

export function useTermsAcceptance(userId: string | null, isProvider: boolean): UseTermsAcceptanceReturn {
  const [needsAcceptance, setNeedsAcceptance] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkAcceptance = useCallback(async () => {
    if (!userId || !isProvider) {
      setNeedsAcceptance(false);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc('provider_needs_terms_acceptance', { _user_id: userId });

      if (error) {
        console.error('Error checking terms acceptance:', error);
        setNeedsAcceptance(false);
      } else {
        setNeedsAcceptance(data === true);
      }
    } catch (err) {
      console.error('Error checking terms acceptance:', err);
      setNeedsAcceptance(false);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isProvider]);

  useEffect(() => {
    checkAcceptance();
  }, [checkAcceptance]);

  const acceptTerms = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;

    try {
      const { error } = await supabase
        .rpc('accept_terms', { _user_id: userId });

      if (error) {
        console.error('Error accepting terms:', error);
        return false;
      }

      setNeedsAcceptance(false);
      return true;
    } catch (err) {
      console.error('Error accepting terms:', err);
      return false;
    }
  }, [userId]);

  return {
    needsAcceptance,
    isLoading,
    acceptTerms,
    checkAcceptance,
  };
}
