// Deep link handler for notifications
import { toast } from 'sonner';

export interface NotificationData {
  url?: string;
  chamadoId?: string;
  notificationType?: string;
  timestamp?: number;
}

// Handle notification deep link navigation
export function handleNotificationNavigation(
  data: NotificationData,
  navigate: (path: string) => void
): void {
  console.log('[DeepLinks] Handling navigation with data:', data);

  // Use explicit URL if provided
  if (data.url && data.url !== '/') {
    navigate(data.url);
    return;
  }

  // Fallback: determine route based on notification type
  const type = data.notificationType || '';

  if (data.chamadoId) {
    // Navigate to main with chamado context
    navigate(`/?chamado=${data.chamadoId}`);
    return;
  }

  if (type.includes('payment')) {
    navigate('/profile?tab=payments');
    return;
  }

  if (type.includes('stripe') || type.includes('payout') || type.includes('bank')) {
    navigate('/profile?tab=bank');
    return;
  }

  if (type.includes('fee') || type.includes('pending')) {
    navigate('/profile?tab=fees');
    return;
  }

  if (type.includes('profile') || type.includes('cadastro')) {
    navigate('/profile');
    return;
  }

  // Default: navigate to main screen
  navigate('/');
}

// Mark notification as clicked in history
export async function markNotificationClicked(
  notificationId: string,
  supabase: { from: (table: string) => { update: (data: object) => { eq: (column: string, value: string) => Promise<unknown> } } }
): Promise<void> {
  try {
    await supabase
      .from('notification_history')
      .update({ clicked_at: new Date().toISOString() })
      .eq('id', notificationId);
      
    console.log('[DeepLinks] Notification marked as clicked:', notificationId);
  } catch (error) {
    console.error('[DeepLinks] Error marking notification as clicked:', error);
  }
}

// Show a toast for foreground notifications
export function showForegroundNotification(
  title: string,
  body: string,
  data: NotificationData,
  navigate: (path: string) => void
): void {
  toast(title, {
    description: body,
    action: {
      label: 'Ver',
      onClick: () => handleNotificationNavigation(data, navigate)
    },
    duration: 5000
  });
}
