import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { RealMapView, MapProvider } from '../Map/RealMapView';
import { SearchingIndicator } from './SearchingIndicator';
import { useProgressiveSearch } from '@/hooks/useProgressiveSearch';
import { useCancellationWithReason } from '@/hooks/useCancellationWithReason';
import { CancellationReasonDialog } from '../CancellationReasonDialog';
import { Button } from '../ui/button';
import { X, MapPin, Navigation, RefreshCw, Loader2 } from 'lucide-react';
import { SERVICE_CONFIG } from '@/types/chamado';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function ClientSearchingView() {
  const { chamado, cancelChamado, resetChamado } = useApp();
  const previousDeclinedRef = useRef<string[]>([]);
  const [declinedProviderIdsFromDb, setDeclinedProviderIdsFromDb] = useState<string[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);

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

  // Load initial declined providers from DB when chamado changes
  useEffect(() => {
    if (!chamado?.id) return;

    const loadDeclinedProviders = async () => {
      const { data } = await supabase
        .from('chamados')
        .select('declined_provider_ids')
        .eq('id', chamado.id)
        .single();

      const declinedIds = data?.declined_provider_ids || [];
      setDeclinedProviderIdsFromDb(declinedIds);
      previousDeclinedRef.current = declinedIds;
    };

    loadDeclinedProviders();
  }, [chamado?.id]);

  // Progressive search when searching
  const {
    searchState,
    currentRadius,
    nearbyProviders,
    radiusIndex,
    totalRadii,
    forceExpandRadius,
    cooldownRemaining,
    resetSearch,
  } = useProgressiveSearch({
    userLocation: chamado?.origem || null,
    serviceType: chamado?.tipoServico || 'guincho',
    enabled: !!chamado && chamado.status === 'searching',
    excludedProviderIds: declinedProviderIdsFromDb,
  });

  // Handle retry search
  const handleRetry = async () => {
    if (!chamado?.id || isRetrying) return;
    
    setIsRetrying(true);
    try {
      // Clear declined providers to restart search
      await supabase
        .from('chamados')
        .update({ declined_provider_ids: [] })
        .eq('id', chamado.id);
      
      setDeclinedProviderIdsFromDb([]);
      previousDeclinedRef.current = [];
      
      // Reset search state
      if (resetSearch) {
        resetSearch();
      }
      
      toast.info('Buscando prestadores novamente...');
    } catch (error) {
      console.error('[ClientSearching] Error retrying:', error);
      toast.error('Erro ao tentar novamente');
    } finally {
      setIsRetrying(false);
    }
  };

  // Subscribe to chamado updates to detect when providers decline
  useEffect(() => {
    if (!chamado?.id || chamado.status !== 'searching') return;

    const channel = supabase
      .channel(`chamado-declines-${chamado.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chamados',
          filter: `id=eq.${chamado.id}`,
        },
        (payload) => {
          const newData = payload.new as any;
          const newDeclined = (newData.declined_provider_ids as string[]) || [];
          const previousDeclined = previousDeclinedRef.current;

          // Check if there are new declines
          const newDeclines = newDeclined.filter(id => !previousDeclined.includes(id));
          
          if (newDeclines.length > 0) {
            console.log('[ClientSearching] Provider(s) declined:', newDeclines);
            
            // Update local state
            setDeclinedProviderIdsFromDb(newDeclined);
            
            // Force expand radius for each new decline
            newDeclines.forEach(declinedId => {
              forceExpandRadius(declinedId);
            });
          }

          previousDeclinedRef.current = newDeclined;
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chamado?.id, chamado?.status, forceExpandRadius]);

  if (!chamado) return null;

  const serviceConfig = SERVICE_CONFIG[chamado.tipoServico];
  const hasDestination = chamado.destino !== null;

  // Convert providers to map format
  const mapProviders: MapProvider[] = nearbyProviders.map(p => ({
    id: p.id,
    location: p.location,
    name: p.name,
    services: p.services,
    distance: p.distance,
  }));

  return (
    <div className="relative h-full">
      {/* Full screen map with providers and search radius */}
      <RealMapView 
        center={chamado.origem}
        origem={chamado.origem}
        destino={chamado.destino}
        showRoute={hasDestination}
        providers={mapProviders}
        showSearchRadius={searchState === 'searching' || searchState === 'expanding_radius'}
        searchRadius={currentRadius}
        animateProviders={true}
        className="absolute inset-0" 
      />

      {/* Search overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top search status - more compact */}
        <div className="absolute top-3 left-3 right-3 pointer-events-auto">
          <SearchingIndicator
            state={searchState}
            currentRadius={currentRadius}
            providersCount={nearbyProviders.length}
            radiusIndex={radiusIndex}
            totalRadii={totalRadii}
          />
        </div>

        {/* Animated search ring - only when actively searching */}
        {(searchState === 'searching' || searchState === 'expanding_radius') && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative w-40 h-40">
              <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" style={{ animationDuration: '2s' }} />
              <div className="absolute inset-4 rounded-full border-2 border-primary/40 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
              <div className="absolute inset-8 rounded-full border-2 border-primary/50 animate-ping" style={{ animationDuration: '2s', animationDelay: '1s' }} />
            </div>
          </div>
        )}
      </div>

      {/* Bottom card - more compact and premium */}
      <div className="absolute bottom-0 left-0 right-0 z-10 animate-slide-up">
        <div className="bg-card rounded-t-2xl shadow-uber-lg p-4 space-y-3">
          {/* Service type badge - compact */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-lg">{serviceConfig.icon}</span>
            </div>
            <div className="flex-1">
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                {serviceConfig.label}
              </span>
            </div>
          </div>

          {/* Trip info - compact */}
          <div className="flex items-start gap-2.5">
            <div className="flex flex-col items-center gap-0.5 pt-0.5">
              <div className="w-2 h-2 bg-primary rounded-full" />
              {hasDestination && (
                <>
                  <div className="w-px h-6 bg-border" />
                  <div className="w-2 h-2 bg-foreground rounded-full" />
                </>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {hasDestination ? 'Origem' : 'Local do atendimento'}
                </p>
                <p className="font-medium text-xs truncate">{chamado.origem.address}</p>
              </div>
              {hasDestination && chamado.destino && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Destino</p>
                  <p className="font-medium text-xs truncate">{chamado.destino.address}</p>
                </div>
              )}
            </div>
          </div>

          {/* Status and retry button */}
          {searchState === 'timeout' ? (
            <div className="space-y-3 py-2">
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Nenhum prestador encontrado
                </span>
              </div>
              <Button 
                onClick={handleRetry}
                disabled={isRetrying}
                className="w-full h-11"
              >
                {isRetrying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Tentar novamente
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-2">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {searchState === 'waiting_cooldown'
                  ? `Aguardando (${Math.floor(cooldownRemaining / 60)}:${String(cooldownRemaining % 60).padStart(2, '0')})`
                  : searchState === 'expanding_radius'
                    ? `Expandindo para ${currentRadius}km...`
                    : 'Aguardando resposta'}
              </span>
            </div>
          )}

          {/* Cancel button - wider */}
          <Button 
            variant="outline" 
            onClick={openCancellationDialog}
            disabled={cancelling}
            className="w-full h-11"
          >
            <X className="w-4 h-4" />
            {cancelling ? 'Cancelando...' : 'Cancelar busca'}
          </Button>
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
