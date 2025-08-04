import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom'; // 🔸 페이지 이동용 훅
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './ScheduleCreationModal.css';
import { LanguageContext } from '../context/LanguageContext'; // 🔸 다국어 텍스트 불러오기

function ScheduleCreationModal({ isOpen, onClose, destination, imageMap }) {
  // 🔸 모달 단계: 나라 선택, 도시 선택, 일정 입력
  const [modalStep, setModalStep] = useState('country');
  const [selectedCountry, setSelectedCountry] = useState(null); // 선택한 나라
  const [finalDestination, setFinalDestination] = useState(null); // 최종 도시
  const [startDate, setStartDate] = useState(new Date()); // 출발일
  const [endDate, setEndDate] = useState(new Date());     // 도착일
  const [currentImageIndex, setCurrentImageIndex] = useState(0); // 이미지 슬라이드 인덱스
  const [tripTitle, setTripTitle] = useState(""); // ⭐ 일정 이름 상태 추가

  const { texts } = useContext(LanguageContext); // 다국어 텍스트
  const navigate = useNavigate(); // 🔸 페이지 이동 함수

  // 🔹 모달이 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      if (destination) {
        setFinalDestination(destination); // 카드 클릭 시
        setModalStep('form');
      } else {
        // + 버튼 클릭 시
        setModalStep('country');
        setSelectedCountry(null);
        setFinalDestination(null);
      }
      setTripTitle(""); // ⭐ 일정 이름도 초기화
    }
  }, [isOpen, destination]);

  // 🔹 슬라이드 이미지 타이머
  useEffect(() => {
    if (
      isOpen &&
      modalStep === 'form' &&
      finalDestination?.slideshowImages?.length > 1
    ) {
      const intervalId = setInterval(() => {
        setCurrentImageIndex((prevIndex) =>
          (prevIndex + 1) % finalDestination.slideshowImages.length
        );
      }, 3000);
      return () => clearInterval(intervalId);
    }
  }, [isOpen, modalStep, finalDestination]);

  if (!isOpen) return null; // 🔸 닫힌 상태면 렌더링 안함

  // 🔸 나라 선택
  const handleCountrySelect = (country) => {
    setSelectedCountry(country);
    setModalStep('destination');
  };

  // 🔸 도시 선택
  const handleDestinationSelect = (dest) => {
    const destinationWithImages = {
      ...dest,
      image: imageMap[dest.engName][0],
      slideshowImages: imageMap[dest.engName],
    };
    setFinalDestination(destinationWithImages);
    setModalStep('form');
  };

  // 🔸 생성 버튼 클릭 시 실행
  const handleSubmit = (event) => {
    event.preventDefault();
    if (!finalDestination || !tripTitle) {
      alert('일정 이름을 입력해 주세요.');
      return;
    }
    navigate('/schedule', {
      state: {
        destination: finalDestination.name,
        title: tripTitle,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    });
    onClose();
  };

  // 🔸 오른쪽 패널 (나라, 도시, 이미지)
  const renderRightPanel = () => {
    switch (modalStep) {
      case 'country':
        return (
          <div className="selection-panel">
            <div
              className="selection-item"
              onClick={() => handleCountrySelect('japan')}
            >
              {texts.tabJapan}
            </div>
            <div
              className="selection-item"
              onClick={() => handleCountrySelect('korea')}
            >
              {texts.tabKorea}
            </div>
          </div>
        );
      case 'destination':
        return (
          <div className="selection-panel">
            {texts.destinations[selectedCountry].map((dest) => (
              <div
                key={dest.name}
                className="selection-item"
                onClick={() => handleDestinationSelect(dest)}
              >
                {dest.name}
              </div>
            ))}
          </div>
        );
      case 'form':
        return finalDestination ? (
          <div className="image-section">
            <img
              src={finalDestination.slideshowImages[currentImageIndex]}
              alt={finalDestination.name}
              className="modal-image"
            />
          </div>
        ) : null;
      default:
        return null;
    }
  };

  // 🔸 렌더링
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>일정 생성</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <form className="schedule-form" onSubmit={handleSubmit}>
            {modalStep === 'form' && finalDestination ? (
              <>
                <div className="form-group">
                  <label>여행지</label>
                  <input type="text" value={finalDestination.name} readOnly />
                </div>
                <div className="form-group">
                  <label>일정 이름</label>
                  <input
                    type="text"
                    value={tripTitle}
                    onChange={e => setTripTitle(e.target.value)}
                    placeholder={`예: ${finalDestination.name} 3박 4일`}
                  />
                </div>
                <div className="form-group">
                  <label>일정</label>
                  <div className="date-picker-wrapper">
                    <DatePicker
                      selected={startDate}
                      onChange={(date) => setStartDate(date)}
                    />
                    <span>~</span>
                    <DatePicker
                      selected={endDate}
                      onChange={(date) => setEndDate(date)}
                    />
                  </div>
                </div>
                <div className="info-section">
                  <span>화폐: {finalDestination.currency}</span>
                  <span>전압: {finalDestination.voltage}</span>
                </div>
                <button type="submit" className="create-button">
                  생성
                </button>
              </>
            ) : (
              <div className="form-placeholder">
                <p>나라와 여행지를 선택해주세요.</p>
              </div>
            )}
          </form>
          {renderRightPanel()}
        </div>
      </div>
    </div>
  );
}

export default ScheduleCreationModal;
