import { useState, useEffect, useContext } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './ScheduleCreationModal.css';
import { LanguageContext } from '../context/LanguageContext';
import { getDaysArr } from '../utils/useDaysArray';
import { useNavigate } from 'react-router-dom';

function ScheduleCreationModal({ isOpen, onClose, destination, imageMap }) {
  // 모달의 현재 단계를 기억할 state ('country', 'destination', 'form')
  const [modalStep, setModalStep] = useState('country'); // 사용자가 선택한 나라를 기억할 state
  const [selectedCountry, setSelectedCountry] = useState(null);// 사용자가 최종 선택한 여행지 정보를 기억할 state
  const [finalDestination, setFinalDestination] = useState(null);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { texts } = useContext(LanguageContext); // 전체 텍스트 데이터 불러오기
  const navigate = useNavigate();

  // 모달이 열릴 때마다 내부 상태를 초기화하는 로직
  useEffect(() => {
    if (isOpen) { 
      if (destination) { // 여행지 카드를 클릭해서 열린 경우
        setFinalDestination(destination);
        setModalStep('form');
      } else { // + 버튼을 눌러서 열린 경우
        setModalStep('country');
        setSelectedCountry(null);
        setFinalDestination(null);
      }
      setCurrentImageIndex(0); // 이미지 인덱스 초기화
    }
  }, [isOpen, destination]);

  // 슬라이드쇼 로직
  useEffect(() => {
    if (isOpen && modalStep === 'form' && finalDestination?.slideshowImages?.length > 1) {
      const intervalId = setInterval(() => {
        setCurrentImageIndex(prevIndex => (prevIndex + 1) % finalDestination.slideshowImages.length);
      }, 3000);
      return () => clearInterval(intervalId);
    }
  }, [isOpen, modalStep, finalDestination]);

  // 모달창 생성된 후, 뒷 배경 안 움직이게 락!
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;


  // --- 이벤트 핸들러 ---
  const handleCountrySelect = (country) => {
    setSelectedCountry(country);
    setModalStep('destination');
  };

  const handleDestinationSelect = (dest) => {
    const desinationWithImages = {
      ...dest, 
       image: imageMap[dest.engName][0], // 대표 이미지
      slideshowImages: imageMap[dest.engName], // 슬라이드쇼 이미지
    }
    setFinalDestination(desinationWithImages);
    setModalStep('form');
  };

  const handleSubmit = (event) => {
    event.preventDefault(); // 새로 고침 동장 안되게 하는거
    
    const tripDays = getDaysArr(startDate, endDate);
    console.log("선택된 여행 기간 : ", tripDays);
    
    const scheduleData = {
      destination: finalDestination.name,
      startDate: startDate,
      endDate: endDate,
      // 일정 이름 등 다른 폼 데이터 추가
    };
    console.log("Creating schedule with:", scheduleData);
    // 여기에 백엔드로 데이터를 전송하는 로직을 추가할 수 있습니다.
    onClose();
    navigate('/schedule/new')
  };

  // --- 각 단계별로 보여줄 오른쪽 콘텐츠를 렌더링하는 함수 ---
  const renderRightPanel = () => {
    switch (modalStep) {
      case 'country':
        return (
          <div className="selection-panel">
            <div className="selection-item" onClick={() => handleCountrySelect('japan')}>{texts.tabJapan}</div>
            <div className="selection-item" onClick={() => handleCountrySelect('korea')}>{texts.tabKorea}</div>
          </div>
        );
      case 'destination':
        return (
          <div className="selection-panel">
            {texts.destinations[selectedCountry].map(dest => (
              <div key={dest.name} className="selection-item" onClick={() => handleDestinationSelect(dest)}>
                {dest.name}
              </div>
            ))}
          </div>
        );
      case 'form':
        if (!finalDestination) return null;
        return (
          <div className="image-section">
            <img 
              src={finalDestination.slideshowImages[currentImageIndex]} 
              alt={finalDestination.name} 
              className="modal-image" 
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>일정 생성</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <form className="schedule-form" onSubmit={handleSubmit}>
            {/* 최종 단계에서만 폼 내용이 보이도록 설정 */}
            {modalStep === 'form' && finalDestination ? (
              <>
                <div className="form-group">
                  <label>여행지</label>
                  <input type="text" value={finalDestination.name} readOnly />
                </div>
                <div className="form-group">
                  <label>일정 이름</label>
                  <input type="text" placeholder={`예: ${finalDestination.name} 3박 4일`} />
                </div>
                <div className="form-group">
                  <label>일정</label>
                  <div className="date-picker-wrapper">
                    <DatePicker selected={startDate} onChange={(date) => setStartDate(date)} />
                    <span>~</span>
                    <DatePicker selected={endDate} onChange={(date) => setEndDate(date)} />
                  </div>
                </div>
                <div className="info-section">
                  <span>화폐: {finalDestination.currency}</span>
                  <span>전압: {finalDestination.voltage}</span>
                </div>
                <button type="submit" className="create-button">생성</button>
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