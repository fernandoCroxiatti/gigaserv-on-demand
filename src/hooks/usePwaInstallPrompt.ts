import { useCallback, useEffect, useMemo, useState } from "react";

// Minimal typing for the beforeinstallprompt event (not in standard TS lib)
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandaloneDisplayMode(): boolean {
  // iOS uses navigator.standalone; others use matchMedia
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navAny = navigator as any;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    navAny?.standalone === true
  );
}

export function usePwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState<boolean>(() => {
    try {
      return isStandaloneDisplayMode();
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Chrome requires preventDefault to show a custom prompt
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Keep standalone in sync
    const media = window.matchMedia?.("(display-mode: standalone)");
    const handleMediaChange = () => setStandalone(isStandaloneDisplayMode());
    media?.addEventListener?.("change", handleMediaChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      media?.removeEventListener?.("change", handleMediaChange);
    };
  }, []);

  const canPrompt = useMemo(() => !!deferredPrompt, [deferredPrompt]);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return { outcome: "dismissed" as const };

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    // Clear prompt so it can't be reused
    setDeferredPrompt(null);

    return choice;
  }, [deferredPrompt]);

  return { canPrompt, promptInstall, standalone };
}
