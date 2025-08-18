import { useState } from "react";

export default function YearSelector({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const year = value ?? new Date().getFullYear();

  const setYear = (y) => {
    onChange?.(y);
    setOpen(false);
  };

  return (
    <div className="year-selector" style={{ userSelect: "none" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #ddd",
          background: "transparent",
          color: "#FAF5EB",
          fontSize: 20,
          cursor: "pointer",
        }}
      >
        {year} ▼
      </button>

      {open && (
        <div
          style={{
            marginTop: 8,
            background: "#fff",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {[year - 1, year, year + 1].map((y) => (
            <div
              key={y}
              onClick={() => setYear(y)}
              style={{
                padding: "10px 12px",
                cursor: "pointer",
                borderBottom: "1px solid #eee",
                color: "#333",
                background: y === year ? "#f5f5f5" : "#fff",
              }}
            >
              {y}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
