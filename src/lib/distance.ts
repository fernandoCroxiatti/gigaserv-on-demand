/**
 * Calculate distance between two coordinates using the Haversine formula
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if a chamado is within a provider's radar range
 */
export function isChamadoWithinRange(
  providerLat: number | null,
  providerLng: number | null,
  chamadoLat: number,
  chamadoLng: number,
  radarRange: number
): boolean {
  if (!providerLat || !providerLng) {
    console.log('[Distance] Provider location not available');
    return false;
  }
  
  const distance = calculateDistance(providerLat, providerLng, chamadoLat, chamadoLng);
  const isWithin = distance <= radarRange;
  
  console.log(`[Distance] Provider (${providerLat}, ${providerLng}) to Chamado (${chamadoLat}, ${chamadoLng}): ${distance}km, Radar: ${radarRange}km, Within: ${isWithin}`);
  
  return isWithin;
}
