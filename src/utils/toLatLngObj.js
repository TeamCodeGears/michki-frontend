export default function toLatLngObj(pos) {
  if (!pos) return null;
  if (typeof pos.lat === "function" && typeof pos.lng === "function") {
    return { lat: pos.lat(), lng: pos.lng() };
  }
  return pos;
}
