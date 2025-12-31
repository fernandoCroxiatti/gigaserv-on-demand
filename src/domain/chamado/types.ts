/**
 * Domain types for Chamado (service request)
 * Pure TypeScript - no React or external dependencies
 * Designed for easy migration to native platforms
 */

// Status progression: idle → searching → negotiating → awaiting_payment → in_service → finished
export type ChamadoStatus = 
  | 'idle'
  | 'searching'
  | 'accepted'        // Legacy - redirects to negotiating
  | 'negotiating'
  | 'awaiting_payment'
  | 'confirmed'       // Legacy - redirects to in_service
  | 'in_service'
  | 'pending_client_confirmation'
  | 'finished'
  | 'canceled';

export type ServiceType = 
  | 'guincho'      // Tow truck - requires origin AND destination
  | 'borracharia'  // Mobile tire service - origin only
  | 'mecanica'     // Mobile mechanic - origin only
  | 'chaveiro';    // Locksmith - origin only

export type PaymentStatus = 
  | 'pending'
  | 'paid_mock'
  | 'paid_stripe'
  | 'failed'
  | 'refunded';

export type PaymentMethod = 
  | 'pix'
  | 'credit_card'
  | 'debit_card'
  | 'cash'
  | 'stripe';

export type PaymentProvider = 
  | 'mock'
  | 'stripe'
  | 'mercadopago';

/**
 * Geographic location with address
 */
export interface Location {
  lat: number;
  lng: number;
  address: string;
  placeId?: string;
}

/**
 * Payment information
 */
export interface Payment {
  id: string;
  status: PaymentStatus;
  method: PaymentMethod;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  stripePaymentIntentId?: string;
  stripeCustomerId?: string;
  createdAt: Date;
  paidAt?: Date;
  metadata?: Record<string, string>;
}

/**
 * Core Chamado entity - represents a service request
 */
export interface Chamado {
  id: string;
  status: ChamadoStatus;
  tipoServico: ServiceType;
  clienteId: string;
  prestadorId: string | null;
  origem: Location;
  destino: Location | null;
  valor: number | null;
  valorProposto: number | null;
  payment: Payment | null;
  vehicleType: string | null;
  
  // Negotiation tracking
  lastProposalBy: 'client' | 'provider' | null;
  valueAccepted: boolean;
  
  // Direct payment flags
  directPaymentToProvider?: boolean;
  directPaymentReceiptConfirmed?: boolean;
  directPaymentConfirmedAt?: Date | null;
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User profile type
 */
export type UserProfile = 'client' | 'provider';

/**
 * Chat message
 */
export interface ChatMessage {
  id: string;
  senderId: string;
  senderType: UserProfile;
  message: string;
  timestamp: Date;
}

/**
 * Provider entity
 */
export interface Provider {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  totalServices: number;
  online: boolean;
  location: Location;
  radarRange: number;
  services: ServiceType[];
  vehiclePlate?: string;
}

/**
 * Data required to create a new chamado
 */
export interface CreateChamadoInput {
  tipoServico: ServiceType;
  origem: Location;
  destino: Location | null;
  vehicleType?: string;
}

/**
 * Result of chamado operations
 */
export interface ChamadoOperationResult {
  success: boolean;
  error?: string;
  chamado?: Chamado;
}
