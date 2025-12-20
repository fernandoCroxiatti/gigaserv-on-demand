import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { MapView } from '../Map/MapView';
import { Button } from '../ui/button';
import { Star, Send, Check, DollarSign, MessageCircle, User, ArrowRight, Navigation, Clock, Car, Phone, Truck } from 'lucide-react';
import { SERVICE_CONFIG } from '@/types/chamado';
import { useProviderInfo } from '@/hooks/useProviderInfo';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

export function ClientNegotiatingView() {
  const { chamado, chatMessages, sendChatMessage, confirmValue, cancelChamado, proposeValue } = useApp();
  const [message, setMessage] = useState('');
  const [proposedValue, setProposedValue] = useState('');

  // Fetch complete provider info
  const providerInfo = useProviderInfo(chamado?.prestadorId);

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

  const handleConfirmAndPay = () => {
    if (!chamado.valorProposto) return;
    confirmValue();
  };

  const handleCallProvider = () => {
    if (providerInfo.phone) {
      window.location.href = `tel:${providerInfo.phone}`;
    }
  };

  return (
    <div className="relative h-full">
      {/* Map with route */}
      <MapView 
        origem={chamado.origem}
        destino={chamado.destino}
        showRoute={hasDestination}
        className="absolute inset-0" 
      />

      {/* Provider card overlay */}
      <div className="absolute top-24 left-4 right-4 z-10 animate-slide-down">
        <div className="glass-card rounded-2xl p-4">
          {providerInfo.loading ? (
            <div className="flex items-center gap-4 animate-pulse">
              <div className="w-14 h-14 rounded-full bg-secondary" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-secondary rounded w-24" />
                <div className="h-3 bg-secondary rounded w-16" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="w-14 h-14 border-2 border-primary">
                  <AvatarImage src={providerInfo.avatar || undefined} alt={providerInfo.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                    {providerInfo.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 bg-primary text-white text-xs px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5 fill-current" />
                  <span className="font-medium">{providerInfo.rating.toFixed(1)}</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate">{providerInfo.name}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Truck className="w-3.5 h-3.5" />
                  <span>{providerInfo.totalServices} corridas</span>
                </div>
                {providerInfo.vehiclePlate && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Car className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-bold text-foreground bg-secondary px-2 py-0.5 rounded uppercase tracking-wider">
                      {providerInfo.vehiclePlate}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="status-badge bg-primary/10 text-primary text-xs">
                  <span className="mr-1">{serviceConfig.icon}</span>
                  {serviceConfig.label}
                </span>
                {providerInfo.phone && (
                  <button 
                    onClick={handleCallProvider}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Phone className="w-3 h-3" />
                    Ligar
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom negotiation panel */}
      <div className="absolute bottom-0 left-0 right-0 z-10 animate-slide-up">
        <div className="bg-card rounded-t-3xl shadow-uber-lg max-h-[60vh] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MessageCircle className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Negociação</h3>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{serviceConfig.estimatedTime}</span>
              </div>
            </div>
          </div>

          {/* Route summary */}
          <div className="p-4 border-b border-border bg-secondary/30">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1">
                <div className="w-2 h-2 bg-primary rounded-full" />
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
              <div className="flex items-center gap-1 text-sm">
                <Navigation className="w-4 h-4 text-primary" />
                <span>3.5 km</span>
              </div>
            </div>
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[100px] max-h-[150px]">
            {chatMessages.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-4">
                <MessageCircle className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <p>Negocie o valor do serviço</p>
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
