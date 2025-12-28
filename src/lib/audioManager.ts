/**
 * AudioManager - Módulo centralizado e único para gerenciamento de áudio
 * 
 * REGRAS:
 * - Toda reprodução de som deve passar exclusivamente por este módulo
 * - Nenhum outro ponto do app pode chamar audio.play() diretamente
 * - Se o áudio não estiver desbloqueado, ignora silenciosamente
 */

// Estado interno do gerenciador de áudio
let audioUnlocked = false;
let audioContext: AudioContext | null = null;

// URL do som de notificação (arquivo padrão do sistema ou arquivo customizado)
const NOTIFICATION_SOUND_URL = '/notification.mp3';

// Audio element reutilizável
let notificationAudio: HTMLAudioElement | null = null;

/**
 * Desbloqueia o contexto de áudio do navegador
 * Deve ser chamado em resposta a uma interação do usuário (clique, toque, etc.)
 * 
 * Esta função é idempotente - pode ser chamada múltiplas vezes sem problemas
 */
export function unlockAudio(): void {
  if (audioUnlocked) {
    return; // Já desbloqueado
  }

  try {
    // Criar AudioContext se não existir
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioContext = new AudioContextClass();
      }
    }

    // Resume o AudioContext se estiver suspenso
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        console.log('[AudioManager] AudioContext resumed successfully');
      }).catch((err) => {
        console.warn('[AudioManager] Failed to resume AudioContext:', err);
      });
    }

    // Pré-carregar o áudio de notificação silenciosamente
    if (!notificationAudio) {
      notificationAudio = new Audio(NOTIFICATION_SOUND_URL);
      notificationAudio.preload = 'auto';
      notificationAudio.volume = 0;
      
      // Tocar silenciosamente para desbloquear
      notificationAudio.play().then(() => {
        notificationAudio!.pause();
        notificationAudio!.currentTime = 0;
        notificationAudio!.volume = 1;
        console.log('[AudioManager] Audio unlocked via silent play');
      }).catch((err) => {
        // Ignorar erros - isso é esperado em alguns cenários
        console.log('[AudioManager] Silent play failed (expected):', err.message);
      });
    }

    audioUnlocked = true;
    console.log('[AudioManager] Audio unlocked');
  } catch (error) {
    // Não quebrar o fluxo - apenas logar
    console.warn('[AudioManager] Error during unlock attempt:', error);
  }
}

/**
 * Reproduz o som de notificação
 * 
 * Comportamento:
 * - Só toca se audioUnlocked === true
 * - Ignora silenciosamente se não estiver desbloqueado
 * - Nunca lança erro ou quebra o fluxo
 */
export function playNotificationSound(): void {
  if (!audioUnlocked) {
    console.log('[AudioManager] Audio not unlocked, skipping notification sound');
    return;
  }

  try {
    if (!notificationAudio) {
      notificationAudio = new Audio(NOTIFICATION_SOUND_URL);
    }

    // Reset e tocar
    notificationAudio.currentTime = 0;
    notificationAudio.volume = 1;
    
    const playPromise = notificationAudio.play();
    
    if (playPromise !== undefined) {
      playPromise.catch((error) => {
        // Ignorar erros silenciosamente
        console.log('[AudioManager] Notification sound failed (non-critical):', error.message);
      });
    }
  } catch (error) {
    // Nunca quebrar o fluxo do app
    console.log('[AudioManager] Error playing notification sound (non-critical):', error);
  }
}

/**
 * Verifica se o áudio está desbloqueado
 */
export function isAudioUnlocked(): boolean {
  return audioUnlocked;
}

/**
 * Obtém o estado atual do gerenciador de áudio (para debug)
 */
export function getAudioManagerState(): { unlocked: boolean; contextState: string | null } {
  return {
    unlocked: audioUnlocked,
    contextState: audioContext?.state || null,
  };
}
