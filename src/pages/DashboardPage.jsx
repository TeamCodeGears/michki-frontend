import { useState, useContext } from 'react';
import './DashboardPage.css';
import YearSelector from '../components/YearSelector';
import ScheduleCreationModal from '../components/ScheduleCreationModal';
import { LanguageContext } from '../context/LanguageContext';

// 이미지 임포트
import osakaImage1 from '../assets/Osaka1.jpg';
import osakaImage2 from '../assets/Osaka2.jpg';
import osakaImage3 from '../assets/Osaka3.jpg';
import seoulImage1 from '../assets/Seoul1.jpg';
import seoulImage2 from '../assets/Seoul2.jpg';
import seoulImage3 from '../assets/Seoul3.jpg';

// 이미지 맵
const imageMap = {
  Osaka: [osakaImage1, osakaImage2, osakaImage3],
  Tokyo: [osakaImage1, osakaImage2, osakaImage3], // 임시 이미지
  Sapporo: [osakaImage1, osakaImage2, osakaImage3], // 임시 이미지
  Seoul: [seoulImage1, seoulImage2, seoulImage3],
  Busan: [seoulImage1, seoulImage2, seoulImage3], // 임시 이미지
  'Jeju Island': [seoulImage1, seoulImage2, seoulImage3], // 임시 이미지
};

function DashboardPage() {
  const { texts } = useContext(LanguageContext);
  const [activeTab, setActiveTab] = useState('japan');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState(null);

  const handleCardClick = (destinationData) => {
    const destinationWithImages = {
      ...destinationData,
      image: imageMap[destinationData.engName][0], // 대표 이미지
      slideshowImages: imageMap[destinationData.engName], // 슬라이드쇼 이미지
    };
    setSelectedDestination(destinationWithImages);
    setIsModalOpen(true);
  };

  // + 버튼 클릭시, 'null'상태로 모달을 염
  const handleNewScheduleClick = () => {
    setSelectedDestination(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedDestination(null);
  };

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <YearSelector />
        <div className="trip-list">
          {texts.myTrips.map(trip => (
            <div key={trip.name} className="trip-item">
              <span className="trip-name">{trip.name}</span>
              <span className="trip-date">{trip.date}</span>
            </div>
          ))}
        </div>
        <div className="add-schedule-button-wrapper">
          <button className="add-schedule-button" onClick={handleNewScheduleClick}>+</button>
        </div>
      </aside>

      <main className="main-content">
        <div className="search-bar">
          <input type="text" placeholder={texts.searchPlaceholder} />
          <div className="search-button-wrapper">
            <button className="search-button">🔍</button>
          </div>
        </div>
        <div className="country-tabs">
          <button className={`tab-item ${activeTab === 'japan' ? 'active' : ''}`} onClick={() => setActiveTab('japan')}>{texts.tabJapan}</button>
          <button className={`tab-item ${activeTab === 'korea' ? 'active' : ''}`} onClick={() => setActiveTab('korea')}>{texts.tabKorea}</button>
        </div>
        <div className="destination-grid">
          {texts.destinations[activeTab].map(dest => (
            <div key={dest.name} className="destination-card" onClick={() => handleCardClick(dest)}>
              <img src={imageMap[dest.engName][0]} alt={dest.name} />
              <div className="card-title">{dest.name}</div>
              <div className="card-subtitle">{dest.engName}</div>
            </div>
          ))}
        </div>
      </main>

      <ScheduleCreationModal 
      isOpen={isModalOpen} 
      onClose={closeModal} 
      destination={selectedDestination} 
      imageMap={imageMap}
      />
    </div>
  );
}

export default DashboardPage;
