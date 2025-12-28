import { useEffect, useRef } from 'react';
import { playProviderFoundSound } from '@/lib/audioManager';

/**
 * Hook para tocar som quando um prestador é encontrado/aceita o chamado
 * 
 * Comportamento:
 * - Toca apenas uma vez quando status muda para 'accepted' ou 'negotiating'
 * - Não repete em re-renderizações
 * - Usa o AudioManager centralizado
 */
export function useProviderFoundSound(
  chamadoStatus: string | undefined,
  chamadoId: string | undefined
): void {
  // Ref para rastrear se já tocamos o som para este chamado específico
  const hasPlayedRef = useRef<string | null>(null);

  useEffect(() => {
    // Só processa se temos um chamado válido
    if (!chamadoId || !chamadoStatus) {
      return;
    }

    // Verifica se o status indica que o prestador foi encontrado
    const isProviderFound = chamadoStatus === 'accepted' || chamadoStatus === 'negotiating';

    // Só toca se:
    // 1. O prestador foi encontrado
    // 2. Ainda não tocamos para este chamado específico
    if (isProviderFound && hasPlayedRef.current !== chamadoId) {
      console.log('[useProviderFoundSound] Provider found! Playing sound for chamado:', chamadoId);
      playProviderFoundSound();
      hasPlayedRef.current = chamadoId;
    }

    // Reset se o chamado voltar para idle/searching (novo chamado)
    if (chamadoStatus === 'idle' || chamadoStatus === 'searching') {
      hasPlayedRef.current = null;
    }
  }, [chamadoStatus, chamadoId]);
}
