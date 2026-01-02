/**
 * NOTIFICATION AUDIENCE FILTER - SINGLE SOURCE OF TRUTH
 * 
 * This module provides the ONLY allowed way to filter notifications by audience.
 * All notification rendering, badge counting, and state updates MUST use these functions.
 * 
 * CANONICAL VALUES (IMMUTABLE - DO NOT CHANGE):
 * - "clientes" → notifications for clients
 * - "prestadores" → notifications for providers  
 * - "todos" → notifications for everyone
 * 
 * INVALID VALUES (silently discarded):
 * - "cliente" (wrong - missing 's')
 * - "prestador" (wrong - missing 'es')
 * - "ambos" (wrong - use "todos")
 * - "Sr." or any abbreviation
 * - null, undefined, empty string
 * - Any other value
 */

export type NotificationAudience = 'clientes' | 'prestadores' | 'todos';
export type UserRole = 'client' | 'provider' | 'admin';

/**
 * User profiles structure - represents REGISTERED profiles, not active session
 * A provider is ALSO a client (can request services)
 */
export interface UserProfiles {
  isClient: boolean;
  isProvider: boolean;
  isAdmin: boolean;
}

// Canonical valid audience values - LOCKED - DO NOT MODIFY
const VALID_AUDIENCES: readonly NotificationAudience[] = ['clientes', 'prestadores', 'todos'] as const;

/**
 * Validates if a notification audience value is canonical
 * Returns false for null, undefined, empty, typos, or any non-canonical value
 * 
 * REJECTS: "cliente", "prestador", "ambos", "Sr.", etc.
 * ACCEPTS ONLY: "clientes", "prestadores", "todos"
 */
export function isValidAudience(audience: unknown): audience is NotificationAudience {
  if (typeof audience !== 'string') return false;
  if (!audience || audience.trim() === '') return false;
  return (VALID_AUDIENCES as readonly string[]).includes(audience);
}

/**
 * CORE FILTER: Determines if a notification is visible based on REGISTERED profiles
 * 
 * Rules based on REGISTERED profiles (not active session):
 * - User with client profile → "clientes" and "todos"
 * - User with provider profile → "prestadores" and "todos"
 * - Provider is ALSO a client, so they see "clientes" too
 * - Admin → sees everything with valid audience
 * 
 * FAIL-SAFE: If audience is invalid, returns false (block notification)
 */
export function isNotificationVisibleToProfiles(
  audience: unknown,
  profiles: UserProfiles
): boolean {
  // FAIL-SAFE: Invalid audience = block notification (no exceptions)
  if (!isValidAudience(audience)) {
    if (audience !== null && audience !== undefined) {
      console.warn('[NotificationFilter] BLOCKED - Invalid audience value:', JSON.stringify(audience));
    }
    return false;
  }

  // Admin sees everything with valid audience
  if (profiles.isAdmin) {
    return true;
  }

  // "todos" is visible to everyone
  if (audience === 'todos') {
    return true;
  }

  // "clientes" - visible to clients AND providers (providers can also be clients)
  if (audience === 'clientes' && (profiles.isClient || profiles.isProvider)) {
    return true;
  }

  // "prestadores" - visible ONLY to providers
  if (audience === 'prestadores' && profiles.isProvider) {
    return true;
  }

  // Block all other cases
  return false;
}

/**
 * @deprecated Use isNotificationVisibleToProfiles instead
 * Kept for backwards compatibility during transition
 */
export function isNotificationVisibleToRole(
  audience: unknown,
  role: UserRole
): boolean {
  // Convert role to profiles for backwards compatibility
  const profiles: UserProfiles = {
    isClient: role === 'client',
    isProvider: role === 'provider',
    isAdmin: role === 'admin',
  };
  
  // Provider is also a client
  if (role === 'provider') {
    profiles.isClient = true;
  }
  
  return isNotificationVisibleToProfiles(audience, profiles);
}

/**
 * CENTRALIZED FILTER FUNCTION - Use this for all notification filtering
 * 
 * Filters an array of notifications to only include those visible to the user
 * based on their REGISTERED profiles (not active session).
 * 
 * @param notifications - Array of notifications with 'publico' field
 * @param profiles - User's registered profiles
 * @returns Filtered array of notifications
 */
export function filterNotificationsByProfiles<T extends { publico?: string | null }>(
  notifications: T[],
  profiles: UserProfiles
): T[] {
  if (!Array.isArray(notifications)) {
    console.error('[NotificationFilter] Invalid notifications array');
    return [];
  }

  const filtered = notifications.filter(notification => {
    const audience = notification.publico;
    return isNotificationVisibleToProfiles(audience, profiles);
  });

  // Log filtering results
  const blocked = notifications.length - filtered.length;
  if (blocked > 0) {
    const profileStr = `client=${profiles.isClient}, provider=${profiles.isProvider}, admin=${profiles.isAdmin}`;
    console.log(`[NotificationFilter] ${notifications.length} → ${filtered.length} (blocked ${blocked}) for profiles: ${profileStr}`);
  }

  return filtered;
}

/**
 * @deprecated Use filterNotificationsByProfiles instead
 * Kept for backwards compatibility
 */
export function filterNotificationsByAudience<T extends { publico?: string | null }>(
  notifications: T[],
  role: UserRole
): T[] {
  const profiles: UserProfiles = {
    isClient: role === 'client',
    isProvider: role === 'provider',
    isAdmin: role === 'admin',
  };
  
  // Provider is also a client
  if (role === 'provider') {
    profiles.isClient = true;
  }
  
  return filterNotificationsByProfiles(notifications, profiles);
}

/**
 * Filters notifications by expiration date
 * Notifications are excluded if expira_em is set and is in the past
 */
export function filterExpiredNotifications<T extends { expira_em?: string | null }>(
  notifications: T[],
  now: Date = new Date()
): T[] {
  const nowISO = now.toISOString();
  
  return notifications.filter(notification => {
    // No expiration = always visible
    if (!notification.expira_em) return true;
    
    // Check if not expired
    return notification.expira_em > nowISO;
  });
}

/**
 * COMPLETE NOTIFICATION PIPELINE - Apply all filters using REGISTERED profiles
 * 
 * Pipeline order:
 * 1. Filter by audience (profile-based) - MUST BE FIRST
 * 2. Filter by expiration
 * 3. Return filtered notifications
 * 
 * Use this function to ensure consistent filtering across the app.
 */
export function applyNotificationPipelineWithProfiles<T extends { publico?: string | null; expira_em?: string | null }>(
  notifications: T[],
  profiles: UserProfiles
): T[] {
  // Step 1: Filter by audience based on registered profiles
  const audienceFiltered = filterNotificationsByProfiles(notifications, profiles);
  
  // Step 2: Filter expired notifications
  const expirationFiltered = filterExpiredNotifications(audienceFiltered);
  
  return expirationFiltered;
}

/**
 * @deprecated Use applyNotificationPipelineWithProfiles instead
 * Kept for backwards compatibility
 */
export function applyNotificationPipeline<T extends { publico?: string | null; expira_em?: string | null }>(
  notifications: T[],
  role: UserRole
): T[] {
  // Step 1: Filter by audience (MUST be first - no exceptions)
  const audienceFiltered = filterNotificationsByAudience(notifications, role);
  
  // Step 2: Filter expired notifications
  const expirationFiltered = filterExpiredNotifications(audienceFiltered);
  
  return expirationFiltered;
}

/**
 * Validates a single notification for real-time/push events using REGISTERED profiles
 * Use this before adding any notification to state from external sources
 * 
 * Returns true if the notification should be added to state, false otherwise
 */
export function validateIncomingNotificationWithProfiles(
  notification: { publico?: string | null; expira_em?: string | null },
  profiles: UserProfiles
): boolean {
  // Check audience based on registered profiles FIRST
  if (!isNotificationVisibleToProfiles(notification.publico, profiles)) {
    return false;
  }
  
  // Check expiration
  if (notification.expira_em) {
    const now = new Date().toISOString();
    if (notification.expira_em <= now) {
      return false;
    }
  }
  
  return true;
}

/**
 * @deprecated Use validateIncomingNotificationWithProfiles instead
 * Kept for backwards compatibility
 */
export function validateIncomingNotification(
  notification: { publico?: string | null; expira_em?: string | null },
  role: UserRole
): boolean {
  // Check audience FIRST
  if (!isNotificationVisibleToRole(notification.publico, role)) {
    return false;
  }
  
  // Check expiration
  if (notification.expira_em) {
    const now = new Date().toISOString();
    if (notification.expira_em <= now) {
      return false;
    }
  }
  
  return true;
}

/**
 * Maps profile type from database to UserRole
 */
export function mapProfileToRole(
  perfilPrincipal: string | null | undefined,
  isAdmin: boolean
): UserRole {
  if (isAdmin) return 'admin';
  if (perfilPrincipal === 'provider') return 'provider';
  return 'client'; // Default to client for safety
}

/**
 * Returns the list of valid canonical audience values
 * Use this in admin forms for dropdown options
 */
export function getCanonicalAudienceValues(): readonly NotificationAudience[] {
  return VALID_AUDIENCES;
}
