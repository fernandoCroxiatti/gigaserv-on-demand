export type ChamadoStatus = 
  | 'idle'
  | 'searching'
  | 'accepted'
  | 'negotiating'
  | 'awaiting_payment'  // New status for payment flow
  | 'confirmed'
  | 'in_service'
  | 'finished'
  | 'canceled';

export type UserProfile = 'client' | 'provider';

export type PaymentStatus = 
  | 'pending'
  | 'paid_mock'      // Mock payment (no real processing)
  | 'paid_stripe'    // Future: Stripe payment processed
  | 'failed'
  | 'refunded';

export type PaymentMethod = 
  | 'pix'
  | 'credit_card'
  | 'debit_card'
  | 'cash'
  | 'stripe';        // Future: Stripe integration

export type PaymentProvider = 
  | 'mock'           // Current: simulated payment
  | 'stripe'         // Future: Stripe integration
  | 'mercadopago';   // Future: other providers

export interface Location {
  lat: number;
  lng: number;
  address: string;
}

// Payment structure prepared for Stripe integration
export interface Payment {
  id: string;
  status: PaymentStatus;
  method: PaymentMethod;
  amount: number;
  currency: string;
  provider: PaymentProvider;
  // Future Stripe fields
  stripePaymentIntentId?: string;
  stripeCustomerId?: string;
  // Timestamps
  createdAt: Date;
  paidAt?: Date;
  // Metadata
  metadata?: Record<string, string>;
}

export interface Chamado {
  id: string;
  status: ChamadoStatus;
  clienteId: string;
  prestadorId: string | null;
  origem: Location;
  destino: Location;
  valor: number | null;
  valorProposto: number | null;
  // Payment integration
  payment: Payment | null;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface Provider {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  totalServices: number;
  online: boolean;
  location: Location;
  radarRange: number; // km
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  activeProfile: UserProfile;
  providerData?: {
    online: boolean;
    radarRange: number;
    rating: number;
    totalServices: number;
  };
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderType: UserProfile;
  message: string;
  timestamp: Date;
}

// Helper function to create a mock payment
export function createMockPayment(amount: number, method: PaymentMethod = 'pix'): Payment {
  return {
    id: `payment-${Date.now()}`,
    status: 'pending',
    method,
    amount,
    currency: 'BRL',
    provider: 'mock',
    createdAt: new Date(),
  };
}

// Helper function to simulate payment approval (for mock)
export function approveMockPayment(payment: Payment): Payment {
  return {
    ...payment,
    status: 'paid_mock',
    paidAt: new Date(),
  };
}
