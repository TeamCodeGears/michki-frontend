import React, { useState } from "react";

export default function AvatarRing({ picture, name, color = "#4caf50" }) {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = (name?.[0] || "U").toUpperCase();

  return (
    <div
      style={{
        position: "relative", // 자식 absolute 배치 기준
        width: 50,
        height: 50,
      }}
    >
      {/* 링 (테두리 원형) */}
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          border: `4px solid ${color}`,
          boxSizing: "border-box",
        }}
      ></div>

      {/* 이미지 or 이니셜 (링 위에 덮기) */}
      {picture && !imgFailed ? (
        <img
          src={picture}
          alt={name || "avatar"}
          onError={() => setImgFailed(true)}
          style={{
            position: "absolute",
            inset: 0, // top, right, bottom, left = 0
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            objectFit: "cover",
            zIndex: 1, // 링 위로
          }}
        />
      ) : (
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            color: "#555",
            zIndex: 1,
          }}
        >
          {initial}
        </span>
      )}
    </div>
  );
}
