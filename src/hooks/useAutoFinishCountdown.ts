import { useState, useEffect, useMemo, useRef } from 'react';

// Timeout duration in milliseconds (15 minutes)
const AUTO_FINISH_TIMEOUT_MS = 15 * 60 * 1000;

interface UseAutoFinishCountdownResult {
  remainingMs: number;
  remainingMinutes: number;
  remainingSeconds: number;
  formattedTime: string;
  isExpired: boolean;
  progressPercent: number;
}

/**
 * Hook to calculate and track the countdown until auto-finish
 * @param providerFinishRequestedAt - When the provider requested to finish the service
 */
export function useAutoFinishCountdown(
  providerFinishRequestedAt: Date | string | null | undefined
): UseAutoFinishCountdownResult {
  const [now, setNow] = useState(Date.now());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate the deadline
  const deadline = useMemo(() => {
    if (!providerFinishRequestedAt) return null;
    const requestTime = typeof providerFinishRequestedAt === 'string' 
      ? new Date(providerFinishRequestedAt).getTime()
      : providerFinishRequestedAt.getTime();
    return requestTime + AUTO_FINISH_TIMEOUT_MS;
  }, [providerFinishRequestedAt]);

  // Update every second
  useEffect(() => {
    if (!deadline) {
      // Cleanup any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    
    intervalRef.current = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [deadline]);

  // Calculate remaining time
  const remainingMs = deadline ? Math.max(0, deadline - now) : AUTO_FINISH_TIMEOUT_MS;
  const isExpired = remainingMs <= 0;
  
  const remainingMinutes = Math.floor(remainingMs / 60000);
  const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
  
  // Format as MM:SS
  const formattedTime = `${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  
  // Progress from 100% (full time) to 0% (expired)
  const progressPercent = (remainingMs / AUTO_FINISH_TIMEOUT_MS) * 100;

  return {
    remainingMs,
    remainingMinutes,
    remainingSeconds,
    formattedTime,
    isExpired,
    progressPercent,
  };
}