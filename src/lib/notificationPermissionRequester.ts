export type NotificationPermissionRequester = () => Promise<boolean>;

let requester: NotificationPermissionRequester | null = null;

export function setNotificationPermissionRequester(fn: NotificationPermissionRequester | null) {
  requester = fn;
}

/**
 * Used by the login flow to request permission via the already-mounted notifications hook.
 * Returns:
 * - true/false when the requester exists
 * - null when notifications system isn't mounted yet
 */
export async function requestNotificationPermissionFromLogin(): Promise<boolean | null> {
  if (!requester) return null;
  return requester();
}
