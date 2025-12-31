/**
 * Domain constants for Chamado
 * Pure configuration - no dependencies
 */

import { ServiceType } from './types';

/**
 * Service configuration - defines behavior for each service type
 */
export interface ServiceConfig {
  label: string;
  description: string;
  icon: string;
  requiresDestination: boolean;
  estimatedTime: string;
}

export const SERVICE_CONFIG: Record<ServiceType, ServiceConfig> = {
  guincho: {
    label: 'Guincho',
    description: 'Reboque do veículo para oficina ou destino',
    icon: '🚛',
    requiresDestination: true,
    estimatedTime: '30-45 min',
  },
  borracharia: {
    label: 'Borracharia Móvel',
    description: 'Troca de pneu, calibragem, reparo no local',
    icon: '🔧',
    requiresDestination: false,
    estimatedTime: '20-30 min',
  },
  mecanica: {
    label: 'Mecânica Móvel',
    description: 'Diagnóstico e reparo no local',
    icon: '🔩',
    requiresDestination: false,
    estimatedTime: '30-60 min',
  },
  chaveiro: {
    label: 'Chaveiro Automotivo',
    description: 'Abertura de veículo, cópia de chave',
    icon: '🔑',
    requiresDestination: false,
    estimatedTime: '15-25 min',
  },
};

/**
 * Active statuses - chamado is in progress
 */
export const ACTIVE_STATUSES: readonly string[] = [
  'searching',
  'accepted',
  'negotiating',
  'awaiting_payment',
  'in_service',
  'pending_client_confirmation',
] as const;

/**
 * Statuses where provider can cancel and chamado resumes search
 */
export const CANCELLABLE_BY_PROVIDER_STATUSES: readonly string[] = [
  'searching',
  'accepted',
  'negotiating',
  'awaiting_payment',
] as const;

/**
 * Cooldown duration for re-offering declined chamados (ms)
 */
export const DECLINE_COOLDOWN_MS = 10 * 1000;

/**
 * Polling intervals for status synchronization (ms)
 */
export const POLLING_INTERVALS = {
  searching: 3000,
  default: 10000,
} as const;
