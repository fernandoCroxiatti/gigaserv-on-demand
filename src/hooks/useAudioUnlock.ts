import { useEffect, useRef } from 'react';
import { unlockAudio } from '@/lib/audioManager';

/**
 * Hook para adicionar listener passivo de desbloqueio de áudio
 * 
 * COMPORTAMENTO:
 * - Adiciona um listener global de clique que desbloqueia o áudio
 * - Remove o listener após o primeiro clique (desbloqueio único)
 * - Não altera nenhuma lógica existente do app
 * - Falhas são silenciosas e não afetam o funcionamento
 */
export function useAudioUnlock(): void {
  const unlockAttemptedRef = useRef(false);

  useEffect(() => {
    // Função que será chamada em qualquer clique/toque
    const handleUserInteraction = () => {
      if (unlockAttemptedRef.current) {
        return;
      }
      
      unlockAttemptedRef.current = true;
      
      try {
        unlockAudio();
      } catch (error) {
        // Ignorar erros silenciosamente
        console.log('[useAudioUnlock] Unlock attempt failed (non-critical):', error);
      }

      // Remover listeners após o primeiro uso
      document.removeEventListener('click', handleUserInteraction, true);
      document.removeEventListener('touchstart', handleUserInteraction, true);
    };

    // Adicionar listeners em modo capture para capturar antes de qualquer handler
    document.addEventListener('click', handleUserInteraction, true);
    document.addEventListener('touchstart', handleUserInteraction, true);

    return () => {
      document.removeEventListener('click', handleUserInteraction, true);
      document.removeEventListener('touchstart', handleUserInteraction, true);
    };
  }, []);
}
