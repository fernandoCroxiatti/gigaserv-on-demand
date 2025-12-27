import React from 'react';
import { useOneSignal } from '@/hooks/useOneSignal';

interface NotificationProviderProps {
  children: React.ReactNode;
  activeProfile?: 'client' | 'provider';
}

/**
 * Notification Provider using OneSignal
 * 
 * - Initializes OneSignal SDK
 * - Associates user ID after login
 * - No automatic permission prompts (handled by Auth flow)
 * - No visual UI
 */
export function NotificationProvider({ children, activeProfile }: NotificationProviderProps) {
  // Initialize OneSignal and handle user association
  useOneSignal({ activeProfile });

  return <>{children}</>;
}
