// /src/utils/jwt.js
function base64UrlToUint8Array(base64Url) {
  const pad = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64); // binary string (each char = byte)
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function decodeJwt(token) {
  try {
    const payloadB64Url = token.split('.')[1];
    const bytes = base64UrlToUint8Array(payloadB64Url);
    const json = new TextDecoder('utf-8').decode(bytes); // ✅ UTF-8로 복원
    return JSON.parse(json);
  } catch {
    return {};
  }
}
