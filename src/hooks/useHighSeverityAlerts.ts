import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from './useAdmin';

/**
 * Hook to listen for high severity suspicious patterns and notify admins
 * This runs only on admin sessions to trigger the notification edge function
 */
export const useHighSeverityAlerts = () => {
  const { isAdmin } = useAdmin();
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    // Only admins should trigger notifications
    if (!isAdmin) return;

    console.log('[useHighSeverityAlerts] Setting up realtime listener for high severity patterns');

    const channel = supabase
      .channel('high-severity-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'suspicious_patterns',
          filter: 'severity=eq.high',
        },
        async (payload) => {
          console.log('[useHighSeverityAlerts] High severity pattern detected:', payload.new);
          
          const pattern = payload.new as {
            id: string;
            pattern_type: string;
            client_id: string;
            provider_id: string;
            chamado_id?: string;
            severity: string;
            details?: { detection_reason?: string; auto_detected?: boolean };
          };

          // Only auto-notify for auto-detected patterns
          if (!pattern.details?.auto_detected) {
            console.log('[useHighSeverityAlerts] Skipping non-auto-detected pattern');
            return;
          }

          try {
            const { error } = await supabase.functions.invoke('notify-admin-suspicious', {
              body: {
                patternId: pattern.id,
                patternType: pattern.pattern_type,
                clientId: pattern.client_id,
                providerId: pattern.provider_id,
                chamadoId: pattern.chamado_id,
                severity: pattern.severity,
                detectionReason: pattern.details?.detection_reason || pattern.pattern_type,
                details: pattern.details,
              },
            });

            if (error) {
              console.error('[useHighSeverityAlerts] Failed to send admin notification:', error);
            } else {
              console.log('[useHighSeverityAlerts] Admin notification sent successfully');
            }
          } catch (err) {
            console.error('[useHighSeverityAlerts] Error invoking notification function:', err);
          }
        }
      )
      .subscribe((status) => {
        console.log('[useHighSeverityAlerts] Subscription status:', status);
      });

    subscriptionRef.current = channel;

    return () => {
      console.log('[useHighSeverityAlerts] Cleaning up subscription');
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [isAdmin]);
};
