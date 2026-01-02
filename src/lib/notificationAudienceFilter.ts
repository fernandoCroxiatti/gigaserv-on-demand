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
 * CORE FILTER: Determines if a notification is visible to a specific role
 * 
 * Rules:
 * - client → audience === "clientes" OR audience === "todos"
 * - provider → audience === "prestadores" OR audience === "todos"
 * - admin → sees everything with valid audience
 * 
 * FAIL-SAFE: If audience is invalid, returns false (block notification)
 * NO FALLBACK: Invalid values are silently discarded
 * NO CONVERSION: "cliente" does NOT become "clientes"
 */
export function isNotificationVisibleToRole(
  audience: unknown,
  role: UserRole
): boolean {
  // FAIL-SAFE: Invalid audience = block notification (no exceptions)
  if (!isValidAudience(audience)) {
    if (audience !== null && audience !== undefined) {
      console.warn('[NotificationFilter] BLOCKED - Invalid audience value:', JSON.stringify(audience));
    }
    return false;
  }

  // Admin sees everything with valid audience
  if (role === 'admin') {
    return true;
  }

  // "todos" is visible to everyone
  if (audience === 'todos') {
    return true;
  }

  // Client can only see "clientes" notifications
  if (role === 'client' && audience === 'clientes') {
    return true;
  }

  // Provider can only see "prestadores" notifications
  if (role === 'provider' && audience === 'prestadores') {
    return true;
  }

  // Block all other cases
  return false;
}

/**
 * CENTRALIZED FILTER FUNCTION - Use this for all notification filtering
 * 
 * Filters an array of notifications to only include those visible to the given role.
 * This is the SINGLE SOURCE OF TRUTH for audience filtering.
 * 
 * @param notifications - Array of notifications with 'publico' field
 * @param role - User role ('client', 'provider', 'admin')
 * @returns Filtered array of notifications
 */
export function filterNotificationsByAudience<T extends { publico?: string | null }>(
  notifications: T[],
  role: UserRole
): T[] {
  if (!Array.isArray(notifications)) {
    console.error('[NotificationFilter] Invalid notifications array');
    return [];
  }

  const filtered = notifications.filter(notification => {
    const audience = notification.publico;
    return isNotificationVisibleToRole(audience, role);
  });

  // Log filtering results
  const blocked = notifications.length - filtered.length;
  if (blocked > 0) {
    console.log(`[NotificationFilter] ${notifications.length} → ${filtered.length} (blocked ${blocked}) for role: ${role}`);
  }

  return filtered;
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
 * COMPLETE NOTIFICATION PIPELINE - Apply all filters in correct order
 * 
 * Pipeline order:
 * 1. Filter by audience (role-based) - MUST BE FIRST
 * 2. Filter by expiration
 * 3. Return filtered notifications
 * 
 * Use this function to ensure consistent filtering across the app.
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
 * Validates a single notification for real-time/push events
 * Use this before adding any notification to state from external sources
 * 
 * Returns true if the notification should be added to state, false otherwise
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
