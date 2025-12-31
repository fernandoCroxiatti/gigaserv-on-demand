/**
 * Chamado Service - Database operations
 * Isolates Supabase calls from business logic
 */

import { supabase } from '@/integrations/supabase/client';
import { 
  Chamado, 
  ChamadoStatus, 
  ServiceType, 
  Location,
  CreateChamadoInput,
  ChamadoOperationResult 
} from '@/domain/chamado/types';
import { mapDbChamadoToDomain, DbChamadoRow } from '@/domain/chamado/mappers';
import { validateCreateChamadoInput, serviceRequiresDestination } from '@/domain/chamado/validation';

/**
 * Create a new chamado via backend edge function
 */
export async function createChamado(
  userId: string,
  input: CreateChamadoInput
): Promise<ChamadoOperationResult> {
  // Validate input using domain rules
  const validation = validateCreateChamadoInput(input);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const needsDestination = serviceRequiresDestination(input.tipoServico);

  try {
    const { data, error } = await supabase.functions.invoke('create-chamado', {
      body: {
        tipo_servico: input.tipoServico,
        origem_lat: input.origem.lat,
        origem_lng: input.origem.lng,
        origem_address: input.origem.address,
        destino_lat: needsDestination && input.destino ? input.destino.lat : null,
        destino_lng: needsDestination && input.destino ? input.destino.lng : null,
        destino_address: needsDestination && input.destino ? input.destino.address : null,
        vehicle_type: input.vehicleType || null,
      },
    });

    if (error) {
      console.error('[ChamadoService] Create error:', error);
      return { success: false, error: 'Erro ao criar chamado' };
    }

    const chamadoData = (data as any)?.chamado;
    if (!chamadoData) {
      return { success: false, error: 'Chamado não retornado do backend' };
    }

    return { 
      success: true, 
      chamado: mapDbChamadoToDomain(chamadoData) 
    };
  } catch (err) {
    console.error('[ChamadoService] Create exception:', err);
    return { success: false, error: 'Erro ao criar chamado' };
  }
}

/**
 * Fetch active chamado for a user
 */
export async function fetchActiveChamado(
  userId: string,
  activeProfile: 'client' | 'provider',
  isProvider: boolean
): Promise<Chamado | null> {
  try {
    const query = activeProfile === 'client' || !isProvider
      ? supabase.from('chamados').select('*').eq('cliente_id', userId)
      : supabase.from('chamados').select('*').eq('prestador_id', userId);

    const { data, error } = await query
      .not('status', 'in', '("finished","canceled","idle")')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[ChamadoService] Fetch error:', error);
      return null;
    }

    return data ? mapDbChamadoToDomain(data as DbChamadoRow) : null;
  } catch (err) {
    console.error('[ChamadoService] Fetch exception:', err);
    return null;
  }
}

/**
 * Fetch chamado by ID
 */
export async function fetchChamadoById(chamadoId: string): Promise<Chamado | null> {
  try {
    const { data, error } = await supabase
      .from('chamados')
      .select('*')
      .eq('id', chamadoId)
      .single();

    if (error || !data) return null;
    return mapDbChamadoToDomain(data as DbChamadoRow);
  } catch (err) {
    console.error('[ChamadoService] FetchById exception:', err);
    return null;
  }
}

/**
 * Accept a chamado as provider
 */
export async function acceptChamado(
  chamadoId: string,
  providerId: string
): Promise<ChamadoOperationResult> {
  try {
    // Verify chamado is still available
    const { data: current, error: checkError } = await supabase
      .from('chamados')
      .select('status, prestador_id')
      .eq('id', chamadoId)
      .single();

    if (checkError || !current) {
      return { success: false, error: 'Chamado não encontrado' };
    }

    if (current.status !== 'searching') {
      return { success: false, error: 'Chamado já foi aceito por outro prestador' };
    }

    if (current.prestador_id) {
      return { success: false, error: 'Chamado já foi aceito por outro prestador' };
    }

    // Atomic accept
    const { data, error } = await supabase
      .from('chamados')
      .update({
        prestador_id: providerId,
        status: 'negotiating',
      })
      .eq('id', chamadoId)
      .eq('status', 'searching')
      .is('prestador_id', null)
      .select()
      .single();

    if (error || !data) {
      console.error('[ChamadoService] Accept error:', error);
      return { success: false, error: 'Chamado já foi aceito por outro prestador' };
    }

    return { 
      success: true, 
      chamado: mapDbChamadoToDomain(data as DbChamadoRow) 
    };
  } catch (err) {
    console.error('[ChamadoService] Accept exception:', err);
    return { success: false, error: 'Erro ao aceitar chamado' };
  }
}

/**
 * Update chamado status
 */
export async function updateChamadoStatus(
  chamadoId: string,
  status: string,
  additionalFields?: Record<string, any>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('chamados')
      .update({ status: status as any, ...additionalFields })
      .eq('id', chamadoId);

    if (error) {
      console.error('[ChamadoService] UpdateStatus error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[ChamadoService] UpdateStatus exception:', err);
    return false;
  }
}

/**
 * Cancel chamado by client
 */
export async function cancelChamadoByClient(
  chamadoId: string,
  clientId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('chamados')
      .update({ status: 'canceled' })
      .eq('id', chamadoId)
      .eq('cliente_id', clientId);

    return !error;
  } catch (err) {
    console.error('[ChamadoService] CancelByClient exception:', err);
    return false;
  }
}

/**
 * Provider declines/cancels - resume search
 */
export async function providerDeclineChamado(
  chamadoId: string,
  providerId: string
): Promise<boolean> {
  try {
    const { data: current } = await supabase
      .from('chamados')
      .select('declined_provider_ids, prestador_id')
      .eq('id', chamadoId)
      .maybeSingle();

    if (!current) return false;

    const declinedIds = current.declined_provider_ids || [];
    const updatedDeclinedIds = [...new Set([...declinedIds, providerId])];
    const isAssigned = current.prestador_id === providerId;

    const updateData: Record<string, any> = {
      declined_provider_ids: updatedDeclinedIds,
    };

    if (isAssigned) {
      updateData.status = 'searching';
      updateData.prestador_id = null;
      updateData.valor = null;
      updateData.payment_status = null;
      updateData.stripe_payment_intent_id = null;
    }

    const { error } = await supabase
      .from('chamados')
      .update(updateData)
      .eq('id', chamadoId);

    return !error;
  } catch (err) {
    console.error('[ChamadoService] ProviderDecline exception:', err);
    return false;
  }
}

/**
 * Propose a value for negotiation
 */
export async function proposeValue(
  chamadoId: string,
  value: number,
  proposedBy: 'client' | 'provider'
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('chamados')
      .update({
        valor_proposto: value,
        last_proposal_by: proposedBy,
        value_accepted: false,
      })
      .eq('id', chamadoId);

    return !error;
  } catch (err) {
    console.error('[ChamadoService] ProposeValue exception:', err);
    return false;
  }
}

/**
 * Accept the current proposed value
 */
export async function acceptValue(
  chamadoId: string,
  currentValue: number
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('chamados')
      .update({
        value_accepted: true,
        valor: currentValue,
      })
      .eq('id', chamadoId);

    return !error;
  } catch (err) {
    console.error('[ChamadoService] AcceptValue exception:', err);
    return false;
  }
}

/**
 * Confirm value and move to awaiting_payment
 */
export async function confirmValue(
  chamadoId: string,
  value: number
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('chamados')
      .update({
        status: 'awaiting_payment',
        valor: value,
        payment_status: 'pending',
      })
      .eq('id', chamadoId);

    return !error;
  } catch (err) {
    console.error('[ChamadoService] ConfirmValue exception:', err);
    return false;
  }
}
