import React, { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { RealMapView } from '../Map/RealMapView';
import { Button } from '../ui/button';
import { Send, MessageCircle, User, Navigation, Clock, ArrowRight, Check, Route, Car, Phone } from 'lucide-react';
import { SERVICE_CONFIG } from '@/types/chamado';
import { useOtherPartyContact } from '@/hooks/useOtherPartyContact';
import { calculateDistance } from '@/lib/distance';

export function ProviderNegotiatingView() {
  const { chamado, chatMessages, sendChatMessage, confirmValue, cancelChamado, proposeValue, providerData } = useApp();
  const [message, setMessage] = useState('');
  const [proposedValue, setProposedValue] = useState('');

  // Fetch client info
  const { name: clientName, phone: clientPhone, loading: contactLoading } = useOtherPartyContact(
    'provider',
    chamado?.id,
    chamado?.clienteId,
    chamado?.prestadorId
  );

  // Calculate distances
  const distanceToClient = useMemo(() => {
    if (!chamado || !providerData?.current_lat || !providerData?.current_lng) {
      return null;
    }
    return calculateDistance(
      Number(providerData.current_lat),
      Number(providerData.current_lng),
      chamado.origem.lat,
      chamado.origem.lng
    );
  }, [chamado, providerData?.current_lat, providerData?.current_lng]);

  const routeDistance = useMemo(() => {
    if (!chamado?.destino) return null;
    return calculateDistance(
      chamado.origem.lat,
      chamado.origem.lng,
      chamado.destino.lat,
      chamado.destino.lng
    );
  }, [chamado]);

  // Calculate estimated travel time (assuming avg 40km/h for urban areas)
  const estimatedMinutes = useMemo(() => {
    if (!routeDistance) return null;
    return Math.round((routeDistance / 40) * 60);
  }, [routeDistance]);

  if (!chamado) return null;

  const serviceConfig = SERVICE_CONFIG[chamado.tipoServico];
  const hasDestination = chamado.destino !== null;

  const formattedDistanceToClient = distanceToClient !== null 
    ? distanceToClient < 1 
      ? `${Math.round(distanceToClient * 1000)} m`
      : `${distanceToClient.toFixed(1)} km`
    : '--';

  const formattedRouteDistance = routeDistance !== null 
    ? routeDistance < 1 
      ? `${Math.round(routeDistance * 1000)} m`
      : `${routeDistance.toFixed(1)} km`
    : '--';

  const formattedTravelTime = estimatedMinutes !== null
    ? estimatedMinutes < 60 
      ? `${estimatedMinutes} min`
      : `${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60}min`
    : '--';

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
              <h3 className="font-semibold">{contactLoading ? 'Carregando...' : clientName}</h3>
              <div className="flex items-center gap-2">
                <span className="status-badge bg-provider-primary/10 text-provider-primary text-xs">
                  <span className="mr-1">{serviceConfig.icon}</span>
                  {serviceConfig.label}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 text-sm">
              <div className="flex items-center gap-1">
                <Navigation className="w-4 h-4 text-provider-primary" />
                <span>{formattedDistanceToClient}</span>
              </div>
              {clientPhone && (
                <a 
                  href={`tel:${clientPhone}`} 
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-provider-primary"
                >
                  <Phone className="w-3 h-3" />
                  <span>Ligar</span>
                </a>
              )}
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

          {/* Trip details with stats */}
          <div className="p-4 border-b border-border bg-secondary/30">
            <div className="flex items-start gap-3 mb-3">
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
            
            {/* Route stats */}
            {hasDestination && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="bg-background rounded-xl p-2 text-center">
                  <Navigation className="w-4 h-4 mx-auto mb-1 text-provider-primary" />
                  <p className="font-semibold text-sm">{formattedDistanceToClient}</p>
                  <p className="text-[10px] text-muted-foreground">Até cliente</p>
                </div>
                <div className="bg-background rounded-xl p-2 text-center">
                  <Route className="w-4 h-4 mx-auto mb-1 text-provider-primary" />
                  <p className="font-semibold text-sm">{formattedRouteDistance}</p>
                  <p className="text-[10px] text-muted-foreground">Trajeto total</p>
                </div>
                <div className="bg-background rounded-xl p-2 text-center">
                  <Clock className="w-4 h-4 mx-auto mb-1 text-provider-primary" />
                  <p className="font-semibold text-sm">{formattedTravelTime}</p>
                  <p className="text-[10px] text-muted-foreground">Tempo estimado</p>
                </div>
              </div>
            )}
            
            {/* Service type indicator for non-destination services */}
            {!hasDestination && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
