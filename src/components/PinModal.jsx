import React from "react";

function PinModal({ pin, open, onClose, onCommentChange }) {
  if (!open || !pin) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0,
        width: "100vw", height: "100vh",
        background: "rgba(0,0,0,0.27)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "auto",
      }}
      onClick={onClose} // 바깥 클릭시 닫기
    >
      <div
        style={{
          minWidth: 320,
          maxWidth: 420,
          width: "92vw",
          background: "#FAF5EB",
          borderRadius: 22,
          boxShadow: "0 8px 38px #0003",
          padding: "32px 26px 20px 26px",
          display: "flex",
          flexDirection: "column",
          gap: 22,
          position: "relative",
          pointerEvents: "auto", // 내부 클릭시 닫기 방지
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 0, right: 21,
          width: 10,
          height: 10,
          padding: 0,
            background: "none",
            border: "none",
            fontSize: 27,
            color: "#222",
            cursor: "pointer",
            zIndex: 2,
            fontWeight: 700,
          }}
          aria-label="닫기"
        >
          ×
        </button>

        {/* 상단 이미지 */}
        <img
          src={pin.photo || "https://via.placeholder.com/330x170?text=No+Image"}
          alt={pin.name || "사진"}
          style={{
            width: "100%",
            height: 170,
            objectFit: "cover",
            borderRadius: 16,
            marginBottom: 7,
            background: "#eaeaea",
          }}
        />

        {/* 장소명 */}
        <div
          style={{
            fontWeight: 700,
            fontSize: 21,
            margin: "4px 0 0 0",
            color: "#232323",
            letterSpacing: "-0.2px",
            lineHeight: 1.23,
            textAlign: "left",
            wordBreak: "break-all",
          }}
        >
          {pin.name || "이름 없음"}
        </div>

        {/* 메모 입력란 */}
        <textarea
          value={pin.comment || ""}
          onChange={e => onCommentChange(e.target.value)}
          placeholder="여기에 메모나 일정을 입력하세요!"
          style={{
            width: "100%",
            minHeight: 82,
            background: "#404040",
            color: "#fff",
            border: "none",
            borderRadius: 13,
            padding: "16px 18px",
            fontSize: 17,
            fontFamily: "inherit",
            marginTop: 7,
            resize: "vertical",
            boxSizing: "border-box",
            outline: "none",
          }}
        />
      </div>
    </div>
  );
}

export default PinModal;
