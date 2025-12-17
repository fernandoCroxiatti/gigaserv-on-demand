import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { RealMapView } from '../Map/RealMapView';
import { Button } from '../ui/button';
import { Send, MessageCircle, User, Navigation, Clock, ArrowRight, Check } from 'lucide-react';
import { SERVICE_CONFIG } from '@/types/chamado';

export function ProviderNegotiatingView() {
  const { chamado, chatMessages, sendChatMessage, confirmValue, cancelChamado, proposeValue, availableProviders } = useApp();
  const [message, setMessage] = useState('');
  const [proposedValue, setProposedValue] = useState('');

  if (!chamado) return null;

  const serviceConfig = SERVICE_CONFIG[chamado.tipoServico];
  const hasDestination = chamado.destino !== null;

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

  const handleConfirmValue = () => {
    if (!chamado.valorProposto) return;
    confirmValue();
  };

  // Suggested values based on service type
  const suggestedValues = chamado.tipoServico === 'guincho' 
    ? [150, 200, 250, 300] 
    : [50, 80, 100, 150];

  return (
    <div className="relative h-full provider-theme">
      {/* Map with route */}
      <RealMapView 
        origem={chamado.origem}
        destino={chamado.destino || undefined}
        showRoute={hasDestination}
        className="absolute inset-0" 
      />

      {/* Client info overlay */}
      <div className="absolute top-24 left-4 right-4 z-10 animate-slide-down">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Cliente</h3>
              <div className="flex items-center gap-2">
                <span className="status-badge bg-provider-primary/10 text-provider-primary text-xs">
                  <span className="mr-1">{serviceConfig.icon}</span>
                  {serviceConfig.label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Navigation className="w-4 h-4 text-provider-primary" />
                <span>--</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom negotiation panel */}
      <div className="absolute bottom-0 left-0 right-0 z-10 animate-slide-up">
        <div className="bg-card rounded-t-3xl shadow-uber-lg max-h-[65vh] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageCircle className="w-5 h-5 text-provider-primary" />
                <h3 className="font-semibold">Negociação</h3>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{serviceConfig.estimatedTime}</span>
              </div>
            </div>
          </div>

          {/* Trip details */}
          <div className="p-4 border-b border-border bg-secondary/30">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1">
                <div className="w-2 h-2 bg-provider-primary rounded-full" />
                {hasDestination && (
                  <>
                    <div className="w-0.5 h-4 bg-border" />
                    <div className="w-2 h-2 bg-foreground rounded-full" />
                  </>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm truncate">{chamado.origem.address}</p>
                {hasDestination && chamado.destino && (
                  <p className="text-sm truncate">{chamado.destino.address}</p>
                )}
              </div>
            </div>
            
            {/* Service type indicator */}
            {!hasDestination && (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Check className="w-3 h-3 text-provider-primary" />
                <span>Atendimento no local</span>
              </div>
            )}
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[80px] max-h-[120px]">
            {chatMessages.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-2">
                <p>Proponha um valor</p>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderType === 'provider' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                    msg.senderType === 'provider'
                      ? 'bg-provider-primary text-primary-foreground'
                      : 'bg-secondary'
                  }`}>
                    <p className="text-sm">{msg.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quick value suggestions */}
          <div className="px-4 pb-2">
            <p className="text-xs text-muted-foreground mb-2">Sugestões para {serviceConfig.label}</p>
            <div className="flex gap-2">
              {suggestedValues.map((value) => (
                <button
                  key={value}
                  onClick={() => setProposedValue(value.toString())}
                  className="flex-1 py-2 bg-secondary rounded-lg text-sm font-medium hover:bg-provider-primary/10 transition-colors"
                >
                  R$ {value}
                </button>
              ))}
            </div>
          </div>

          {/* Value proposal */}
          <div className="p-4 border-t border-border">
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
              <Button variant="provider" onClick={handleProposeValue} disabled={!proposedValue}>
                Propor
              </Button>
            </div>

            {chamado.valorProposto && (
              <div className="mt-3 p-3 bg-provider-primary/10 rounded-xl">
                <p className="text-sm text-muted-foreground">Valor acordado:</p>
                <p className="text-2xl font-bold text-provider-primary">
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
                className="flex-1 bg-secondary rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-provider-primary"
              />
              <Button variant="provider" onClick={handleSendMessage} size="icon">
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
              variant="provider"
              onClick={handleConfirmValue} 
              disabled={!chamado.valorProposto}
              className="flex-1"
            >
              <ArrowRight className="w-5 h-5" />
              Confirmar valor
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
