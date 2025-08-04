import React from "react";

function SortablePin({
  pin,
  index,
  onClick,
  onDelete,
  listeners,
  attributes,
  setNodeRef,
  style,
  isDragging,
}) {
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        display: "flex",
        alignItems: "center",
        background: isDragging ? "#f0d8a8" : "#FAF5EB",
        color: "#333",
        marginBottom: 10,
        borderRadius: 14,
        padding: 10,
        cursor: "pointer",
        boxShadow: "0 2px 8px #0002",
        position: "relative",
        minHeight: 70,
        opacity: isDragging ? 0.6 : 1,
        ...style,
      }}
      onClick={onClick}
    >
      <div
        style={{
          width: 60,
          height: 60,
          background: "#eee",
          borderRadius: 12,
          backgroundImage: pin.photo ? `url(${pin.photo})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          marginRight: 10,
        }}
      ></div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{pin.name}</div>
        <div style={{ fontSize: 13, color: "#888" }}>
          {pin.comment || "메모 없음"}
        </div>
      </div>
      <button
        onClick={e => {
          e.stopPropagation();
          onDelete();
        }}
        style={{
          position: "absolute",
          top: 2,
          right: 12,
          width: 10,
          height: 10,
          padding: 0,
          background: "none",
          border: "none",
          color: "#222",
          fontSize: 19,
          cursor: "pointer",
          fontWeight: 700,
          lineHeight: 1,
        }}
        title="삭제"
      >
        ×
      </button>
      <div
        style={{
          position: "absolute",
          right: 10,
          bottom: 10,
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "#f0d8a8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 600,
          fontSize: 18,
          zIndex: 1,
        }}
      >
        {index + 1}
      </div>
    </div>
  );
}

export default SortablePin;
