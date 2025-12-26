import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from 'react';
import { 
  Chamado, 
  ChamadoStatus, 
  User, 
  UserProfile, 
  Provider, 
  Location, 
  ChatMessage,
  PaymentMethod,
  ServiceType,
  serviceRequiresDestination
} from '@/types/chamado';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Database } from '@/integrations/supabase/types';
import { isChamadoWithinRange } from '@/lib/distance';
import { startRideAlertLoop, stopRideAlertLoop } from '@/lib/rideAlertSound';
import { useChamadoQueue } from '@/hooks/useChamadoQueue';

type DbChamado = Database['public']['Tables']['chamados']['Row'];
type DbProfile = Database['public']['Tables']['profiles']['Row'];
type DbProviderData = Database['public']['Tables']['provider_data']['Row'];
type DbChatMessage = Database['public']['Tables']['chat_messages']['Row'];

interface AppContextType {
  user: User | null;
  profile: DbProfile | null;
  providerData: DbProviderData | null;
  perfilPrincipal: 'client' | 'provider';
  canAccessProviderFeatures: boolean;
  setActiveProfile: (profile: UserProfile) => void;
  isLoading: boolean;
  
  chamado: Chamado | null;
  setChamadoStatus: (status: ChamadoStatus) => void;
  createChamado: (tipoServico: ServiceType, origem: Location, destino: Location | null, vehicleType?: string) => Promise<void>;
  acceptChamado: (chamadoId: string) => Promise<void>;
  proposeValue: (value: number) => Promise<void>;
  confirmValue: () => Promise<void>;
  cancelChamado: () => Promise<void>;
  finishService: () => Promise<void>;
  confirmServiceFinish: () => Promise<void>;
  disputeServiceFinish: () => Promise<void>;
  resetChamado: () => void;
  submitReview: (rating: number, tags: string[], comment: string) => Promise<void>;
  
  initiatePayment: (method: PaymentMethod) => Promise<void>;
  processPayment: () => Promise<void>;
  
  availableProviders: Provider[];
  toggleProviderOnline: () => Promise<void>;
  setProviderRadarRange: (range: number) => Promise<void>;
  setProviderServices: (services: ServiceType[]) => Promise<void>;
  updateProviderLocation: (location: Location) => Promise<void>;
  
  chatMessages: ChatMessage[];
  sendChatMessage: (message: string) => Promise<void>;
  
  incomingRequest: Chamado | null;
  acceptIncomingRequest: () => Promise<void>;
  declineIncomingRequest: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function mapDbChamadoToChamado(db: DbChamado): Chamado {
  return {
    id: db.id,
    status: db.status as ChamadoStatus,
    tipoServico: db.tipo_servico as ServiceType,
    clienteId: db.cliente_id || '',
    prestadorId: db.prestador_id,
    origem: {
      lat: Number(db.origem_lat),
      lng: Number(db.origem_lng),
      address: db.origem_address,
    },
    destino: db.destino_lat && db.destino_lng ? {
      lat: Number(db.destino_lat),
      lng: Number(db.destino_lng),
      address: db.destino_address || '',
    } : null,
    valor: db.valor ? Number(db.valor) : null,
    valorProposto: db.valor_proposto ? Number(db.valor_proposto) : null,
    vehicleType: (db as any).vehicle_type || null,
    payment: db.payment_status ? {
      id: db.stripe_payment_intent_id || `payment-${db.id}`,
      status: db.payment_status,
      method: (db.payment_method as PaymentMethod) || 'pix',
      amount: db.valor ? Number(db.valor) : 0,
      currency: 'BRL',
      provider: (db.payment_provider as 'mock' | 'stripe' | 'mercadopago') || 'mock',
      stripePaymentIntentId: db.stripe_payment_intent_id || undefined,
      createdAt: new Date(db.created_at),
    } : null,

    // Direct payment (PIX/Dinheiro ao prestador)
    directPaymentToProvider: db.direct_payment_to_provider === true,
    directPaymentReceiptConfirmed: db.direct_payment_receipt_confirmed === true,
    directPaymentConfirmedAt: db.direct_payment_confirmed_at ? new Date(db.direct_payment_confirmed_at) : null,

    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at),
  };
}

function mapDbChatMessage(db: DbChatMessage): ChatMessage {
  return {
    id: db.id,
    senderId: db.sender_id || '',
    senderType: db.sender_type as UserProfile,
    message: db.message,
    timestamp: new Date(db.created_at),
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { user: authUser, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<DbProfile | null>(null);
  const [providerData, setProviderData] = useState<DbProviderData | null>(null);
  const [chamado, setChamado] = useState<Chamado | null>(null);
  const [availableProviders, setAvailableProviders] = useState<Provider[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [incomingRequest, setIncomingRequest] = useState<Chamado | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Track recently declined chamados by this provider to prevent immediate re-showing
  // Format: chamadoId -> timestamp when declined
  const recentlyDeclinedRef = useRef<Map<string, number>>(new Map());
  
  // Cooldown duration for re-offering declined chamados (10 seconds)
  const DECLINE_COOLDOWN_MS = 10 * 1000;

  // CRITICAL: Determine if user can access provider features
  const perfilPrincipal = (profile?.perfil_principal as 'client' | 'provider') || 'client';
  const canAccessProviderFeatures = perfilPrincipal === 'provider';

  const user: User | null = profile ? {
    id: profile.user_id,
    name: profile.name,
    email: profile.email || '',
    phone: profile.phone || '',
    avatar: profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.name}`,
    activeProfile: (profile.active_profile as UserProfile) || 'client',
    providerData: providerData && canAccessProviderFeatures ? {
      online: providerData.is_online || false,
      radarRange: providerData.radar_range || 15,
      rating: Number(providerData.rating) || 5.0,
      totalServices: providerData.total_services || 0,
      services: (providerData.services_offered as ServiceType[]) || ['guincho'],
    } : undefined,
  } : null;

  // Load profile when auth user changes - OPTIMIZED: parallel queries
  useEffect(() => {
    if (!authUser) {
      setProfile(null);
      setProviderData(null);
      setIsLoading(false);
      return;
    }

    const loadProfileData = async () => {
      try {
        // Load profile and provider data in parallel for faster startup
        const [profileResult, providerResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('*')
            .eq('user_id', authUser.id)
            .maybeSingle(),
          supabase
            .from('provider_data')
            .select('*')
            .eq('user_id', authUser.id)
            .maybeSingle()
        ]);

        if (profileResult.error) throw profileResult.error;
        
        setProfile(profileResult.data);
        
        // Only set provider data if user is a registered provider
        if (profileResult.data?.perfil_principal === 'provider') {
          setProviderData(providerResult.data);
        } else {
          setProviderData(null);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        toast.error('Erro ao carregar perfil');
      } finally {
        setIsLoading(false);
      }
    };

    loadProfileData();
  }, [authUser]);

  // Load active chamado
  useEffect(() => {
    if (!authUser) return;

    const loadActiveChamado = async () => {
      const activeProfile = profile?.active_profile || 'client';
      
      // Only query as provider if user has provider permissions
      const query = activeProfile === 'client' || !canAccessProviderFeatures
        ? supabase.from('chamados').select('*').eq('cliente_id', authUser.id)
        : supabase.from('chamados').select('*').eq('prestador_id', authUser.id);

      const { data, error } = await query
        .not('status', 'in', '("finished","canceled","idle")')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error loading chamado:', error);
        return;
      }

      if (data) {
        setChamado(mapDbChamadoToChamado(data));
      }
    };

    loadActiveChamado();
  }, [authUser, profile?.active_profile, canAccessProviderFeatures]);

  // Subscribe to chamado updates
  useEffect(() => {
    if (!chamado) return;

    const channel = supabase
      .channel(`chamado-${chamado.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chamados',
          filter: `id=eq.${chamado.id}`,
        },
        async (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = mapDbChamadoToChamado(payload.new as DbChamado);
            const oldStatus = chamado.status;
            const newStatus = updated.status;
            
            setChamado(updated);
            
            // Notify based on new status and user role
            if (profile?.active_profile === 'client') {
              if (newStatus === 'accepted') {
                toast.success('Um prestador aceitou seu chamado!');
              } else if (newStatus === 'in_service') {
                toast.success('Pagamento aprovado! Serviço iniciado.');
              } else if (newStatus === 'pending_client_confirmation') {
                toast.info('O prestador finalizou o serviço. Por favor, confirme.');
              } else if (newStatus === 'finished') {
                toast.success('Serviço finalizado!');
              }
            } else if (profile?.active_profile === 'provider') {
              if (newStatus === 'finished' && oldStatus === 'pending_client_confirmation') {
                toast.success('Cliente confirmou a finalização!');
              } else if (newStatus === 'in_service' && oldStatus === 'pending_client_confirmation') {
                toast.warning('Cliente reportou um problema. Verifique.');
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chamado?.id, chamado?.status, profile?.active_profile, authUser]);

  // Load chat messages for active chamado
  useEffect(() => {
    if (!chamado) {
      setChatMessages([]);
      return;
    }

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chamado_id', chamado.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading messages:', error);
        return;
      }

      setChatMessages(data.map(mapDbChatMessage));
    };

    loadMessages();

    const channel = supabase
      .channel(`chat-${chamado.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `chamado_id=eq.${chamado.id}`,
        },
        (payload) => {
          const newMsg = mapDbChatMessage(payload.new as DbChatMessage);
          setChatMessages(prev => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chamado?.id]);

  // Load available providers (for clients)
  useEffect(() => {
    if (!authUser || profile?.active_profile !== 'client') return;

    const loadProviders = async () => {
      const { data, error } = await supabase
        .from('provider_data')
        .select(`
          *,
          profiles!inner(name, avatar_url, perfil_principal)
        `)
        .eq('is_online', true);

      if (error) {
        console.error('Error loading providers:', error);
        return;
      }

      // Filter to only show users with perfil_principal = 'provider'
      const providers: Provider[] = data
        .filter((p: any) => p.profiles.perfil_principal === 'provider')
        .map((p: any) => ({
          id: p.user_id,
          name: p.profiles.name,
          avatar: p.profiles.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.profiles.name}`,
          rating: Number(p.rating) || 5.0,
          totalServices: p.total_services || 0,
          online: p.is_online,
          location: {
            lat: Number(p.current_lat) || -23.5505,
            lng: Number(p.current_lng) || -46.6333,
            address: p.current_address || '',
          },
          radarRange: p.radar_range || 15,
          services: p.services_offered || ['guincho'],
          vehiclePlate: p.vehicle_plate || undefined,
        }));

      setAvailableProviders(providers);
    };

    loadProviders();

    const channel = supabase
      .channel('providers-online')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'provider_data',
        },
        () => {
          loadProviders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser, profile?.active_profile]);

  // ===== QUEUE-BASED CHAMADO SYSTEM =====
  // The queue is the PRIMARY source of truth for pending chamados.
  // Realtime is kept as a COMPLEMENT for instant notifications.
  
  const handleNewChamadoFromQueue = useCallback((newChamado: Chamado) => {
    // Don't show if already showing same chamado
    if (incomingRequest?.id === newChamado.id) {
      return;
    }
    
    console.log(`[ChamadoQueue] New chamado from queue: ${newChamado.id.substring(0, 8)}`);
    setIncomingRequest(newChamado);
    toast.info('Novo chamado disponível!', {
      description: 'Um cliente está procurando atendimento.',
    });
  }, [incomingRequest]);

  const { markAsDeclined: markChamadoDeclinedInQueue, forcePoll: forceQueuePoll } = useChamadoQueue({
    userId: authUser?.id || null,
    isOnline: providerData?.is_online === true,
    isProvider: canAccessProviderFeatures && profile?.active_profile === 'provider',
    hasActiveChamado: !!chamado,
    currentIncomingRequest: incomingRequest,
    onNewChamado: handleNewChamadoFromQueue,
  });

  // REALTIME as COMPLEMENT - only for instant updates, not as primary source
  useEffect(() => {
    const shouldListen = authUser && 
                        canAccessProviderFeatures && 
                        profile?.active_profile === 'provider' && 
                        providerData?.is_online === true && 
                        !chamado;
    
    if (!shouldListen || !authUser || !providerData) {
      return;
    }
    
    console.log('[RealtimeComplement] Subscribing to realtime updates (complement to queue)');

    const channel = supabase
      .channel('incoming-chamados-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chamados',
          filter: `status=eq.searching`,
        },
        (payload) => {
          const dbChamado = payload.new as DbChamado;
          
          // Skip own chamados
          if (dbChamado.cliente_id === authUser.id) {
            return;
          }
          
          // Skip if already declined
          const declinedProviderIds = dbChamado.declined_provider_ids || [];
          if (declinedProviderIds.includes(authUser.id)) {
            return;
          }
          
          // Check local cooldown
          const declinedAt = recentlyDeclinedRef.current.get(dbChamado.id);
          if (declinedAt && (Date.now() - declinedAt) < DECLINE_COOLDOWN_MS) {
            return;
          }
          
          const services = providerData.services_offered || ['guincho'];
          const radarRange = providerData.radar_range || 15;
          const providerLat = providerData.current_lat ? Number(providerData.current_lat) : null;
          const providerLng = providerData.current_lng ? Number(providerData.current_lng) : null;

          if (!services.includes(dbChamado.tipo_servico)) {
            return;
          }

          const isWithinRange = isChamadoWithinRange(
            providerLat,
            providerLng,
            Number(dbChamado.origem_lat),
            Number(dbChamado.origem_lng),
            radarRange
          );

          if (isWithinRange && !incomingRequest) {
            console.log(`[RealtimeComplement] New chamado from realtime: ${dbChamado.id.substring(0, 8)}`);
            setIncomingRequest(mapDbChamadoToChamado(dbChamado));
            toast.info('Novo chamado!', {
              description: 'Um cliente próximo precisa de ajuda.',
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chamados',
        },
        (payload) => {
          const dbChamado = payload.new as DbChamado;
          
          // Clear incomingRequest if chamado was taken by another provider
          if (incomingRequest && dbChamado.id === incomingRequest.id) {
            const wasAccepted = dbChamado.status !== 'searching' || dbChamado.prestador_id !== null;
            if (wasAccepted) {
              console.log(`[RealtimeComplement] Chamado ${dbChamado.id.substring(0, 8)} was taken`);
              setIncomingRequest(null);
              stopRideAlertLoop();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser, canAccessProviderFeatures, profile?.active_profile, providerData?.is_online, providerData?.services_offered, providerData?.radar_range, providerData?.current_lat, providerData?.current_lng, chamado, incomingRequest]);

  const setActiveProfile = useCallback(async (newProfile: UserProfile) => {
    if (!authUser || !profile) return;

    // CRITICAL: Client can NEVER switch to provider mode
    if (!canAccessProviderFeatures && newProfile === 'provider') {
      toast.error('Você não tem permissão para acessar o modo prestador');
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ active_profile: newProfile })
        .eq('user_id', authUser.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, active_profile: newProfile } : null);
      setChamado(null);
      setChatMessages([]);
      setIncomingRequest(null);
    } catch (error) {
      console.error('Error setting profile:', error);
      toast.error('Erro ao alterar perfil');
    }
  }, [authUser, profile, canAccessProviderFeatures]);

  const createChamado = useCallback(async (tipoServico: ServiceType, origem: Location, destino: Location | null, vehicleType?: string) => {
    if (!authUser) {
      toast.error('Você precisa estar logado');
      return;
    }

    const needsDestination = serviceRequiresDestination(tipoServico);
    if (needsDestination && !destino) {
      toast.error('Informe o destino para o serviço de guincho');
      return;
    }

    try {
      console.log('[CreateChamado] Creating chamado via backend...');
      
      const { data, error } = await supabase.functions.invoke('create-chamado', {
        body: {
          tipo_servico: tipoServico,
          origem_lat: origem.lat,
          origem_lng: origem.lng,
          origem_address: origem.address,
          destino_lat: needsDestination && destino ? destino.lat : null,
          destino_lng: needsDestination && destino ? destino.lng : null,
          destino_address: needsDestination && destino ? destino.address : null,
          vehicle_type: vehicleType || null,
        },
      });

      if (error) throw error;

      const chamadoData = (data as any)?.chamado;
      if (!chamadoData) throw new Error('Chamado not returned from backend');

      console.log('[CreateChamado] Chamado created:', { 
        id: chamadoData.id, 
        eligibleProviders: (data as any)?.eligibleProvidersCount 
      });

      setChamado(mapDbChamadoToChamado(chamadoData));
    } catch (error) {
      console.error('Error creating chamado:', error);
      toast.error('Erro ao criar chamado');
    }
  }, [authUser]);

  const acceptChamado = useCallback(async (chamadoId: string) => {
    if (!authUser) return;

    // CRITICAL: Validate provider permission
    if (!canAccessProviderFeatures) {
      toast.error('Você não tem permissão para aceitar chamados');
      return;
    }

    try {
      // COMPETITIVE ACCEPT: Only update if chamado is still searching and has no provider
      // This prevents race conditions when multiple providers try to accept
      const { data, error } = await supabase
        .from('chamados')
        .update({
          prestador_id: authUser.id,
          status: 'negotiating',
        })
        .eq('id', chamadoId)
        .eq('status', 'searching') // Only accept if still searching
        .is('prestador_id', null) // Only accept if no provider assigned yet
        .select()
        .single();

      if (error) {
        // If error is "no rows returned", it means another provider already accepted
        console.log('[AcceptChamado] Could not accept - likely already taken:', error);
        setIncomingRequest(null);
        toast.error('Chamado já foi aceito por outro prestador');
        return;
      }

      if (!data) {
        setIncomingRequest(null);
        toast.error('Chamado já foi aceito por outro prestador');
        return;
      }

      setChamado(mapDbChamadoToChamado(data));
      setIncomingRequest(null);
      toast.success('Chamado aceito! Inicie a negociação.');
    } catch (error) {
      console.error('Error accepting chamado:', error);
      setIncomingRequest(null);
      toast.error('Chamado já foi aceito por outro prestador');
    }
  }, [authUser, canAccessProviderFeatures]);

  const proposeValue = useCallback(async (value: number) => {
    if (!chamado || !authUser) return;

    try {
      const { error } = await supabase
        .from('chamados')
        .update({ valor_proposto: value })
        .eq('id', chamado.id);

      if (error) throw error;

      await supabase.from('chat_messages').insert({
        chamado_id: chamado.id,
        sender_id: authUser.id,
        sender_type: profile?.active_profile || 'client',
        message: `Valor proposto: R$ ${value.toFixed(2)}`,
      });
      // Removed toast - value proposal is visible in chat
    } catch (error) {
      console.error('Error proposing value:', error);
      toast.error('Erro ao propor valor');
    }
  }, [chamado, authUser, profile?.active_profile]);

  const confirmValue = useCallback(async () => {
    if (!chamado?.valorProposto) {
      toast.error('Nenhum valor proposto');
      return;
    }

    try {
      const { error } = await supabase
        .from('chamados')
        .update({
          status: 'awaiting_payment',
          valor: chamado.valorProposto,
          payment_status: 'pending',
        })
        .eq('id', chamado.id);

      if (error) throw error;

      toast.success('Valor confirmado! Aguardando pagamento.');
    } catch (error) {
      console.error('Error confirming value:', error);
      toast.error('Erro ao confirmar valor');
    }
  }, [chamado]);

  const initiatePayment = useCallback(async (method: PaymentMethod) => {
    if (!chamado) return;

    try {
      const { error } = await supabase
        .from('chamados')
        .update({ payment_method: method })
        .eq('id', chamado.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error initiating payment:', error);
      toast.error('Erro ao selecionar método de pagamento');
    }
  }, [chamado]);

  // Note: For Stripe payments (card/PIX), the webhook handles status updates.
  // This function is kept for manual/mock payments only.
  // The frontend should NOT call this for Stripe payments - the webhook will do it.
  const processPayment = useCallback(async () => {
    if (!chamado) return;

    // Check if this is a Stripe payment - if so, don't update manually
    // The webhook will handle the status update
    if (chamado.payment?.provider === 'stripe') {
      console.log('[Payment] Stripe payment - status will be updated by webhook');
      // Don't update here - wait for webhook
      return;
    }

    try {
      const { error } = await supabase
        .from('chamados')
        .update({
          status: 'in_service',
          payment_status: 'paid_mock',
        })
        .eq('id', chamado.id);

      if (error) throw error;

      toast.success('Pagamento aprovado! Serviço iniciando...');
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Erro ao processar pagamento');
    }
  }, [chamado]);

  const cancelChamado = useCallback(async () => {
    if (!chamado || !authUser) {
      console.log('[CancelChamado] No chamado or authUser');
      return;
    }

    const isProvider = profile?.active_profile === 'provider' && canAccessProviderFeatures;
    const isBeforeServiceStart = ['searching', 'accepted', 'negotiating', 'awaiting_payment'].includes(chamado.status);

    console.log('[CancelChamado] Starting cancel', {
      chamadoId: chamado.id,
      status: chamado.status,
      isProvider,
      isBeforeServiceStart,
      userId: authUser.id,
      prestadorId: chamado.prestadorId,
      clienteId: chamado.clienteId
    });

    try {
      // If PROVIDER cancels BEFORE service starts, resume search instead of canceling
      if (isProvider && isBeforeServiceStart) {
        console.log('[CancelChamado] Provider canceling before service start - resuming search');
        
        // Get current chamado state from DB
        const { data: currentChamado, error: fetchError } = await supabase
          .from('chamados')
          .select('declined_provider_ids, status, prestador_id')
          .eq('id', chamado.id)
          .maybeSingle();

        if (fetchError) {
          console.error('[CancelChamado] Error fetching chamado:', fetchError);
          throw fetchError;
        }

        // If chamado no longer exists, just clear local state
        if (!currentChamado) {
          console.log('[CancelChamado] Chamado no longer exists, clearing local state');
          setChamado(null);
          setChatMessages([]);
          toast.info('Chamado não encontrado');
          return;
        }

        // Check if this provider is actually assigned
        const isAssigned = currentChamado.prestador_id === authUser.id;
        console.log('[CancelChamado] Provider assignment check:', { 
          dbPrestadorId: currentChamado.prestador_id, 
          userId: authUser.id, 
          isAssigned 
        });

        const declinedIds = currentChamado.declined_provider_ids || [];
        const updatedDeclinedIds = [...new Set([...declinedIds, authUser.id])];

        // Build update object - always add to declined list
        const updateData: any = {
          declined_provider_ids: updatedDeclinedIds,
        };

        // Only reset status/fields if provider is actually assigned to this chamado
        if (isAssigned) {
          updateData.status = 'searching';
          updateData.prestador_id = null;
          updateData.valor_proposto = null;
          updateData.valor = null;
          updateData.payment_status = null;
          updateData.stripe_payment_intent_id = null;
        }

        // Use a simpler update without restrictive conditions
        const { error: updateError } = await supabase
          .from('chamados')
          .update(updateData)
          .eq('id', chamado.id);

        if (updateError) {
          console.error('[CancelChamado] Error updating chamado:', updateError);
          throw updateError;
        }
        
        console.log('[CancelChamado] Update successful, provider declined:', authUser.id);
        
        // Add to local recently declined map with cooldown to prevent re-offering immediately
        recentlyDeclinedRef.current.set(chamado.id, Date.now());
        setTimeout(() => {
          recentlyDeclinedRef.current.delete(chamado.id);
          console.log(`[CancelChamado] Cooldown expired for chamado ${chamado.id}, can be re-offered now`);
        }, DECLINE_COOLDOWN_MS);
        
        toast.info('Chamado liberado para outros prestadores');
        
        // Clear provider's local chamado state
        setChamado(null);
        setChatMessages([]);
        return;
      }

      // For CLIENT canceling or DURING/AFTER service: full cancel
      console.log('[CancelChamado] Client or post-service cancel');
      
      const { error } = await supabase
        .from('chamados')
        .update({ status: 'canceled' })
        .eq('id', chamado.id)
        .eq('cliente_id', authUser.id); // Only update if this client owns the chamado

      if (error) {
        console.error('[CancelChamado] Error canceling:', error);
        throw error;
      }

      toast.info('Chamado cancelado');
      
      setChamado(null);
      setChatMessages([]);
    } catch (error) {
      console.error('Error canceling chamado:', error);
      toast.error('Erro ao cancelar chamado');
    }
  }, [chamado, authUser, profile?.active_profile, canAccessProviderFeatures]);

  const finishService = useCallback(async () => {
    if (!chamado) return;

    // CRITICAL: Only providers can finish services
    if (!canAccessProviderFeatures) {
      toast.error('Você não tem permissão para finalizar serviços');
      return;
    }

    try {
      // Change to pending_client_confirmation instead of finished
      const { error } = await supabase
        .from('chamados')
        .update({ 
          status: 'pending_client_confirmation',
          provider_finish_requested_at: new Date().toISOString()
        })
        .eq('id', chamado.id);

      if (error) throw error;

      toast.success('Aguardando confirmação do cliente');
    } catch (error) {
      console.error('Error finishing service:', error);
      toast.error('Erro ao finalizar serviço');
    }
  }, [chamado, canAccessProviderFeatures]);

  // Client confirms that service was completed successfully
  const confirmServiceFinish = useCallback(async () => {
    if (!chamado) return;

    try {
      const { error } = await supabase
        .from('chamados')
        .update({ status: 'finished' })
        .eq('id', chamado.id);

      if (error) throw error;

      // Increment provider's total services
      if (chamado.prestadorId) {
        const { data: providerInfo } = await supabase
          .from('provider_data')
          .select('total_services')
          .eq('user_id', chamado.prestadorId)
          .single();
        
        if (providerInfo) {
          await supabase
            .from('provider_data')
            .update({
              total_services: (providerInfo.total_services || 0) + 1,
            })
            .eq('user_id', chamado.prestadorId);
        }
      }

      // Record service fee automatically
      try {
        const { error: feeError } = await supabase.functions.invoke('record-service-fee', {
          body: { chamado_id: chamado.id }
        });
        
        if (feeError) {
          console.error('Error recording service fee:', feeError);
        } else {
          console.log('Service fee recorded successfully for chamado:', chamado.id);
        }
      } catch (feeErr) {
        console.error('Error invoking record-service-fee:', feeErr);
      }

      toast.success('Serviço finalizado com sucesso!');
    } catch (error) {
      console.error('Error confirming service finish:', error);
      toast.error('Erro ao confirmar finalização');
    }
  }, [chamado]);

  // Client disputes that service was not completed correctly
  const disputeServiceFinish = useCallback(async () => {
    if (!chamado) return;

    try {
      // Revert to in_service status so they can resolve the issue
      const { error } = await supabase
        .from('chamados')
        .update({ 
          status: 'in_service',
          provider_finish_requested_at: null 
        })
        .eq('id', chamado.id);

      if (error) throw error;

      toast.info('Disputa registrada. O serviço voltou ao status "Em Andamento".');
    } catch (error) {
      console.error('Error disputing service finish:', error);
      toast.error('Erro ao registrar disputa');
    }
  }, [chamado]);

  const resetChamado = useCallback(() => {
    setChamado(null);
    setChatMessages([]);
  }, []);

  const submitReview = useCallback(async (rating: number, tags: string[], comment: string) => {
    if (!chamado || !authUser) return;

    const isClient = profile?.active_profile === 'client';
    const reviewedId = isClient ? chamado.prestadorId : chamado.clienteId;

    if (!reviewedId) {
      toast.error('Erro: não foi possível identificar o avaliado');
      return;
    }

    try {
      const { error } = await supabase
        .from('reviews')
        .insert({
          chamado_id: chamado.id,
          reviewer_id: authUser.id,
          reviewed_id: reviewedId,
          reviewer_type: isClient ? 'client' : 'provider',
          rating,
          tags,
          comment: comment || null,
        });

      if (error) throw error;

      toast.success('Avaliação enviada com sucesso!');
      
      // Reset chamado after review
      setTimeout(() => {
        setChamado(null);
        setChatMessages([]);
      }, 1500);
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Erro ao enviar avaliação');
    }
  }, [chamado, authUser, profile?.active_profile]);

  const toggleProviderOnline = useCallback(async () => {
    // CRITICAL: Only registered providers can go online
    if (!canAccessProviderFeatures) {
      toast.error('Você não tem permissão para ficar online como prestador');
      return;
    }

    if (!authUser || !providerData) return;

    try {
      const newStatus = !providerData.is_online;
      
      console.log('[ToggleOnline] Toggling provider status via backend:', { 
        currentStatus: providerData.is_online, 
        newStatus,
        userId: authUser.id,
        hasLocation: !!(providerData.current_lat && providerData.current_lng)
      });
      
      const { data, error } = await supabase.functions.invoke('toggle-provider-online', {
        body: {
          online: newStatus,
          location: providerData.current_lat && providerData.current_lng ? {
            lat: Number(providerData.current_lat),
            lng: Number(providerData.current_lng),
            address: providerData.current_address || undefined,
          } : undefined,
        },
      });

      if (error) throw error;

      // Update local state immediately
      if (newStatus) {
        setProfile(prev => prev ? { ...prev, active_profile: 'provider' } : null);
      }
      setProviderData(prev => prev ? { ...prev, is_online: newStatus } : null);
      
      console.log('[ToggleOnline] Provider is now:', newStatus ? 'ONLINE' : 'OFFLINE', data);
      toast.success(newStatus ? 'Você está online! Aguardando chamados...' : 'Você está offline');
    } catch (error) {
      console.error('[ToggleOnline] Error toggling online status:', error);
      toast.error('Erro ao alterar status');
    }
  }, [authUser, providerData, canAccessProviderFeatures]);

  const setProviderRadarRange = useCallback(async (range: number) => {
    if (!authUser || !canAccessProviderFeatures) return;

    try {
      const { error } = await supabase
        .from('provider_data')
        .update({ radar_range: range })
        .eq('user_id', authUser.id);

      if (error) throw error;

      setProviderData(prev => prev ? { ...prev, radar_range: range } : null);
    } catch (error) {
      console.error('Error setting radar range:', error);
    }
  }, [authUser, canAccessProviderFeatures]);

  const setProviderServices = useCallback(async (services: ServiceType[]) => {
    if (!authUser || !canAccessProviderFeatures || services.length === 0) return;

    try {
      const { error } = await supabase
        .from('provider_data')
        .update({ services_offered: services })
        .eq('user_id', authUser.id);

      if (error) throw error;

      setProviderData(prev => prev ? { ...prev, services_offered: services } : null);
      toast.success('Serviços atualizados!');
    } catch (error) {
      console.error('Error setting services:', error);
      toast.error('Erro ao atualizar serviços');
    }
  }, [authUser, canAccessProviderFeatures]);

  const updateProviderLocation = useCallback(async (location: Location) => {
    if (!authUser || !canAccessProviderFeatures) return;

    try {
      await supabase
        .from('provider_data')
        .update({
          current_lat: location.lat,
          current_lng: location.lng,
          current_address: location.address,
        })
        .eq('user_id', authUser.id);
    } catch (error) {
      console.error('Error updating location:', error);
    }
  }, [authUser, canAccessProviderFeatures]);

  const sendChatMessage = useCallback(async (message: string) => {
    if (!chamado || !authUser) return;

    try {
      const { error } = await supabase.from('chat_messages').insert({
        chamado_id: chamado.id,
        sender_id: authUser.id,
        sender_type: profile?.active_profile || 'client',
        message,
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
    }
  }, [chamado, authUser, profile?.active_profile]);

  const acceptIncomingRequest = useCallback(async () => {
    if (!incomingRequest || !canAccessProviderFeatures) return;
    await acceptChamado(incomingRequest.id);
  }, [incomingRequest, acceptChamado, canAccessProviderFeatures]);

  const declineIncomingRequest = useCallback(async () => {
    if (!incomingRequest || !authUser) {
      setIncomingRequest(null);
      return;
    }

    const chamadoId = incomingRequest.id;
    
    // Mark in queue system (local cooldown)
    markChamadoDeclinedInQueue(chamadoId);
    
    // ALSO keep the local ref for realtime complement
    recentlyDeclinedRef.current.set(chamadoId, Date.now());
    
    // Schedule removal after cooldown period (10 seconds)
    setTimeout(() => {
      recentlyDeclinedRef.current.delete(chamadoId);
      console.log(`[Chamado] Cooldown expired for chamado ${chamadoId.substring(0, 8)}`);
    }, DECLINE_COOLDOWN_MS);
    
    // Clear the incoming request immediately
    setIncomingRequest(null);

    // Record the decline in the database
    try {
      const { data: currentChamado } = await supabase
        .from('chamados')
        .select('declined_provider_ids')
        .eq('id', chamadoId)
        .single();

      const currentDeclined = (currentChamado?.declined_provider_ids as string[]) || [];
      if (!currentDeclined.includes(authUser.id)) {
        await supabase
          .from('chamados')
          .update({ 
            declined_provider_ids: [...currentDeclined, authUser.id] 
          })
          .eq('id', chamadoId);
      }

      console.log(`[Chamado] Provider declined chamado ${chamadoId.substring(0, 8)}`);
    } catch (err) {
      console.error('[Chamado] Error recording decline:', err);
    }
  }, [incomingRequest, authUser, markChamadoDeclinedInQueue]);

  const setChamadoStatus = useCallback((status: ChamadoStatus) => {
    setChamado(prev => prev ? { ...prev, status, updatedAt: new Date() } : null);
  }, []);

  return (
    <AppContext.Provider value={{
      user,
      profile,
      providerData,
      perfilPrincipal,
      canAccessProviderFeatures,
      setActiveProfile,
      isLoading: authLoading || isLoading,
      chamado,
      setChamadoStatus,
      createChamado,
      acceptChamado,
      proposeValue,
      confirmValue,
      cancelChamado,
      finishService,
      confirmServiceFinish,
      disputeServiceFinish,
      resetChamado,
      submitReview,
      initiatePayment,
      processPayment,
      availableProviders,
      toggleProviderOnline,
      setProviderRadarRange,
      setProviderServices,
      updateProviderLocation,
      chatMessages,
      sendChatMessage,
      incomingRequest,
      acceptIncomingRequest,
      declineIncomingRequest,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useOptionalApp() {
  return useContext(AppContext);
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
