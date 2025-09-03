import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./ScheduleCreationModal.css";
import { LanguageContext } from "../context/LanguageContext";
import { createPlan } from "../api/plans";

/**
 * props:
 * - isOpen: boolean
 * - onClose: () => void
 * - onCreated?: () => void
 * - destination?: { name, engName, image?, slideshowImages?, currency?, voltage? }
 * - imageMap?: Record<engName, string[]>
 * - size?: "sm" | "md" | "lg"   // 기본 md
 */
function ScheduleCreationModal({
  isOpen,
  onClose,
  onCreated,
  destination,
  imageMap,
  size = "md",
}) {
  // 단계: country -> destination -> form,    or   formSimple(플러스 버튼)
  const [modalStep, setModalStep] = useState("country");
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [finalDestination, setFinalDestination] = useState(null);

  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d;
  });
  const [tripTitle, setTripTitle] = useState("");

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const { texts } = useContext(LanguageContext);
  const navigate = useNavigate();

  // 사이즈 프리셋(모달 너비/오른쪽 폭을 CSS 변수로 전달)
  const SIZE_PRESET = {
    sm: { "--modal-w": "350px", "--right-w": "0px" }, // 플러스 버튼 전용
    md: { "--modal-w": "880px", "--right-w": "360px" },
    lg: { "--modal-w": "1100px", "--right-w": "420px" },
  };
  // 간단 폼은 오른쪽 패널 없음
  const sizeVars =
    modalStep === "formSimple"
      ? { "--modal-w": SIZE_PRESET[size]?.["--modal-w"] ?? "350px", "--right-w": "0px" }
      : SIZE_PRESET[size] ?? SIZE_PRESET.md;

  // 모달 열릴 때 초기화
  useEffect(() => {
    if (!isOpen) return;
    setTripTitle("");
    setCurrentImageIndex(0);

    if (destination) {
      setFinalDestination(destination);
      setModalStep("form");
    } else {
      setSelectedCountry(null);
      setFinalDestination(null);
      setModalStep("formSimple");
    }
  }, [isOpen, destination]);

  // 슬라이드
  useEffect(() => {
    if (!isOpen || modalStep !== "form") return;
    if (!finalDestination?.slideshowImages || finalDestination.slideshowImages.length <= 1) return;

    const t = setInterval(() => {
      setCurrentImageIndex((i) => (i + 1) % finalDestination.slideshowImages.length);
    }, 3000);
    return () => clearInterval(t);
  }, [isOpen, modalStep, finalDestination]);

  if (!isOpen) return null;

  const handleCountrySelect = (countryKey) => {
    setSelectedCountry(countryKey);
    setModalStep("destination");
  };

  const handleDestinationSelect = (dest) => {
    let slides = [];
    if (imageMap && imageMap[dest.engName]) slides = imageMap[dest.engName];
    else if (destination?.slideshowImages) slides = destination.slideshowImages;

    const picked = {
      ...dest,
      slideshowImages: slides,
      image: slides?.[0] ?? destination?.image ?? null,
    };
    setFinalDestination(picked);
    setModalStep("form");
  };

  // 생성
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tripTitle.trim()) {
      alert(texts.notSchedule);
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
        title: payload.title,
        startDate: payload.startDate,
        endDate: payload.endDate,
      };
      if (finalDestination?.name) statePayload.destination = finalDestination.name;
      if (planId) statePayload.planId = planId;

      if (planId) {
        navigate(`/schedule/${planId}`, { replace: false, state: statePayload });
      } else {
        navigate("/schedule", { replace: false, state: statePayload });
      }

      onClose?.();
    } catch (err) {
      console.error("create plan failed:", err);
      alert(err?.message ?? texts.failedCreate);
    }
  };

  // 오른쪽 패널
  const renderRightPanel = () => {
    if (modalStep === "formSimple") return null;

    switch (modalStep) {
      case "country":
        return (
          <div className="selection-panel">
            <div className="selection-item" onClick={() => handleCountrySelect("japan")}>
              {texts?.tabJapan || "일본"}
            </div>
            <div className="selection-item" onClick={() => handleCountrySelect("korea")}>
              {texts?.tabKorea || "한국"}
            </div>
          </div>
        );
      case "destination":
        return (
          <div className="selection-panel">
            {texts?.destinations?.[selectedCountry]?.map((dest) => (
              <div key={dest.name} className="selection-item" onClick={() => handleDestinationSelect(dest)}>
                {dest.name}
              </div>
            ))}
          </div>
        );
      case "form":
        return finalDestination ? (
          <div className="image-section">
            <div className="image-wrapper">
              {finalDestination.slideshowImages?.length ? (
                <img
                  src={finalDestination.slideshowImages[currentImageIndex]}
                  alt={finalDestination.name}
                  className="modal-image"
                />
              ) : finalDestination.image ? (
                <img src={finalDestination.image} alt={finalDestination.name} className="modal-image" />
              ) : (
                <div className="modal-image placeholder">No Image</div>
              )}

              {(finalDestination.currency || finalDestination.voltage) && (
                <div className="currency-info">
                  {finalDestination.currency && (
                    <span>{(texts?.CurrencyType || "화폐:")} {finalDestination.currency}</span>
                  )}
                  {finalDestination.voltage && (
                    <span style={{ marginLeft: 8 }}>
                      {(texts?.voltage || "전압:")} {finalDestination.voltage}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null;
      default:
        return null;
    }
  };

  // 왼쪽 폼
  const renderLeftForm = () => {
    if (modalStep === "formSimple") {
      return (
        <>
          <div className="form-group">
            <label>{texts?.scheduleName || "일정 이름"}</label>
            <input
              type="text"
              value={tripTitle}
              onChange={(e) => setTripTitle(e.target.value)}
              placeholder={texts.requestScheduleName}
              maxLength={50}
            />
          </div>

          <div className="form-group">
            <label>{texts?.schedule || "일정"}</label>
            <div className="date-picker-wrapper unified-width">
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

          <button type="submit" className="create-button">{texts?.create || "생성"}</button>
        </>
      );
    }

    return modalStep === "form" && finalDestination ? (
      <>
        <div className="form-group">
          <label>{texts?.travelDestination || "여행지"}</label>
          <input type="text" value={finalDestination.name} readOnly className="unified-width" />
        </div>

        <div className="form-group">
          <label>{texts?.scheduleName || "일정 이름"}</label>
          <input
            type="text"
            value={tripTitle}
            onChange={(e) => setTripTitle(e.target.value)}
            placeholder={texts.requestScheduleName}
            maxLength={50}
            className="unified-width"
          />
        </div>

        <div className="form-group">
          <label>{texts?.schedule || "일정"}</label>
          <div className="date-picker-wrapper unified-width">
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

        {/* 화폐/전압 표시는 오른쪽 이미지 아래로 이동했으므로 여기선 제거 */}

        <button type="submit" className="create-button">{texts?.create || "생성"}</button>
      </>
    ) : (
      <div className="form-placeholder">
        <p>{texts?.selectCountryAndCity || "나라와 여행지를 선택해주세요."}</p>
      </div>
    );
  };

  const contentClass = `modal-content ${modalStep === "formSimple" ? "create-only-modal" : ""}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={contentClass} style={sizeVars} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{texts?.scheduleCreate || "일정생성"}</h2>
          <button className="close-button" onClick={onClose} aria-label="닫기">×</button>
        </div>

        <div className="modal-body">
          <form className="schedule-form" onSubmit={handleSubmit}>
            {renderLeftForm()}
          </form>

          {renderRightPanel()}
        </div>
      </div>
    </div>
  );
}

export default ScheduleCreationModal;
