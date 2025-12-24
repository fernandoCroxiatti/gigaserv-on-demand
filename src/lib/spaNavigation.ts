// SPA-safe navigation without full reloads.
// Works even outside React components (e.g., native push handlers).

export function spaNavigate(to: string, options?: { replace?: boolean }) {
  if (typeof window === 'undefined') return;

  try {
    const replace = options?.replace === true;
    if (replace) {
      window.history.replaceState({}, '', to);
    } else {
      window.history.pushState({}, '', to);
    }

    // Let react-router know the location changed
    window.dispatchEvent(new PopStateEvent('popstate'));
  } catch (err) {
    console.warn('[spaNavigate] Failed to navigate:', err);
  }
}
