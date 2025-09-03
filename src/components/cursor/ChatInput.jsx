import React from "react";

export default function ChatInput({
  open,
  left,
  top,
  value,
  onChange,
  onEnter,                 // ← Enter 처리 콜백
  onEscape,                // ← Escape 처리 콜백
  onCompositionStart,      // ← IME 시작
  onCompositionEnd,        // ← IME 종료
}) {
  if (!open) return null;

  const safe = (fn) => (typeof fn === "function" ? fn : () => {});

  return (
    <div
      className="cursor-chat-input"
      style={{ left, top }}
      role="dialog"
      aria-label="채팅 입력"
    >
      <input
        autoFocus
        value={value ?? ""}
        onChange={(e) => safe(onChange)(e.target.value)}
        onCompositionStart={() => safe(onCompositionStart)()}
        onCompositionEnd={() => safe(onCompositionEnd)()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (e.isComposing) return;  // IME 입력 중이면 전송 금지
            e.preventDefault();
            safe(onEnter)(e);
          }
          if (e.key === "Escape") {
            e.preventDefault();
            safe(onEscape)(e);
          }
        }}
        placeholder="메시지 입력 후 Enter"
        aria-label="채팅 메시지 입력"
      />
    </div>
  );
}
