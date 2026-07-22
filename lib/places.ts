export type Place = { name: string; lat: number; lng: number };
export const BKK_PLACES: Record<string, Place> = {
  "สยาม":        { name: "สยาม", lat: 13.7460, lng: 100.5340 },
  "อโศก":        { name: "อโศก", lat: 13.7370, lng: 100.5600 },
  "สีลม":        { name: "สีลม", lat: 13.7250, lng: 100.5340 },
  "ลาดพร้าว":     { name: "ลาดพร้าว", lat: 13.8160, lng: 100.5610 },
  "บางนา":       { name: "บางนา", lat: 13.6680, lng: 100.6040 },
  "ทองหล่อ":      { name: "ทองหล่อ", lat: 13.7330, lng: 100.5790 },
  "จตุจักร":      { name: "จตุจักร", lat: 13.7990, lng: 100.5500 },
  "อารีย์":       { name: "อารีย์", lat: 13.7790, lng: 100.5440 },
  "ประสานมิตร":   { name: "ประสานมิตร", lat: 13.7447, lng: 100.5650 },
};
export const BKK_CENTER = { lat: 13.7460, lng: 100.5340 };

// crude haversine→minutes estimate (urban ~20km/h avg). Fallback when Claude omits travel.
export function estimateTravelMin(a: Place, b: Place): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
  const km = 2 * R * Math.asin(Math.sqrt(h));
  return Math.max(5, Math.round((km / 20) * 60));
}
export function resolvePlace(label: string): Place | undefined {
  const hit = Object.keys(BKK_PLACES).find(k => label.includes(k));
  return hit ? BKK_PLACES[hit] : undefined;
}
