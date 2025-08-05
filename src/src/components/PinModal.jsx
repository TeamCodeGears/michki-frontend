import React from "react";

function PinModal({ pin, open, onClose, onCommentChange }) {
  if (!open || !pin) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          minWidth: 400,
          minHeight: 320,
          background: "#fff",
          borderRadius: 24,
          boxShadow: "0 4px 24px #0005",
          padding: 32,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            border: "none",
            background: "transparent",
            fontSize: 24,
            cursor: "pointer",
          }}
        >
          ×
        </button>
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 10 }}>
          {pin.name}
        </div>
        <img
          src={pin.photo || "https://via.placeholder.com/200x120?text=No+Image"}
          alt=""
          style={{ width: 200, borderRadius: 12, marginBottom: 12 }}
        />
        <textarea
          value={pin.comment}
          onChange={e => onCommentChange(e.target.value)}
          placeholder="여기에 메모나 일정을 입력하세요!"
          style={{
            width: "100%",
            minHeight: 80,
            border: "1px solid #ccc",
            borderRadius: 8,
            padding: 10,
          }}
        />
      </div>
    </div>
  );
}

export default PinModal;
