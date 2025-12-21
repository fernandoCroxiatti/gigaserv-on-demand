import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { MapView } from '../Map/MapView';
import { Button } from '../ui/button';
import { Star, Send, ArrowRight, MessageCircle, Clock, Car, Phone, Truck, Wallet } from 'lucide-react';
import { SERVICE_CONFIG } from '@/types/chamado';
import { useProviderInfo } from '@/hooks/useProviderInfo';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Switch } from '../ui/switch';
import { supabase } from '@/integrations/supabase/client';

export function ClientNegotiatingView() {
  const { chamado, chatMessages, sendChatMessage, confirmValue, cancelChamado, proposeValue } = useApp();
  const [message, setMessage] = useState('');
  const [proposedValue, setProposedValue] = useState('');
  const [directPayment, setDirectPayment] = useState(false);

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

  const handleConfirmAndPay = async () => {
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

      {/* Bottom negotiation panel - more compact */}
      <div className="absolute bottom-0 left-0 right-0 z-10 animate-slide-up">
        <div className="bg-card rounded-t-2xl shadow-uber-lg max-h-[55vh] flex flex-col">
          {/* Header - compact */}
          <div className="px-4 py-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-semibold text-sm">Negociação</h3>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{serviceConfig.estimatedTime}</span>
              </div>
            </div>
          </div>

          {/* Route summary - compact */}
          <div className="px-4 py-2.5 bg-secondary/30 border-b border-border/30">
            <div className="flex items-center gap-2.5">
              <div className="flex flex-col items-center gap-0.5">
                <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                {hasDestination && (
                  <>
                    <div className="w-px h-3 bg-border" />
                    <div className="w-1.5 h-1.5 bg-foreground rounded-full" />
                  </>
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-xs truncate">{chamado.origem.address}</p>
                {hasDestination && chamado.destino && (
                  <p className="text-xs truncate text-muted-foreground">{chamado.destino.address}</p>
                )}
              </div>
            </div>
          </div>

          {/* Chat messages - compact */}
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 min-h-[60px] max-h-[100px]">
            {chatMessages.length === 0 ? (
              <div className="text-center text-muted-foreground text-xs py-2">
                <p>Negocie o valor do serviço</p>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderType === 'client' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] px-3 py-1.5 rounded-xl ${
                    msg.senderType === 'client'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary'
                  }`}>
                    <p className="text-xs">{msg.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Value proposal - compact with prominent agreed value */}
          <div className="px-4 py-3 border-t border-border/50">
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
              <Button onClick={handleProposeValue} disabled={!proposedValue} size="sm" className="px-4">
                Propor
              </Button>
            </div>

            {chamado.valorProposto && (
              <div className="mt-2 p-2.5 bg-primary/10 rounded-lg flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Valor acordado</span>
                <span className="text-xl font-bold text-primary">
                  R$ {chamado.valorProposto.toFixed(2)}
                </span>
              </div>
            )}
            
            {/* Direct payment toggle */}
            <div className="mt-3 p-3 bg-secondary/50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Pagamento direto ao prestador</p>
                    <p className="text-xs text-muted-foreground">Pix ou dinheiro (fora do app)</p>
                  </div>
                </div>
                <Switch
                  checked={directPayment}
                  onCheckedChange={setDirectPayment}
                />
              </div>
              {directPayment && (
                <p className="mt-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                  ⚠️ O pagamento será realizado diretamente ao prestador.
                </p>
              )}
            </div>
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
                className="flex-1 bg-secondary/80 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <Button onClick={handleSendMessage} size="icon" className="h-9 w-9">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Action buttons - wider and more prominent */}
          <div className="px-4 py-3 border-t border-border/50 flex gap-2">
            <Button variant="outline" onClick={cancelChamado} className="flex-1 h-11 text-sm">
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmAndPay} 
              disabled={!chamado.valorProposto}
              className="flex-1 h-11 text-sm gap-1.5"
            >
              Ir para pagamento
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
