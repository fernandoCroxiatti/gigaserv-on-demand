/**
 * Domain validation rules for Chamado
 * Pure functions - no side effects, no dependencies
 */

import { ChamadoStatus, ServiceType, Location, CreateChamadoInput } from './types';
import { SERVICE_CONFIG, CANCELLABLE_BY_PROVIDER_STATUSES, ACTIVE_STATUSES } from './constants';

/**
 * Check if a service type requires destination
 */
export function serviceRequiresDestination(serviceType: ServiceType): boolean {
  return SERVICE_CONFIG[serviceType].requiresDestination;
}

/**
 * Validate chamado creation input
 */
export function validateCreateChamadoInput(input: CreateChamadoInput): { valid: boolean; error?: string } {
  if (!input.origem) {
    return { valid: false, error: 'Origem é obrigatória' };
  }
  
  if (!isValidLocation(input.origem)) {
    return { valid: false, error: 'Origem inválida' };
  }
  
  const needsDestination = serviceRequiresDestination(input.tipoServico);
  if (needsDestination) {
    if (!input.destino) {
      return { valid: false, error: 'Informe o destino para o serviço de guincho' };
    }
    if (!isValidLocation(input.destino)) {
      return { valid: false, error: 'Destino inválido' };
    }
  }
  
  return { valid: true };
}

/**
 * Check if location is valid
 */
export function isValidLocation(location: Location | null | undefined): location is Location {
  if (!location) return false;
  return (
    typeof location.lat === 'number' &&
    typeof location.lng === 'number' &&
    !isNaN(location.lat) &&
    !isNaN(location.lng) &&
    typeof location.address === 'string' &&
    location.address.trim().length > 0
  );
}

/**
 * Check if chamado is in an active (non-terminal) state
 */
export function isActiveChamado(status: ChamadoStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/**
 * Check if provider can cancel chamado (and resume search)
 */
export function canProviderCancelAndResumeSearch(status: ChamadoStatus): boolean {
  return CANCELLABLE_BY_PROVIDER_STATUSES.includes(status);
}

/**
 * Check if client can cancel chamado
 */
export function canClientCancel(status: ChamadoStatus): boolean {
  // Client can always cancel until service is finished
  return status !== 'finished' && status !== 'canceled' && status !== 'idle';
}

/**
 * Check if value proposal is allowed
 */
export function canProposeValue(status: ChamadoStatus): boolean {
  return status === 'negotiating';
}

/**
 * Check if value can be confirmed (move to awaiting_payment)
 */
export function canConfirmValue(
  status: ChamadoStatus,
  valueAccepted: boolean,
  valorProposto: number | null
): boolean {
  return status === 'negotiating' && valueAccepted && valorProposto !== null && valorProposto > 0;
}

/**
 * Check if provider can finish service
 */
export function canProviderFinishService(status: ChamadoStatus): boolean {
  return status === 'in_service';
}

/**
 * Check if client can confirm service finish
 */
export function canClientConfirmFinish(status: ChamadoStatus): boolean {
  return status === 'pending_client_confirmation';
}

/**
 * Get next valid status transitions for a given status
 */
export function getValidTransitions(status: ChamadoStatus): ChamadoStatus[] {
  const transitions: Record<ChamadoStatus, ChamadoStatus[]> = {
    idle: ['searching'],
    searching: ['negotiating', 'canceled'],
    accepted: ['negotiating', 'canceled'], // Legacy
    negotiating: ['awaiting_payment', 'searching', 'canceled'],
    awaiting_payment: ['in_service', 'negotiating', 'canceled'],
    confirmed: ['in_service', 'canceled'], // Legacy
    in_service: ['pending_client_confirmation', 'canceled'],
    pending_client_confirmation: ['finished', 'in_service'],
    finished: [],
    canceled: [],
  };
  
  return transitions[status] || [];
}

/**
 * Check if a status transition is valid
 */
export function isValidTransition(from: ChamadoStatus, to: ChamadoStatus): boolean {
  return getValidTransitions(from).includes(to);
}
