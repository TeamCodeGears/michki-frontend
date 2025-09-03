let audio;
let enabled = true;

// 사용자 제스처 전에는 자동재생이 막힐 수 있으니, 최초 실패 시 enable 토글 안내 정도만.
export function setSoundEnabled(v) {
  enabled = !!v;
  try { localStorage.setItem("presenceSoundEnabled", enabled ? "1" : "0"); } catch {}
}

export function getSoundEnabled() {
  if (typeof enabled === "boolean") return enabled;
  try { return localStorage.getItem("presenceSoundEnabled") !== "0"; } catch {}
  return true;
}

export function initSound() {
  if (!audio) {
    audio = new Audio("/sounds/notification.mp3");
    audio.preload = "auto";
  }
}

export async function playJoinSound() {
  if (!enabled) return;
  try {
    initSound();
    // 같은 소리를 연속 재생할 때를 대비해 재시작
    audio.currentTime = 0;
    await audio.play();
  } catch (e) {
    // 자동재생 차단 등
    // 콘솔만 찍고 넘어감. 필요 시 UI에서 안내
    console.debug("sound play blocked:", e?.name || e);
  }
}
