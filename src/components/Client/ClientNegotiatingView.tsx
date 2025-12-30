import React, { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { MapView } from '../Map/MapView';
import { Button } from '../ui/button';
import { Star, Send, ArrowRight, Clock, Phone, Truck, Wallet, Navigation, Route, MapPin, Check, Loader2 } from 'lucide-react';
import { SERVICE_CONFIG } from '@/types/chamado';
import { useProviderInfo } from '@/hooks/useProviderInfo';
import { useCancellationWithReason } from '@/hooks/useCancellationWithReason';
import { CancellationReasonDialog } from '../CancellationReasonDialog';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Switch } from '../ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { calculateDistance } from '@/lib/distance';
import { toast } from 'sonner';

export function ClientNegotiatingView() {
  const { chamado, chatMessages, sendChatMessage, confirmValue, proposeValue, acceptValue, resetChamado } = useApp();
  const [message, setMessage] = useState('');
  const [proposedValue, setProposedValue] = useState('');
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(null);
  const [directPayment, setDirectPayment] = useState(false);

  // Fetch complete provider info
  const providerInfo = useProviderInfo(chamado?.prestadorId);

  // Cancellation with reason
  const {
    showReasonDialog,
    cancelling,
    openCancellationDialog,
    closeCancellationDialog,
    confirmCancellation,
  } = useCancellationWithReason({
    chamadoId: chamado?.id,
    onCancelled: () => {
      toast.info('Chamado cancelado');
      resetChamado();
    },
  });

  // Calculate route distance
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

  // Determine negotiation state for CLIENT
  // State 1: Provider sent proposal, client can accept or counter-propose
  // State 2: Client sent counter-proposal, waiting for provider response
  // State 3: Value accepted, client can proceed to payment
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

  const handleGoToPayment = async () => {
    if (!chamado.valorProposto) return;
    
    // Update chamado with direct payment flag before confirming
    if (directPayment) {
      await supabase
        .from('chamados')
        .update({ direct_payment_to_provider: true })
        .eq('id', chamado.id);
    }
    
    confirmValue();
  };

  const handleCallProvider = () => {
    if (providerInfo.phone) {
      try {
        window.location.href = `tel:${providerInfo.phone}`;
      } catch {
        // ignore
      }
    }
  };

  // Suggested values based on service type
  const suggestedValues = chamado.tipoServico === 'guincho' 
    ? [150, 200, 250, 300] 
    : [50, 80, 100, 150];

  return (
    <div className="relative h-full">
      {/* Map with route */}
      <MapView 
        origem={chamado.origem}
        destino={chamado.destino}
        showRoute={hasDestination}
        className="absolute inset-0" 
      />

      {/* Provider card overlay - more compact and premium */}
      <div className="absolute top-20 left-3 right-3 z-10 animate-slide-down">
        <div className="bg-card/95 backdrop-blur-md rounded-xl p-3 shadow-card">
          {providerInfo.loading ? (
            <div className="flex items-center gap-3 animate-pulse">
              <div className="w-11 h-11 rounded-full bg-secondary" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 bg-secondary rounded w-20" />
                <div className="h-2.5 bg-secondary rounded w-14" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="w-11 h-11 border-2 border-primary/20">
                  <AvatarImage src={providerInfo.avatar || undefined} alt={providerInfo.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {providerInfo.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] px-1 py-0.5 rounded-full flex items-center gap-0.5">
                  <Star className="w-2 h-2 fill-current" />
                  <span className="font-medium">{providerInfo.rating.toFixed(1)}</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">{providerInfo.name}</h3>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Truck className="w-3 h-3" />
                  <span>{providerInfo.totalServices} corridas</span>
                  {providerInfo.vehiclePlate && (
                    <>
                      <span>•</span>
                      <span className="font-medium text-foreground bg-secondary/80 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide">
                        {providerInfo.vehiclePlate}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                  {serviceConfig.icon} {serviceConfig.label}
                </span>
                {providerInfo.phone && (
                  <button 
                    onClick={handleCallProvider}
                    className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                  >
                    <Phone className="w-2.5 h-2.5" />
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
        <div className="bg-card rounded-t-3xl shadow-uber-lg max-h-[65vh] flex flex-col">
          
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-border rounded-full" />
          </div>

          {/* Resumo da corrida - Card compacto */}
          <div className="px-4 pb-3">
            <div className="bg-secondary/50 rounded-xl p-3">
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Resumo da corrida</h4>
              
              {hasDestination ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-7 h-7 bg-background rounded-lg flex items-center justify-center">
                      <Route className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold">{formattedRouteDistance}</p>
                      <p className="text-[10px] text-muted-foreground">Trajeto</p>
                    </div>
                  </div>
                  <div className="w-px h-8 bg-border" />
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-7 h-7 bg-background rounded-lg flex items-center justify-center">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold">{formattedTravelTime}</p>
                      <p className="text-[10px] text-muted-foreground">Estimado</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Navigation className="w-3.5 h-3.5 text-primary" />
                  <span>Atendimento no local</span>
                </div>
              )}
              
              {/* Endereços */}
              <div className="mt-3 pt-3 border-t border-border/50">
                <div className="flex items-start gap-2">
                  <div className="flex flex-col items-center gap-0.5 pt-0.5">
                    <div className="w-2 h-2 bg-primary rounded-full" />
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
            <div className="bg-gradient-to-b from-primary/5 to-transparent rounded-2xl p-4 border border-primary/10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-foreground">Negociação de valor</h3>
                <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-1 rounded-full">{serviceConfig.estimatedTime}</span>
              </div>

              {/* Estado 3: Valor Aceito - Mostrar apenas o valor */}
              {valueAccepted && hasProposal && (
                <div className="p-4 bg-primary/10 rounded-xl flex items-center justify-between border-2 border-primary/30">
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-primary" />
                    <span className="text-sm text-foreground font-medium">Valor acordado</span>
                  </div>
                  <span className="text-2xl font-bold text-primary">
                    R$ {chamado.valorProposto?.toFixed(2)}
                  </span>
                </div>
              )}

              {/* Estado 2: Cliente enviou contra-proposta - Aguardando prestador */}
              {!valueAccepted && lastProposalByClient && hasProposal && (
                <div className="p-4 bg-secondary/50 rounded-xl flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Sua proposta</p>
                    <p className="text-2xl font-bold text-primary">R$ {chamado.valorProposto?.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs">Aguardando resposta</span>
                  </div>
                </div>
              )}

              {/* Estado 1: Prestador enviou proposta - Cliente pode aceitar ou contra-propor */}
              {!valueAccepted && lastProposalByProvider && hasProposal && (
                <>
                  {/* Valor proposto pelo prestador */}
                  <div className="p-4 bg-secondary/50 rounded-xl flex items-center justify-between mb-3">
                    <span className="text-sm text-foreground font-medium">Proposta do prestador</span>
                    <span className="text-2xl font-bold text-primary">
                      R$ {chamado.valorProposto?.toFixed(2)}
                    </span>
                  </div>

                  {/* Campo contra-proposta */}
                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground mb-2">Enviar contra-proposta:</p>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {suggestedValues.map((value) => (
                        <button
                          key={value}
                          onClick={() => handleSuggestionClick(value)}
                          className={`py-2 rounded-xl text-sm font-semibold transition-all ${
                            selectedSuggestion === value
                              ? 'bg-primary text-primary-foreground shadow-md scale-[1.02]'
                              : 'bg-secondary/80 hover:bg-secondary text-foreground hover:scale-[1.01]'
                          }`}
                        >
                          R$ {value}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 flex items-center bg-background rounded-xl px-3 border-2 border-border/50 focus-within:border-primary transition-colors">
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
                        onClick={handleProposeValue} 
                        disabled={!proposedValue} 
                        variant="secondary"
                        size="sm" 
                        className="px-4 h-12 rounded-xl font-semibold"
                      >
                        Propor
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* Sem proposta ainda - Aguardando prestador */}
              {!hasProposal && (
                <div className="p-4 bg-secondary/50 rounded-xl flex items-center justify-center">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Aguardando proposta do prestador...</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mensagem opcional - abaixo do valor */}
          <div className="px-4 pb-3">
            <p className="text-xs text-muted-foreground mb-2">Enviar mensagem ao prestador (opcional)</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ex: Estou na rua principal, carro prata"
                className="flex-1 bg-secondary rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 border border-border/50"
              />
              <Button 
                onClick={handleSendMessage} 
                size="icon" 
                variant="secondary"
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
                    className={`flex ${msg.senderType === 'client' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] px-3 py-1.5 rounded-2xl ${
                      msg.senderType === 'client'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-secondary rounded-bl-md'
                    }`}>
                      <p className="text-xs">{msg.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="mx-4 border-t border-border/50" />
            
          {/* Direct payment toggle - only show when value accepted */}
          {valueAccepted && (
            <div className="px-4 py-3">
              <div className="p-3 bg-secondary/50 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-medium">Pagamento direto ao prestador</p>
                      <p className="text-[10px] text-muted-foreground">Combine Pix ou dinheiro diretamente</p>
                    </div>
                  </div>
                  <Switch
                    checked={directPayment}
                    onCheckedChange={setDirectPayment}
                  />
                </div>
                {directPayment && (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 p-2 rounded-lg">
                    O pagamento será acertado diretamente com o prestador, sem intermediação do app.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Botões de ação - Rodapé */}
          <div className="px-4 pt-2 pb-4 space-y-3">
            
            {/* Estado 3: Valor aceito - Botão para pagamento */}
            {valueAccepted && (
              <>
                <p className="text-center text-[11px] text-muted-foreground">
                  Ao continuar, você confirma o valor e o prestador será acionado.
                </p>
                <div className="flex gap-3">
                  <Button 
                    variant="ghost" 
                    onClick={openCancellationDialog}
                    disabled={cancelling}
                    className="h-12 px-6 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl"
                  >
                    {cancelling ? 'Cancelando...' : 'Cancelar'}
                  </Button>
                  <Button 
                    onClick={handleGoToPayment} 
                    className="flex-1 h-12 text-sm font-semibold gap-2 rounded-xl shadow-lg"
                  >
                    Pagar agora
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </>
            )}

            {/* Estado 1: Proposta do prestador - Botões aceitar/recusar */}
            {!valueAccepted && lastProposalByProvider && hasProposal && (
              <div className="flex gap-3">
                <Button 
                  variant="ghost" 
                  onClick={openCancellationDialog}
                  disabled={cancelling}
                  className="h-12 px-4 text-sm font-medium text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
                >
                  Recusar
                </Button>
                <Button 
                  onClick={handleAcceptValue} 
                  className="flex-1 h-12 text-sm font-semibold gap-2 rounded-xl shadow-lg"
                >
                  Aceitar valor
                  <Check className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Estado 2: Aguardando resposta - Botão desabilitado */}
            {!valueAccepted && lastProposalByClient && hasProposal && (
              <div className="flex gap-3">
                <Button 
                  variant="ghost" 
                  onClick={openCancellationDialog}
                  disabled={cancelling}
                  className="h-12 px-6 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl"
                >
                  Cancelar
                </Button>
                <Button 
                  disabled
                  className="flex-1 h-12 text-sm font-semibold gap-2 rounded-xl"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Aguardando resposta do prestador
                </Button>
              </div>
            )}

            {/* Sem proposta - Apenas cancelar */}
            {!hasProposal && (
              <Button 
                variant="ghost" 
                onClick={openCancellationDialog}
                disabled={cancelling}
                className="w-full h-12 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl"
              >
                {cancelling ? 'Cancelando...' : 'Cancelar'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Cancellation reason dialog */}
      <CancellationReasonDialog
        isOpen={showReasonDialog}
        onClose={closeCancellationDialog}
        onConfirm={confirmCancellation}
        isProvider={false}
      />
    </div>
  );
}
