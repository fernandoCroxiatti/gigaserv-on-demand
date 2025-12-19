import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OtherPartyContact {
  phone: string | null;
  name: string;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to fetch the phone number and name of the other party in an active chamado
 * Provider mode: fetches client info
 * Client mode: fetches provider info
 */
export function useOtherPartyContact(
  mode: 'provider' | 'client',
  chamadoId: string | undefined,
  clienteId: string | undefined,
  prestadorId: string | undefined
): OtherPartyContact {
  const [phone, setPhone] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chamadoId) {
      setLoading(false);
      return;
    }

    const targetUserId = mode === 'provider' ? clienteId : prestadorId;

    if (!targetUserId) {
      setLoading(false);
      setError('Usuário não encontrado');
      return;
    }

    const fetchContact = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('phone, name')
          .eq('user_id', targetUserId)
          .single();

        if (fetchError) {
          console.error('[Contact] Error fetching profile:', fetchError);
          setError('Erro ao carregar contato');
          return;
        }

        setPhone(data?.phone || null);
        setName(data?.name || 'Usuário');
      } catch (err) {
        console.error('[Contact] Unexpected error:', err);
        setError('Erro inesperado');
      } finally {
        setLoading(false);
      }
    };

    fetchContact();
  }, [chamadoId, clienteId, prestadorId, mode]);

  return { phone, name, loading, error };
}
