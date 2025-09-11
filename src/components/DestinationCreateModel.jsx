import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./ScheduleCreationModal.css";
import { LanguageContext } from "../context/LanguageContext";
import { createPlan } from "../api/plans";

function DestinationCreateModal({ isOpen, onClose, onCreated, destination, imageMap }) {
  const { texts } = useContext(LanguageContext);
  const navigate = useNavigate();

  const [tripTitle, setTripTitle] = useState("");
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d;
  });

  const [slides, setSlides] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setTripTitle("");
    setCurrentIdx(0);

    // 이미지 슬라이드 구성 (있으면만)
    if (destination?.slideshowImages?.length) {
      setSlides(destination.slideshowImages);
    } else if (destination?.engName && imageMap?.[destination.engName]?.length) {
      setSlides(imageMap[destination.engName]);
    } else if (destination?.image) {
      setSlides([destination.image]);
    } else {
      setSlides([]);
    }
  }, [isOpen, destination, imageMap]);

  useEffect(() => {
    if (!isOpen || slides.length <= 1) return;
    const t = setInterval(() => setCurrentIdx((i) => (i + 1) % slides.length), 3000);
    return () => clearInterval(t);
  }, [isOpen, slides]);

  if (!isOpen || !destination) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tripTitle.trim()) {
      alert("일정 이름을 입력하세요.");
      return;
    }
    try {
      const payload = {
        title: tripTitle.trim(),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };
      const created = await createPlan(payload);
      const planId = created?.planId;

      if (typeof onCreated === "function") {
        try { await onCreated(); } catch {}
      }

      const statePayload = {
        destination: destination.name,
        title: payload.title,
        startDate: payload.startDate,
        endDate: payload.endDate,
      };
      if (planId) statePayload.planId = planId;

      if (planId) navigate(`/schedule/${planId}`, { state: statePayload });
      else navigate("/schedule", { state: statePayload });

      onClose?.();
    } catch (err) {
      console.error("create plan failed:", err);
      alert(err?.message ?? "생성에 실패했습니다.");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content modal-content--dest"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{texts?.scheduleCreate || "일정 생성"}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* 왼쪽 폼 */}
          <form className="schedule-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>{texts?.travelDestination || "여행지"}</label>
              <input type="text" value={destination.name} readOnly />
            </div>

            <div className="form-group">
              <label>{texts?.scheduleName || "일정 이름"}</label>
              <input
                type="text"
                value={tripTitle}
                onChange={(e) => setTripTitle(e.target.value)}
                placeholder="일정 이름을 입력하세요."
                maxLength={50}
              />
            </div>

            <div className="form-group">
              <label>{texts?.schedule || "일정"}</label>
              <div className="date-picker-wrapper">
                <DatePicker
                  selected={startDate}
                  onChange={(date) => date && setStartDate(date)}
                  dateFormat="yyyy.MM.dd"
                />
                <span>~</span>
                <DatePicker
                  selected={endDate}
                  onChange={(date) => date && setEndDate(date)}
                  dateFormat="yyyy.MM.dd"
                  minDate={startDate}
                />
              </div>
            </div>

            {(destination.currency || destination.voltage) && (
              <div className="info-section">
                {destination.currency && (
                  <span>{(texts?.CurrencyType || "화폐:")} {destination.currency}</span>
                )}
                {destination.voltage && (
                  <span> {(texts?.voltage || "전압:")} {destination.voltage}</span>
                )}
              </div>
            )}

            <button type="submit" className="create-button">
              {texts?.create || "생성"}
            </button>
          </form>

          {/* 오른쪽 이미지 패널 */}
          <div className="image-section">
            {slides.length ? (
              <img src={slides[currentIdx]} alt={destination.name} className="modal-image" />
            ) : (
              <div className="modal-image placeholder">No Image</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DestinationCreateModal;
