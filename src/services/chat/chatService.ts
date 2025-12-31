/**
 * Chat Service - Database operations for chat messages
 */

import { supabase } from '@/integrations/supabase/client';
import { ChatMessage, UserProfile } from '@/domain/chamado/types';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface DbChatMessage {
  id: string;
  chamado_id: string;
  sender_id: string | null;
  sender_type: string;
  message: string;
  created_at: string;
}

/**
 * Map database chat message to domain
 */
function mapDbChatMessage(db: DbChatMessage): ChatMessage {
  return {
    id: db.id,
    senderId: db.sender_id || '',
    senderType: db.sender_type as UserProfile,
    message: db.message,
    timestamp: new Date(db.created_at),
  };
}

/**
 * Fetch chat messages for a chamado
 */
export async function fetchChatMessages(chamadoId: string): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('chamado_id', chamadoId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[ChatService] Fetch error:', error);
      return [];
    }

    return (data || []).map(mapDbChatMessage);
  } catch (err) {
    console.error('[ChatService] Fetch exception:', err);
    return [];
  }
}

/**
 * Send a chat message
 */
export async function sendChatMessage(
  chamadoId: string,
  senderId: string,
  senderType: UserProfile,
  message: string
): Promise<boolean> {
  try {
    const { error } = await supabase.from('chat_messages').insert({
      chamado_id: chamadoId,
      sender_id: senderId,
      sender_type: senderType,
      message,
    });

    if (error) {
      console.error('[ChatService] Send error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[ChatService] Send exception:', err);
    return false;
  }
}

/**
 * Subscribe to chat messages for a chamado
 */
export function subscribeToChatMessages(
  chamadoId: string,
  onNewMessage: (message: ChatMessage) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`chat-${chamadoId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `chamado_id=eq.${chamadoId}`,
      },
      (payload: RealtimePostgresChangesPayload<DbChatMessage>) => {
        if (payload.new) {
          const message = mapDbChatMessage(payload.new as DbChatMessage);
          onNewMessage(message);
        }
      }
    )
    .subscribe();

  return channel;
}

/**
 * Unsubscribe from chat messages
 */
export function unsubscribeFromChat(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}
