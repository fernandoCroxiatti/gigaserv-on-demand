// Ride alert sound system with looping capability
// Creates an urgent, Uber-like alert sound with two sequential beeps

let audioContext: AudioContext | null = null;
let loopInterval: ReturnType<typeof setInterval> | null = null;
let isPlaying = false;

// Sound configuration
const LOOP_INTERVAL_MS = 2000; // Repeat every 2 seconds
const BEEP_DURATION = 0.12; // Duration of each beep in seconds
const BEEP_GAP = 0.08; // Gap between beeps in seconds
const FREQUENCY_1 = 1200; // First beep frequency (Hz) - medium-high
const FREQUENCY_2 = 1400; // Second beep frequency (Hz) - higher
const VOLUME = 0.7; // Normalized volume

/**
 * Creates and plays a single alert sound (two sequential beeps)
 */
const playAlertBeep = () => {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Resume context if suspended (required for some browsers)
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const now = audioContext.currentTime;

    // First beep
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    osc1.frequency.setValueAtTime(FREQUENCY_1, now);
    osc1.type = 'sine';
    gain1.gain.setValueAtTime(VOLUME, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + BEEP_DURATION);
    osc1.start(now);
    osc1.stop(now + BEEP_DURATION);

    // Second beep (after gap)
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    osc2.frequency.setValueAtTime(FREQUENCY_2, now + BEEP_DURATION + BEEP_GAP);
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.setValueAtTime(VOLUME, now + BEEP_DURATION + BEEP_GAP);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + BEEP_DURATION * 2 + BEEP_GAP);
    osc2.start(now + BEEP_DURATION + BEEP_GAP);
    osc2.stop(now + BEEP_DURATION * 2 + BEEP_GAP);

    // Vibrate if supported (synchronized with sound)
    if ('vibrate' in navigator) {
      navigator.vibrate([150, 80, 150]); // Matches the two-beep pattern
    }
  } catch (error) {
    console.error('Error playing alert beep:', error);
  }
};

/**
 * Starts the ride alert loop
 * Plays alert sound immediately and then every 2 seconds
 */
export const startRideAlertLoop = () => {
  if (isPlaying) {
    console.log('[RideAlert] Already playing, ignoring start');
    return;
  }

  console.log('[RideAlert] Starting alert loop');
  isPlaying = true;

  // Play immediately
  playAlertBeep();

  // Set up loop
  loopInterval = setInterval(() => {
    if (isPlaying) {
      playAlertBeep();
    }
  }, LOOP_INTERVAL_MS);
};

/**
 * Stops the ride alert loop immediately
 */
export const stopRideAlertLoop = () => {
  console.log('[RideAlert] Stopping alert loop');
  isPlaying = false;

  if (loopInterval) {
    clearInterval(loopInterval);
    loopInterval = null;
  }

  // Stop any vibration
  if ('vibrate' in navigator) {
    navigator.vibrate(0);
  }
};

/**
 * Check if alert is currently playing
 */
export const isAlertPlaying = () => isPlaying;

/**
 * Cleanup function - call when component unmounts
 */
export const cleanupRideAlert = () => {
  stopRideAlertLoop();
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
};
