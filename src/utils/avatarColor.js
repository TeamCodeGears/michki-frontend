const KEY = (planId) => `avatarBorderColor:${planId ?? "global"}`;

export function setAvatarBorderColor(planId, color) {
  try {
    const key = KEY(planId);
    if (color) localStorage.setItem(key, color);
    else localStorage.removeItem(key);
  } catch {}
}

export function getAvatarBorderColor(planId) {
  try {
    return localStorage.getItem(KEY(planId));
  } catch {
    return null;
  }
}
