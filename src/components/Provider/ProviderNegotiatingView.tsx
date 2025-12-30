import React, { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { RealMapView } from '../Map/RealMapView';
import { Button } from '../ui/button';
import { Send, User, Navigation, Clock, Check, Route, Phone, MapPin, Loader2 } from 'lucide-react';
import { SERVICE_CONFIG } from '@/types/chamado';
import { useOtherPartyContact } from '@/hooks/useOtherPartyContact';
import { calculateDistance } from '@/lib/distance';
import { VEHICLE_TYPES, VehicleType } from '@/types/vehicleTypes';

export function ProviderNegotiatingView() {
  const { chamado, chatMessages, sendChatMessage, cancelChamado, proposeValue, acceptValue, providerData } = useApp();
  const [message, setMessage] = useState('');
  const [proposedValue, setProposedValue] = useState('');
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(null);

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

  // Determine negotiation state for PROVIDER
  // State 1: No proposal sent yet - Provider can send proposal
  // State 2: Provider sent proposal, waiting for client response
  // State 3: Client sent counter-proposal - Provider can accept or counter
  // State 4: Value accepted - Just show confirmation
  const hasProposal = chamado.valorProposto !== null;
  const lastProposalByProvider = chamado.lastProposalBy === 'provider';
  const lastProposalByClient = chamado.lastProposalBy === 'client';
  const valueAccepted = chamado.valueAccepted === true;

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
    setSelectedSuggestion(null);
  };

  const handleSuggestionClick = (value: number) => {
    setProposedValue(value.toString());
    setSelectedSuggestion(value);
  };

  const handleAcceptValue = () => {
    acceptValue();
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

      {/* Bottom negotiation panel */}
      <div className="absolute bottom-0 left-0 right-0 z-10 animate-slide-up">
        <div className="bg-card rounded-t-3xl shadow-uber-lg max-h-[65vh] flex flex-col">
          
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-border rounded-full" />
          </div>

          {/* Resumo da corrida - Card compacto */}
          <div className="px-4 pb-3">
            <div className="bg-secondary/50 rounded-xl p-3">
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Resumo da corrida</h4>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-7 h-7 bg-background rounded-lg flex items-center justify-center">
                    <Navigation className="w-3.5 h-3.5 text-provider-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{formattedDistanceToClient}</p>
                    <p className="text-[10px] text-muted-foreground">Até cliente</p>
                  </div>
                </div>
                
                {hasDestination && (
                  <>
                    <div className="w-px h-8 bg-border" />
                    <div className="flex items-center gap-2 flex-1">
                      <div className="w-7 h-7 bg-background rounded-lg flex items-center justify-center">
                        <Route className="w-3.5 h-3.5 text-provider-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold">{formattedRouteDistance}</p>
                        <p className="text-[10px] text-muted-foreground">Trajeto</p>
                      </div>
                    </div>
                    <div className="w-px h-8 bg-border" />
                    <div className="flex items-center gap-2 flex-1">
                      <div className="w-7 h-7 bg-background rounded-lg flex items-center justify-center">
                        <Clock className="w-3.5 h-3.5 text-provider-primary" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold">{formattedTravelTime}</p>
                        <p className="text-[10px] text-muted-foreground">Estimado</p>
                      </div>
                    </div>
                  </>
                )}
                
                {!hasDestination && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Check className="w-3.5 h-3.5 text-provider-primary" />
                    <span>Atendimento no local</span>
                  </div>
                )}
              </div>
              
              {/* Endereços */}
              <div className="mt-3 pt-3 border-t border-border/50">
                <div className="flex items-start gap-2">
                  <div className="flex flex-col items-center gap-0.5 pt-0.5">
                    <div className="w-2 h-2 bg-provider-primary rounded-full" />
                    {hasDestination && (
                      <>
                        <div className="w-px h-4 bg-border" />
                        <MapPin className="w-2.5 h-2.5 text-foreground" />
                      </>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs truncate">{chamado.origem.address}</p>
                    {hasDestination && chamado.destino && (
                      <p className="text-xs truncate text-muted-foreground">{chamado.destino.address}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Seção Negociação de valor - DESTAQUE PRINCIPAL */}
          <div className="px-4 pb-3">
            <div className="bg-gradient-to-b from-provider-primary/5 to-transparent rounded-2xl p-4 border border-provider-primary/10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-foreground">Negociação de valor</h3>
                <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-1 rounded-full">{serviceConfig.estimatedTime}</span>
              </div>

              {/* Estado 4: Valor Aceito - Mostrar indicador */}
              {valueAccepted && hasProposal && (
                <div className="p-4 bg-provider-primary/10 rounded-xl flex items-center justify-between border-2 border-provider-primary/30">
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-provider-primary" />
                    <span className="text-sm text-foreground font-medium">Valor acordado</span>
                  </div>
                  <span className="text-2xl font-bold text-provider-primary">
                    R$ {chamado.valorProposto?.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Estado 2: Prestador enviou proposta - Aguardando cliente */}
              {!valueAccepted && lastProposalByProvider && hasProposal && (
                <div className="p-4 bg-secondary/50 rounded-xl flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Sua proposta</p>
                    <p className="text-2xl font-bold text-provider-primary">R$ {chamado.valorProposto?.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">Aguardando cliente</span>
                  </div>
                </div>
              )}

              {/* Estado 3: Cliente enviou contra-proposta - Prestador pode aceitar ou contra-propor */}
              {!valueAccepted && lastProposalByClient && hasProposal && (
                <>
                  {/* Valor proposto pelo cliente */}
                  <div className="p-4 bg-secondary/50 rounded-xl flex items-center justify-between mb-3">
                    <span className="text-sm text-foreground font-medium">Proposta do cliente</span>
                    <span className="text-2xl font-bold text-provider-primary">
                      R$ {chamado.valorProposto?.toFixed(2)}
                    </span>
                  </div>

                  {/* Campo nova proposta */}
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground mb-2">Enviar nova proposta:</p>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {suggestedValues.map((value) => (
                        <button
                          key={value}
                          onClick={() => handleSuggestionClick(value)}
                          className={`py-2 rounded-xl text-sm font-semibold transition-all ${
                            selectedSuggestion === value
                              ? 'bg-provider-primary text-primary-foreground shadow-md scale-[1.02]'
                              : 'bg-secondary/80 hover:bg-secondary text-foreground hover:scale-[1.01]'
                          }`}
                        >
                          R$ {value}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 flex items-center bg-background rounded-xl px-3 border-2 border-border/50 focus-within:border-provider-primary transition-colors">
                        <span className="text-muted-foreground text-sm font-medium">R$</span>
                        <input
                          type="number"
                          value={proposedValue}
                          onChange={(e) => {
                            setProposedValue(e.target.value);
                            setSelectedSuggestion(null);
                          }}
                          placeholder="Ou digite um valor"
                          className="flex-1 bg-transparent py-3 px-2 focus:outline-none text-sm font-semibold"
                        />
                      </div>
                      <Button 
                        variant="secondary"
                        onClick={handleProposeValue} 
                        disabled={!proposedValue} 
                        size="sm" 
                        className="px-4 h-12 rounded-xl font-semibold"
                      >
                        Propor
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* Estado 1: Nenhuma proposta - Prestador pode enviar primeira proposta */}
              {!hasProposal && (
                <>
                  {/* Sugestões de valor - Chips */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {suggestedValues.map((value) => (
                      <button
                        key={value}
                        onClick={() => handleSuggestionClick(value)}
                        className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
                          selectedSuggestion === value
                            ? 'bg-provider-primary text-primary-foreground shadow-md scale-[1.02]'
                            : 'bg-secondary/80 hover:bg-secondary text-foreground hover:scale-[1.01]'
                        }`}
                      >
                        R$ {value}
                      </button>
                    ))}
                  </div>

                  {/* Campo propor valor */}
                  <div className="flex gap-2">
                    <div className="flex-1 flex items-center bg-background rounded-xl px-3 border-2 border-border/50 focus-within:border-provider-primary transition-colors">
                      <span className="text-muted-foreground text-sm font-medium">R$</span>
                      <input
                        type="number"
                        value={proposedValue}
                        onChange={(e) => {
                          setProposedValue(e.target.value);
                          setSelectedSuggestion(null);
                        }}
                        placeholder="Digite o valor"
                        className="flex-1 bg-transparent py-3 px-2 focus:outline-none text-sm font-semibold"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mensagem opcional - abaixo do valor */}
          <div className="px-4 pb-3">
            <p className="text-xs text-muted-foreground mb-2">Enviar mensagem ao cliente (opcional)</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ex: Estou a caminho, chego em 10 min"
                className="flex-1 bg-secondary rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-provider-primary/30 border border-border/50"
              />
              <Button 
                variant="secondary" 
                onClick={handleSendMessage} 
                size="icon" 
                className="h-11 w-11 rounded-xl"
                disabled={!message.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Chat messages - compact */}
            {chatMessages.length > 0 && (
              <div className="mt-2 max-h-[60px] overflow-y-auto space-y-1">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.senderType === 'provider' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] px-3 py-1.5 rounded-2xl ${
                      msg.senderType === 'provider'
                        ? 'bg-provider-primary text-primary-foreground rounded-br-md'
                        : 'bg-secondary rounded-bl-md'
                    }`}>
                      <p className="text-xs">{msg.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botões de ação - Rodapé */}
          <div className="px-4 pt-2 pb-4 space-y-3">
            
            {/* Estado 4: Valor aceito - Apenas indicador, sem ações */}
            {valueAccepted && (
              <div className="flex gap-3">
                <Button 
                  variant="ghost" 
                  onClick={cancelChamado} 
                  className="h-12 px-6 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl"
                >
                  Cancelar
                </Button>
                <div className="flex-1 h-12 bg-provider-primary/10 rounded-xl flex items-center justify-center gap-2 text-provider-primary">
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-semibold">Aguardando pagamento do cliente</span>
                </div>
              </div>
            )}

            {/* Estado 3: Contra-proposta do cliente - Aceitar ou Propor */}
            {!valueAccepted && lastProposalByClient && hasProposal && (
              <div className="flex gap-3">
                <Button 
                  variant="ghost" 
                  onClick={cancelChamado} 
                  className="h-12 px-4 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl"
                >
                  Cancelar
                </Button>
                <Button 
                  variant="provider"
                  onClick={handleAcceptValue} 
                  className="flex-1 h-12 text-sm font-semibold gap-2 rounded-xl shadow-lg"
                >
                  Aceitar valor
                  <Check className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Estado 2: Aguardando resposta do cliente */}
            {!valueAccepted && lastProposalByProvider && hasProposal && (
              <div className="flex gap-3">
                <Button 
                  variant="ghost" 
                  onClick={cancelChamado} 
                  className="h-12 px-6 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl"
                >
                  Cancelar
                </Button>
                <Button 
                  disabled
                  variant="provider"
                  className="flex-1 h-12 text-sm font-semibold gap-2 rounded-xl"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Aguardando resposta do cliente
                </Button>
              </div>
            )}

            {/* Estado 1: Nenhuma proposta - Enviar proposta */}
            {!hasProposal && (
              <div className="flex gap-3">
                <Button 
                  variant="ghost" 
                  onClick={cancelChamado} 
                  className="h-12 px-6 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl"
                >
                  Cancelar
                </Button>
                <Button 
                  variant="provider"
                  onClick={handleProposeValue} 
                  disabled={!proposedValue}
                  className="flex-1 h-12 text-sm font-semibold gap-2 rounded-xl shadow-lg"
                >
                  Enviar proposta
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
