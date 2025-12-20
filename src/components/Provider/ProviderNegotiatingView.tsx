import React, { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { RealMapView } from '../Map/RealMapView';
import { Button } from '../ui/button';
import { Send, MessageCircle, User, Navigation, Clock, ArrowRight, Check, Route, Phone } from 'lucide-react';
import { SERVICE_CONFIG } from '@/types/chamado';
import { useOtherPartyContact } from '@/hooks/useOtherPartyContact';
import { calculateDistance } from '@/lib/distance';
import { VEHICLE_TYPES, VehicleType } from '@/types/vehicleTypes';

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
  const vehicleTypeConfig = chamado.vehicleType 
    ? VEHICLE_TYPES[chamado.vehicleType as VehicleType] 
    : null;

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

      {/* Client info overlay - compact */}
      <div className="absolute top-20 left-3 right-3 z-10 animate-slide-down">
        <div className="bg-card/95 backdrop-blur-md rounded-xl p-3 shadow-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{contactLoading ? 'Carregando...' : clientName}</h3>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs bg-provider-primary/10 text-provider-primary px-1.5 py-0.5 rounded-full font-medium">
                  {serviceConfig.icon} {serviceConfig.label}
                </span>
                {vehicleTypeConfig && (
                  <span className="text-[10px] bg-secondary text-foreground px-1.5 py-0.5 rounded-full">
                    {vehicleTypeConfig.icon} {vehicleTypeConfig.label}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5 text-xs">
              <div className="flex items-center gap-1">
                <Navigation className="w-3 h-3 text-provider-primary" />
                <span className="font-medium">{formattedDistanceToClient}</span>
              </div>
              {clientPhone && (
                <a 
                  href={`tel:${clientPhone}`} 
                  className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-provider-primary"
                >
                  <Phone className="w-2.5 h-2.5" />
                  <span>Ligar</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom negotiation panel - compact */}
      <div className="absolute bottom-0 left-0 right-0 z-10 animate-slide-up">
        <div className="bg-card rounded-t-2xl shadow-uber-lg max-h-[60vh] flex flex-col">
          {/* Header - compact */}
          <div className="px-4 py-2.5 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-provider-primary/10 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-3.5 h-3.5 text-provider-primary" />
                </div>
                <h3 className="font-semibold text-sm">Negociação</h3>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{serviceConfig.estimatedTime}</span>
              </div>
            </div>
          </div>

          {/* Trip details with stats - compact */}
          <div className="px-4 py-2 border-b border-border/30 bg-secondary/30">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-1.5 h-1.5 bg-provider-primary rounded-full" />
                {hasDestination && (
                  <>
                    <div className="w-px h-2.5 bg-border" />
                    <div className="w-1.5 h-1.5 bg-foreground rounded-full" />
                  </>
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-[10px] truncate">{chamado.origem.address}</p>
                {hasDestination && chamado.destino && (
                  <p className="text-[10px] truncate text-muted-foreground">{chamado.destino.address}</p>
                )}
              </div>
            </div>
            
            {/* Route stats - compact */}
            {hasDestination && (
              <div className="grid grid-cols-3 gap-1.5">
                <div className="bg-background rounded-lg p-1.5 text-center">
                  <Navigation className="w-3 h-3 mx-auto mb-0.5 text-provider-primary" />
                  <p className="font-semibold text-[10px]">{formattedDistanceToClient}</p>
                  <p className="text-[8px] text-muted-foreground">Até cliente</p>
                </div>
                <div className="bg-background rounded-lg p-1.5 text-center">
                  <Route className="w-3 h-3 mx-auto mb-0.5 text-provider-primary" />
                  <p className="font-semibold text-[10px]">{formattedRouteDistance}</p>
                  <p className="text-[8px] text-muted-foreground">Trajeto</p>
                </div>
                <div className="bg-background rounded-lg p-1.5 text-center">
                  <Clock className="w-3 h-3 mx-auto mb-0.5 text-provider-primary" />
                  <p className="font-semibold text-[10px]">{formattedTravelTime}</p>
                  <p className="text-[8px] text-muted-foreground">Estimado</p>
                </div>
              </div>
            )}
            
            {/* Service type indicator for non-destination services */}
            {!hasDestination && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Check className="w-2.5 h-2.5 text-provider-primary" />
                <span>Atendimento no local</span>
              </div>
            )}
          </div>

          {/* Chat messages - compact */}
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5 min-h-[50px] max-h-[80px]">
            {chatMessages.length === 0 ? (
              <div className="text-center text-muted-foreground text-[10px] py-1">
                <p>Proponha um valor</p>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderType === 'provider' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] px-2.5 py-1 rounded-lg ${
                    msg.senderType === 'provider'
                      ? 'bg-provider-primary text-primary-foreground'
                      : 'bg-secondary'
                  }`}>
                    <p className="text-[10px]">{msg.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quick value suggestions - compact */}
          <div className="px-4 py-1.5">
            <p className="text-[10px] text-muted-foreground mb-1">Sugestões</p>
            <div className="flex gap-1.5">
              {suggestedValues.map((value) => (
                <button
                  key={value}
                  onClick={() => setProposedValue(value.toString())}
                  className="flex-1 py-1.5 bg-secondary rounded-lg text-xs font-medium hover:bg-provider-primary/10 transition-colors"
                >
                  R$ {value}
                </button>
              ))}
            </div>
          </div>

          {/* Value proposal - compact with prominent agreed value */}
          <div className="px-4 py-2 border-t border-border/30">
            <div className="flex gap-2">
              <div className="flex-1 flex items-center bg-secondary/80 rounded-lg px-3">
                <span className="text-muted-foreground text-sm">R$</span>
                <input
                  type="number"
                  value={proposedValue}
                  onChange={(e) => setProposedValue(e.target.value)}
                  placeholder="0,00"
                  className="flex-1 bg-transparent py-2 px-1.5 focus:outline-none text-base font-semibold"
                />
              </div>
              <Button variant="provider" onClick={handleProposeValue} disabled={!proposedValue} size="sm" className="px-4">
                Propor
              </Button>
            </div>

            {chamado.valorProposto && (
              <div className="mt-2 p-2 bg-provider-primary/10 rounded-lg flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Valor acordado</span>
                <span className="text-xl font-bold text-provider-primary">
                  R$ {chamado.valorProposto.toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {/* Message input - compact */}
          <div className="px-4 py-2 border-t border-border/30">
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Digite uma mensagem..."
                className="flex-1 bg-secondary/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-provider-primary/50"
              />
              <Button variant="provider" onClick={handleSendMessage} size="icon" className="h-9 w-9">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Action buttons - wider */}
          <div className="px-4 py-3 border-t border-border/50 flex gap-2">
            <Button variant="outline" onClick={cancelChamado} className="flex-1 h-11 text-sm">
              Cancelar
            </Button>
            <Button 
              variant="provider"
              onClick={handleConfirmValue} 
              disabled={!chamado.valorProposto}
              className="flex-1 h-11 text-sm gap-1.5"
            >
              Confirmar valor
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
