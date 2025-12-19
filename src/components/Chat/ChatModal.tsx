import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Send, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  otherPartyName: string;
  mode: 'client' | 'provider';
}

export function ChatModal({ isOpen, onClose, otherPartyName, mode }: ChatModalProps) {
  const { chatMessages, sendChatMessage, profile, chamado } = useApp();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      await sendChatMessage(message.trim());
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  const myType = mode === 'provider' ? 'provider' : 'client';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-card shadow-sm">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="shrink-0"
        >
          <X className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3 flex-1">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            mode === 'provider' ? 'bg-primary/10' : 'bg-provider-primary/10'
          )}>
            <MessageCircle className={cn(
              "w-5 h-5",
              mode === 'provider' ? 'text-primary' : 'text-provider-primary'
            )} />
          </div>
          <div>
            <p className="font-semibold">{otherPartyName}</p>
            <p className="text-xs text-muted-foreground">
              {mode === 'provider' ? 'Cliente' : 'Prestador'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageCircle className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Nenhuma mensagem ainda</p>
            <p className="text-sm text-muted-foreground/70">
              Envie uma mensagem para iniciar a conversa
            </p>
          </div>
        ) : (
          chatMessages.map((msg) => {
            const isMyMessage = msg.senderType === myType;
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  isMyMessage ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] px-4 py-2 rounded-2xl",
                    isMyMessage
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-secondary text-secondary-foreground rounded-bl-sm"
                  )}
                >
                  <p className="text-sm">{msg.message}</p>
                  <p className={cn(
                    "text-[10px] mt-1",
                    isMyMessage ? "text-primary-foreground/70" : "text-muted-foreground"
                  )}>
                    {new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {chamado?.status !== 'finished' && chamado?.status !== 'canceled' ? (
        <div className="p-4 border-t border-border bg-card">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua mensagem..."
              className="flex-1"
              disabled={sending}
            />
            <Button
              onClick={handleSend}
              disabled={!message.trim() || sending}
              size="icon"
              className={cn(
                mode === 'provider' 
                  ? 'bg-provider-primary hover:bg-provider-primary/90' 
                  : ''
              )}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-4 border-t border-border bg-muted/50">
          <p className="text-center text-sm text-muted-foreground">
            O chat foi encerrado com a finalização da corrida
          </p>
        </div>
      )}
    </div>
  );
}
