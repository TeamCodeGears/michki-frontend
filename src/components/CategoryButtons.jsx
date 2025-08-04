import React from "react";

function CategoryButtons({ categories, activeCategory, onClick }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        padding: "16px 0 10px 20px",
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        minHeight: 60,
        alignItems: "center",
      }}
    >
      {categories.map(cat => (
        <button
          key={cat.type}
          onClick={() => onClick(cat.type)}
          style={{
            border: "none",
            outline: "none",
            background: activeCategory === cat.type ? "#fffbe5" : "#fff",
            color: "#222",
            borderRadius: 22,
            padding: "8px 18px 8px 12px",
            boxShadow: "0 1px 8px #0002",
            fontSize: 15,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 7,
            cursor: "pointer",
            transition: "background 0.2s",
          }}
        >
          <span style={{ fontSize: 19, marginRight: 2 }}>{cat.icon}</span>{" "}
          {cat.label}
        </button>
      ))}
    </div>
  );
}

export default CategoryButtons;
