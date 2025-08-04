import React from "react";
import { OverlayView } from "@react-google-maps/api";

function CustomInfoWindow({ position, info, onClose, onAddPin, texts }) {
  if (!position || !info) return null;

  return (
    <OverlayView
      position={position}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
      <div
        style={{
          position: "relative",
          background: "#fffdf5",
          borderRadius: 18,
          boxShadow: "0 2px 16px #0002",
          padding: 18,
          minWidth: 260,
          maxWidth: 350,
          fontFamily: "Pretendard, Noto Sans KR, Arial, sans-serif",
        }}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 2, right: 20,
          width: 10,
          height: 10,
          padding: 0,
            background: "none",
            border: "none",
            fontSize: 22,
            color: "#222",
            cursor: "pointer",
            zIndex: 2,
            fontWeight: 700,
          }}
          aria-label="닫기"
        >
          ×
        </button>

        {/* 사진 */}
        {info.photo && (
          <img
            src={info.photo}
            alt={info.name}
            style={{
              width: "100%",
              height: 130,
              objectFit: "cover",
              borderRadius: 10,
              marginTop: 17,
              marginBottom: 12,
              background: "#eee",
            }}
          />
        )}

        {/* 장소명 */}
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 6, color: "#222" }}>
          {info.name}
        </div>
        {/* 평점 */}
        {info.rating && (
          <div style={{ color: "#d23", fontWeight: 600, marginBottom: 3 }}>
            ⭐ {info.rating}
            <span style={{ color: "#666", fontWeight: 400, marginLeft: 7 }}>
              ({info.user_ratings_total}건)
            </span>
          </div>
        )}
        {/* 주소 */}
        {info.address && (
          <div style={{
            fontSize: 14, color: "#555", marginBottom: 2,
            whiteSpace: "pre-line"
          }}>{info.address}</div>
        )}
        {/* 전화번호 */}
        {info.phone && (
          <div style={{ fontSize: 14, color: "#555", marginBottom: 2 }}>
            <a
              href={`tel:${info.phone}`}
              style={{ color: "#1769aa", textDecoration: "underline" }}
            >
              {info.phone}
            </a>
          </div>
        )}
        {/* 핀찍기 버튼 */}
        {onAddPin && (
          <button
            onClick={onAddPin}
            style={{
              background: "#f0d8a8",
              border: "none",
              borderRadius: 9,
              padding: "8px 25px",
              cursor: "pointer",
              fontWeight: 600,
              marginTop: 13,
              fontSize: 16,
              color: "#222",
            }}
          >
            {texts?.addPin || "핀찍기"}
          </button>
        )}
      </div>
    </OverlayView>
  );
}

export default CustomInfoWindow;
