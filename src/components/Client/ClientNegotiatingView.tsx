import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { MapView } from '../Map/MapView';
import { Button } from '../ui/button';
import { Star, Send, Check, DollarSign, MessageCircle, User, ArrowRight } from 'lucide-react';

export function ClientNegotiatingView() {
  const { chamado, availableProviders, chatMessages, sendChatMessage, confirmValue, cancelChamado, proposeValue } = useApp();
  const [message, setMessage] = useState('');
  const [proposedValue, setProposedValue] = useState('');

  if (!chamado) return null;

  const provider = availableProviders.find(p => p.id === chamado.prestadorId);

  const handleSendMessage = () => {
    if (!message.trim()) return;
    sendChatMessage(message);
    setMessage('');
  };

  const handleProposeValue = () => {
    const value = parseFloat(proposedValue);
    if (isNaN(value) || value <= 0) return;
    proposeValue(value);
    setProposedValue('');
  };

  const handleConfirmAndPay = () => {
    if (!chamado.valorProposto) return;
    confirmValue(); // This now moves to awaiting_payment
  };

  return (
    <div className="relative h-full">
      {/* Map with route */}
      <MapView 
        origem={chamado.origem}
        destino={chamado.destino}
        showRoute
        className="absolute inset-0" 
      />

      {/* Provider card overlay */}
      <div className="absolute top-24 left-4 right-4 z-10 animate-slide-down">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img 
                src={provider?.avatar} 
                alt={provider?.name}
                className="w-16 h-16 rounded-full border-2 border-primary"
              />
              <div className="absolute -bottom-1 -right-1 bg-primary text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                <Star className="w-3 h-3 fill-current" />
                {provider?.rating}
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{provider?.name}</h3>
              <p className="text-sm text-muted-foreground">{provider?.totalServices} serviços realizados</p>
            </div>
            <div className="text-right">
              <span className="status-badge bg-status-accepted/10 text-status-accepted">
                <Check className="w-3 h-3" />
                Aceito
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom negotiation panel */}
      <div className="absolute bottom-0 left-0 right-0 z-10 animate-slide-up">
        <div className="bg-card rounded-t-3xl shadow-uber-lg max-h-[60vh] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Negociação</h3>
            </div>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[150px] max-h-[200px]">
            {chatMessages.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Inicie a negociação com o prestador</p>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderType === 'client' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                    msg.senderType === 'client'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary'
                  }`}>
                    <p className="text-sm">{msg.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Value proposal */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Propor valor</span>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center bg-secondary rounded-xl px-4">
                <span className="text-muted-foreground">R$</span>
                <input
                  type="number"
                  value={proposedValue}
                  onChange={(e) => setProposedValue(e.target.value)}
                  placeholder="0,00"
                  className="flex-1 bg-transparent py-3 px-2 focus:outline-none text-lg font-semibold"
                />
              </div>
              <Button onClick={handleProposeValue} disabled={!proposedValue}>
                Propor
              </Button>
            </div>

            {chamado.valorProposto && (
              <div className="mt-3 p-3 bg-primary/10 rounded-xl">
                <p className="text-sm text-muted-foreground">Valor acordado:</p>
                <p className="text-2xl font-bold text-primary">
                  R$ {chamado.valorProposto.toFixed(2)}
                </p>
              </div>
            )}
          </div>

          {/* Message input */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Digite uma mensagem..."
                className="flex-1 bg-secondary rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button onClick={handleSendMessage} size="icon">
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="p-4 border-t border-border flex gap-3">
            <Button variant="outline" onClick={cancelChamado} className="flex-1">
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmAndPay} 
              disabled={!chamado.valorProposto}
              className="flex-1"
            >
              <ArrowRight className="w-5 h-5" />
              Ir para pagamento
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
