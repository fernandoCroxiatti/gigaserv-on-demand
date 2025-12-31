/**
 * Domain mappers for Chamado
 * Transform database records to domain entities and vice-versa
 * Isolates database schema from domain model
 */

import { Chamado, ChamadoStatus, ServiceType, PaymentMethod, Location } from './types';

/**
 * Database chamado row type (matches Supabase schema)
 */
export interface DbChamadoRow {
  id: string;
  status: string;
  tipo_servico: string;
  cliente_id: string | null;
  prestador_id: string | null;
  origem_lat: number;
  origem_lng: number;
  origem_address: string;
  destino_lat: number | null;
  destino_lng: number | null;
  destino_address: string | null;
  valor: number | null;
  valor_proposto: number | null;
  vehicle_type?: string | null;
  last_proposal_by?: string | null;
  value_accepted?: boolean | null;
  payment_status?: string | null;
  payment_method?: string | null;
  payment_provider?: string | null;
  stripe_payment_intent_id?: string | null;
  direct_payment_to_provider?: boolean | null;
  direct_payment_receipt_confirmed?: boolean | null;
  direct_payment_confirmed_at?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Map database chamado row to domain entity
 */
export function mapDbChamadoToDomain(db: DbChamadoRow): Chamado {
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
    vehicleType: db.vehicle_type || null,
    
    // Negotiation tracking
    lastProposalBy: db.last_proposal_by as 'client' | 'provider' | null,
    valueAccepted: db.value_accepted === true,
    
    payment: db.payment_status ? {
      id: db.stripe_payment_intent_id || `payment-${db.id}`,
      status: db.payment_status as any,
      method: (db.payment_method as PaymentMethod) || 'pix',
      amount: db.valor ? Number(db.valor) : 0,
      currency: 'BRL',
      provider: (db.payment_provider as 'mock' | 'stripe' | 'mercadopago') || 'mock',
      stripePaymentIntentId: db.stripe_payment_intent_id || undefined,
      createdAt: new Date(db.created_at),
    } : null,

    // Direct payment flags
    directPaymentToProvider: db.direct_payment_to_provider === true,
    directPaymentReceiptConfirmed: db.direct_payment_receipt_confirmed === true,
    directPaymentConfirmedAt: db.direct_payment_confirmed_at 
      ? new Date(db.direct_payment_confirmed_at) 
      : null,

    createdAt: new Date(db.created_at),
    updatedAt: new Date(db.updated_at),
  };
}

/**
 * Map domain chamado to database insert format
 */
export function mapDomainToDbInsert(
  tipoServico: ServiceType,
  origem: Location,
  destino: Location | null,
  vehicleType?: string
): Record<string, any> {
  return {
    tipo_servico: tipoServico,
    origem_lat: origem.lat,
    origem_lng: origem.lng,
    origem_address: origem.address,
    destino_lat: destino?.lat ?? null,
    destino_lng: destino?.lng ?? null,
    destino_address: destino?.address ?? null,
    vehicle_type: vehicleType || null,
    status: 'searching',
  };
}
