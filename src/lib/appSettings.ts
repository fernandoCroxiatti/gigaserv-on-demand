import { supabase } from "@/integrations/supabase/client";

/**
 * App settings helpers.
 * NOTE: `app_settings.value` is stored as JSON, so it may be:
 * - number (e.g. 10)
 * - string (e.g. "10")
 * - object (e.g. { value: 10 })
 */
export function parseSettingNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }

  if (typeof raw === "string") {
    const cleaned = raw.trim().replace("%", "").replace(",", ".");
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  }

  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if ("value" in obj) return parseSettingNumber(obj.value);
  }

  return null;
}

export async function getAppCommissionPercentage(): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "app_commission_percentage")
      .single();

    if (error) throw error;

    const parsed = parseSettingNumber(data?.value);
    if (parsed === null) return null;
    if (parsed < 0 || parsed > 100) return null;

    return parsed;
  } catch (err) {
    console.error("[AppSettings] Failed to load app_commission_percentage:", err);
    return null;
  }
}
