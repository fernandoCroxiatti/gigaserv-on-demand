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
  const recentlyDeclinedRef = useRef<Set<string>>(new Set());

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

  // Load profile when auth user changes
  useEffect(() => {
    if (!authUser) {
      setProfile(null);
      setProviderData(null);
      setIsLoading(false);
      return;
    }

    const loadProfile = async () => {
      try {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', authUser.id)
          .maybeSingle();

        if (profileError) throw profileError;
        setProfile(profileData);

        // Only load provider data if user is a registered provider
        if (profileData?.perfil_principal === 'provider') {
          const { data: provData } = await supabase
            .from('provider_data')
            .select('*')
            .eq('user_id', authUser.id)
            .maybeSingle();

          setProviderData(provData);
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

    loadProfile();
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
            
            if (updated.status === 'accepted') {
              toast.success('Um prestador aceitou seu chamado!');
            } else if (updated.status === 'in_service') {
              toast.success('Pagamento aprovado! Serviço iniciado.');
            } else if (updated.status === 'finished') {
              toast.success('Serviço finalizado!');
            }
            // Removed: searching status toast - too noisy
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

  // Listen for incoming requests (ONLY for registered providers who are online)
  useEffect(() => {
    // CRITICAL: Only listen if user is a registered provider AND active as provider
    if (!authUser || !canAccessProviderFeatures || profile?.active_profile !== 'provider' || !providerData?.is_online || chamado) return;

    // Check for existing searching chamados when provider goes online
    const checkExistingChamados = async () => {
      console.log('[Chamados] Checking for existing searching chamados...');
      
      const { data: searchingChamados, error } = await supabase
        .from('chamados')
        .select('*')
        .eq('status', 'searching')
        .is('prestador_id', null);

      if (error) {
        console.error('[Chamados] Error checking existing chamados:', error);
        return;
      }

      if (searchingChamados && searchingChamados.length > 0) {
        const services = providerData.services_offered || ['guincho'];
        const radarRange = providerData.radar_range || 15;
        const providerLat = providerData.current_lat ? Number(providerData.current_lat) : null;
        const providerLng = providerData.current_lng ? Number(providerData.current_lng) : null;

        console.log(`[Chamados] Found ${searchingChamados.length} searching chamados, checking distance...`);

        for (const dbChamado of searchingChamados) {
          const chamadoData = mapDbChamadoToChamado(dbChamado);
          
          // Check if this provider has already declined this chamado
          const declinedProviderIds = dbChamado.declined_provider_ids || [];
          if (declinedProviderIds.includes(authUser.id)) {
            console.log(`[Chamados] Skipping chamado ${chamadoData.id}: provider already declined`);
            continue;
          }
          
          // Check if provider offers this service
          if (!services.includes(chamadoData.tipoServico)) {
            console.log(`[Chamados] Skipping chamado ${chamadoData.id}: service ${chamadoData.tipoServico} not offered`);
            continue;
          }

          // Check if chamado is within radar range
          const isWithinRange = isChamadoWithinRange(
            providerLat,
            providerLng,
            chamadoData.origem.lat,
            chamadoData.origem.lng,
            radarRange
          );

          if (isWithinRange) {
            console.log(`[Chamados] Found chamado within range: ${chamadoData.id}`);
            setIncomingRequest(chamadoData);
            // Sound is handled by IncomingRequestCard component
            toast.info('Novo chamado disponível!', {
              description: 'Um cliente está procurando atendimento.',
            });
            break; // Show one chamado at a time
          }
        }
      }
    };

    checkExistingChamados();

    // Also listen for UPDATE events (chamado returned to searching after provider cancel)
    const channel = supabase
      .channel('incoming-chamados')
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
          const newChamado = mapDbChamadoToChamado(dbChamado);
          
          // Check if this provider has already declined this chamado
          const declinedProviderIds = dbChamado.declined_provider_ids || [];
          if (declinedProviderIds.includes(authUser.id)) {
            console.log(`[Chamados] New chamado ${newChamado.id}: provider already declined, skipping`);
            return;
          }
          
          const services = providerData.services_offered || ['guincho'];
          const radarRange = providerData.radar_range || 15;
          const providerLat = providerData.current_lat ? Number(providerData.current_lat) : null;
          const providerLng = providerData.current_lng ? Number(providerData.current_lng) : null;

          // Check if provider offers this service
          if (!services.includes(newChamado.tipoServico)) {
            console.log(`[Chamados] New chamado ${newChamado.id}: service ${newChamado.tipoServico} not offered`);
            return;
          }

          // Check if chamado is within radar range
          const isWithinRange = isChamadoWithinRange(
            providerLat,
            providerLng,
            newChamado.origem.lat,
            newChamado.origem.lng,
            radarRange
          );

          if (isWithinRange) {
            console.log(`[Chamados] New chamado within range: ${newChamado.id}`);
            setIncomingRequest(newChamado);
            // Sound is handled by IncomingRequestCard component
            toast.info('Novo chamado!', {
              description: 'Um cliente próximo precisa de ajuda.',
            });
          } else {
            console.log(`[Chamados] New chamado ${newChamado.id} is outside radar range`);
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
          
          // COMPETITIVE: Clear incomingRequest if this chamado was taken by another provider
          // or canceled by client
          if (incomingRequest && dbChamado.id === incomingRequest.id) {
            const wasAccepted = dbChamado.status !== 'searching' || dbChamado.prestador_id !== null;
            if (wasAccepted) {
              console.log(`[Chamados] Chamado ${dbChamado.id} was accepted by another provider or status changed`);
              setIncomingRequest(null);
              stopRideAlertLoop();
              return;
            }
            
            // If chamado is still searching but declined_provider_ids was updated (someone declined)
            // and we are the one who declined, just ignore (don't re-show)
            const declinedProviderIds = dbChamado.declined_provider_ids || [];
            if (declinedProviderIds.includes(authUser.id)) {
              console.log(`[Chamados] UPDATE on our incomingRequest but we already declined, ignoring`);
              // Don't clear incomingRequest here - it was already cleared in declineIncomingRequest
              return;
            }
          }
          
          // Only process UPDATE if it's for a chamado going TO searching status
          // OR if declined_provider_ids changed (someone declined)
          if (dbChamado.status !== 'searching' || dbChamado.prestador_id !== null) {
            return;
          }
          
          // IMPORTANT: Check if this provider has already declined this chamado
          // This prevents the loop where a provider declines and immediately gets the chamado back
          const declinedProviderIds = dbChamado.declined_provider_ids || [];
          if (declinedProviderIds.includes(authUser.id)) {
            console.log(`[Chamados] Updated chamado ${dbChamado.id}: provider already declined (in DB), skipping`);
            return;
          }
          
          // Also check our local recently declined set (for race conditions)
          if (recentlyDeclinedRef.current.has(dbChamado.id)) {
            console.log(`[Chamados] Updated chamado ${dbChamado.id}: provider recently declined (local), skipping`);
            return;
          }
          
          // Don't re-trigger for the same chamado we already have as incomingRequest
          if (incomingRequest && incomingRequest.id === dbChamado.id) {
            console.log(`[Chamados] Updated chamado ${dbChamado.id}: already showing as incomingRequest`);
            return;
          }
          
          const chamadoData = mapDbChamadoToChamado(dbChamado);
          
          const services = providerData.services_offered || ['guincho'];
          const radarRange = providerData.radar_range || 15;
          const providerLat = providerData.current_lat ? Number(providerData.current_lat) : null;
          const providerLng = providerData.current_lng ? Number(providerData.current_lng) : null;

          // Check if provider offers this service
          if (!services.includes(chamadoData.tipoServico)) {
            console.log(`[Chamados] Updated chamado ${chamadoData.id}: service ${chamadoData.tipoServico} not offered`);
            return;
          }

          // Check if chamado is within radar range
          const isWithinRange = isChamadoWithinRange(
            providerLat,
            providerLng,
            chamadoData.origem.lat,
            chamadoData.origem.lng,
            radarRange
          );

          if (isWithinRange) {
            console.log(`[Chamados] Updated chamado within range: ${chamadoData.id}`);
            setIncomingRequest(chamadoData);
            // Sound is handled by IncomingRequestCard component
            toast.info('Chamado disponível novamente!', {
              description: 'Um cliente precisa de ajuda.',
            });
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
      const insertData: any = {
        cliente_id: authUser.id,
        tipo_servico: tipoServico,
        status: 'searching',
        origem_lat: origem.lat,
        origem_lng: origem.lng,
        origem_address: origem.address,
        destino_lat: needsDestination && destino ? destino.lat : null,
        destino_lng: needsDestination && destino ? destino.lng : null,
        destino_address: needsDestination && destino ? destino.address : null,
      };
      
      if (vehicleType) {
        insertData.vehicle_type = vehicleType;
      }

      const { data, error } = await supabase
        .from('chamados')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      setChamado(mapDbChamadoToChamado(data));
      // Removed noisy toast - user can see the searching state in UI
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
    if (!chamado || !authUser) return;

    const isProvider = profile?.active_profile === 'provider' && canAccessProviderFeatures;
    const isBeforeServiceStart = ['searching', 'accepted', 'negotiating', 'awaiting_payment'].includes(chamado.status);

    try {
      // If PROVIDER cancels BEFORE service starts, resume search instead of canceling
      if (isProvider && isBeforeServiceStart) {
        console.log('[CancelChamado] Provider canceling before service start - resuming search');
        
        // Get current declined providers list
        const { data: currentChamado } = await supabase
          .from('chamados')
          .select('declined_provider_ids')
          .eq('id', chamado.id)
          .single();

        const declinedIds = currentChamado?.declined_provider_ids || [];
        
        // Add current provider to declined list
        const updatedDeclinedIds = [...new Set([...declinedIds, authUser.id])];

        const { error } = await supabase
          .from('chamados')
          .update({ 
            status: 'searching',
            prestador_id: null,
            valor_proposto: null,
            valor: null,
            payment_status: null,
            stripe_payment_intent_id: null,
            declined_provider_ids: updatedDeclinedIds,
          })
          .eq('id', chamado.id);

        if (error) throw error;
        // Removed toast - provider already sees the state change
        
        // Clear provider's local chamado state
        setTimeout(() => {
          setChamado(null);
          setChatMessages([]);
        }, 1000);
        return;
      }

      // For CLIENT canceling or DURING/AFTER service: full cancel
      const { error } = await supabase
        .from('chamados')
        .update({ status: 'canceled' })
        .eq('id', chamado.id);

      if (error) throw error;

      toast.info('Chamado cancelado');
      
      setTimeout(() => {
        setChamado(null);
        setChatMessages([]);
      }, 2000);
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
      const { error } = await supabase
        .from('chamados')
        .update({ status: 'finished' })
        .eq('id', chamado.id);

      if (error) throw error;

      if (providerData) {
        await supabase
          .from('provider_data')
          .update({
            total_services: (providerData.total_services || 0) + 1,
          })
          .eq('user_id', authUser?.id);
      }

      // Record service fee automatically
      try {
        const { error: feeError } = await supabase.functions.invoke('record-service-fee', {
          body: { chamado_id: chamado.id }
        });
        
        if (feeError) {
          console.error('Error recording service fee:', feeError);
          // Don't block the finish flow, just log the error
        } else {
          console.log('Service fee recorded successfully for chamado:', chamado.id);
        }
      } catch (feeErr) {
        console.error('Error invoking record-service-fee:', feeErr);
      }

      toast.success('Serviço finalizado com sucesso!');

      setTimeout(() => {
        setChamado(null);
        setChatMessages([]);
      }, 5000);
    } catch (error) {
      console.error('Error finishing service:', error);
      toast.error('Erro ao finalizar serviço');
    }
  }, [chamado, providerData, authUser, canAccessProviderFeatures]);

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
      
      // Update provider online status
      const { error } = await supabase
        .from('provider_data')
        .update({ is_online: newStatus })
        .eq('user_id', authUser.id);

      if (error) throw error;

      // CRITICAL: When going online, ensure active_profile is set to 'provider'
      // This is required for the chamado listener to work correctly
      if (newStatus) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ active_profile: 'provider' })
          .eq('user_id', authUser.id);
        
        if (!profileError) {
          setProfile(prev => prev ? { ...prev, active_profile: 'provider' } : null);
        }
      }

      setProviderData(prev => prev ? { ...prev, is_online: newStatus } : null);
      toast.success(newStatus ? 'Você está online!' : 'Você está offline');
    } catch (error) {
      console.error('Error toggling online status:', error);
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
    
    // IMMEDIATELY add to local recently declined set to prevent race conditions
    recentlyDeclinedRef.current.add(chamadoId);
    
    // Clear the incoming request immediately
    setIncomingRequest(null);

    // Record the decline in the chamado so client can track and expand radius
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

      console.log('[Chamado] Provider declined, recorded in chamado');
    } catch (err) {
      console.error('[Chamado] Error recording decline:', err);
    }
    // Removed toast - UI state change is clear enough
  }, [incomingRequest, authUser]);

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
