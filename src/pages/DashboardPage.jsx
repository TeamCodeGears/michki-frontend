import { useState, useContext } from "react";
import "./DashboardPage.css";
import YearSelector from "../components/YearSelector";
import ScheduleCreationModal from "../components/ScheduleCreationModal";
import { LanguageContext } from "../context/LanguageContext";
import { texts as allTexts } from "../data/translations"; // texts import

// 일본 도시 이미지 임포트
import osakaImage1 from "../assets/오사카1.jpg";
import osakaImage2 from "../assets/오사카2.jpg";
import osakaImage3 from "../assets/오사카3.jpg";
import osakaImage4 from "../assets/오사카4.jpg";
import tokyoImage1 from "../assets/도쿄1.jpg";
import tokyoImage2 from "../assets/도쿄2.jpg";
import tokyoImage3 from "../assets/도쿄3.jpg";
import tokyoImage4 from "../assets/도쿄4.jpg";
import sapporoImage1 from "../assets/삿포로1.jpg";
import sapporoImage2 from "../assets/삿포로2.jpg";
import sapporoImage3 from "../assets/삿포로3.jpg";
import sapporoImage4 from "../assets/삿포로4.jpg";
import kyotoImage1 from "../assets/교토1.jpg";
import kyotoImage2 from "../assets/교토2.jpg";
import kyotoImage3 from "../assets/교토3.jpg";
import kyotoImage4 from "../assets/교토4.jpg";
import kitakyushuImage1 from "../assets/기타큐슈1.jpg";
import kitakyushuImage2 from "../assets/기타큐슈2.jpg";
import kitakyushuImage3 from "../assets/기타큐슈3.jpg";
import kitakyushuImage4 from "../assets/기타큐슈4.jpg";
import nagoyaImage1 from "../assets/나고야1.jpg";
import nagoyaImage2 from "../assets/나고야2.jpg";
import nagoyaImage3 from "../assets/나고야3.jpg";
import nagoyaImage4 from "../assets/나고야4.jpg";
import naraImage1 from "../assets/나라1.jpg";
import naraImage2 from "../assets/나라2.jpg";
import naraImage3 from "../assets/나라3.jpg";
import naraImage4 from "../assets/나라4.jpg";
import nikkoImage1 from "../assets/닛코1.jpg";
import nikkoImage2 from "../assets/닛코2.jpg";
import nikkoImage3 from "../assets/닛코3.jpg";
import nikkoImage4 from "../assets/닛코4.jpg";
import sendaiImage1 from "../assets/센다이1.jpg";
import sendaiImage2 from "../assets/센다이2.jpg";
import sendaiImage3 from "../assets/센다이3.jpg";
import sendaiImage4 from "../assets/센다이4.jpg";
import shizuokaImage1 from "../assets/시즈오카.jpg";
import shizuokaImage2 from "../assets/시즈오카2.jpg";
import shizuokaImage3 from "../assets/시즈오카3.jpg";
import shizuokaImage4 from "../assets/시즈오카4.jpg";
import aomoriImage1 from "../assets/아오모리1.jpg";
import aomoriImage2 from "../assets/아오모리2.jpg";
import aomoriImage3 from "../assets/아오모리3.jpg";
import aomoriImage4 from "../assets/아오모리4.jpg";
import yamagataImage1 from "../assets/야마가타1.jpg";
import yamagataImage2 from "../assets/야마가타2.jpg";
import yamagataImage3 from "../assets/야마가타3.jpg";
import yamagataImage4 from "../assets/야마가타4.jpg";
import okinawaImage1 from "../assets/오키나와1.jpg";
import okinawaImage2 from "../assets/오키나와2.jpg";
import okinawaImage3 from "../assets/오키나와3.jpg";
import okinawaImage4 from "../assets/오키나와4.jpg";
import yokohamaImage1 from "../assets/요코하마1.jpg";
import yokohamaImage2 from "../assets/요코하마2.jpg";
import yokohamaImage3 from "../assets/요코하마3.jpg";
import yokohamaImage4 from "../assets/요코하마4.jpg";
import fukuokaImage1 from "../assets/후쿠오카1.jpg";
import fukuokaImage2 from "../assets/후쿠오카2.jpg";
import fukuokaImage3 from "../assets/후쿠오카3.jpg";
import fukuokaImage4 from "../assets/후쿠오카4.jpg";
import hiroshimaImage1 from "../assets/히로시마1.jpg";
import hiroshimaImage2 from "../assets/히로시마2.jpg";
import hiroshimaImage3 from "../assets/히로시마3.jpg";
import hiroshimaImage4 from "../assets/히로시마4.jpg";

// 한국 도시 이미지 임포트
import seoulImage1 from "../assets/서울1.jpg";
import seoulImage2 from "../assets/서울2.jpg";
import seoulImage3 from "../assets/서울3.jpg";
import seoulImage4 from "../assets/서울4.jpg";
import busanImage1 from "../assets/부산1.jpg";
import busanImage2 from "../assets/부산2.jpg";
import busanImage3 from "../assets/부산3.jpg";
import busanImage4 from "../assets/부산4.jpg";
import jejuImage1 from "../assets/제주도1.jpg";
import jejuImage2 from "../assets/제주도2.jpg";
import jejuImage3 from "../assets/제주도3.jpg";
import jejuImage4 from "../assets/제주도4.jpg";
import gangneungImage1 from "../assets/강릉1.jpg";
import gangneungImage2 from "../assets/강릉2.jpg";
import gangneungImage3 from "../assets/강릉3.jpg";
import gangneungImage4 from "../assets/강릉4.jpg";
import gyeongjuImage1 from "../assets/경주1.jpg";
import gyeongjuImage2 from "../assets/경주2.jpg";
import gyeongjuImage3 from "../assets/경주3.jpg";
import gyeongjuImage4 from "../assets/경주4.jpg";
import gwangjuImage1 from "../assets/광주1.jpg";
import gwangjuImage2 from "../assets/광주2.jpg";
import gwangjuImage3 from "../assets/광주3.jpg";
import gwangjuImage4 from "../assets/광주4.jpg";
import damyangImage1 from "../assets/담양1.jpg";
import damyangImage2 from "../assets/담양2.jpg";
import damyangImage3 from "../assets/담양3.jpg";
import damyangImage4 from "../assets/담양4.jpg";
import daeguImage1 from "../assets/대구1.jpg";
import daeguImage2 from "../assets/대구2.jpg";
import daeguImage3 from "../assets/대구3.jpg";
import daeguImage4 from "../assets/대구4.jpg";
import daejeonImage1 from "../assets/대전1.jpg";
import daejeonImage2 from "../assets/대전2.jpg";
import daejeonImage3 from "../assets/대전3.jpg";
import daejeonImage4 from "../assets/대전4.jpg";
import boseongImage1 from "../assets/보성1.jpg";
import boseongImage2 from "../assets/보성2.jpg";
import boseongImage3 from "../assets/보성3.jpg";
import boseongImage4 from "../assets/보성4.jpg";
import suwonImage1 from "../assets/수원1.jpg";
import suwonImage2 from "../assets/수원2.jpg";
import suwonImage3 from "../assets/수원3.jpg";
import suwonImage4 from "../assets/수원4.jpg";
import suncheonImage1 from "../assets/순천1.jpg";
import suncheonImage2 from "../assets/순천2.jpg";
import suncheonImage3 from "../assets/순천3.jpg";
import suncheonImage4 from "../assets/순천4.jpg";
import yeosuImage1 from "../assets/여수1.jpg";
import yeosuImage2 from "../assets/여수2.jpg";
import yeosuImage3 from "../assets/여수3.jpg";
import yeosuImage4 from "../assets/여수4.jpg";
import ulleungdoImage1 from "../assets/울릉도1.jpg";
import ulleungdoImage2 from "../assets/울릉도2.jpg";
import ulleungdoImage3 from "../assets/울릉도3.jpg";
import ulleungdoImage4 from "../assets/울릉도4.jpg";
import jeonjuImage1 from "../assets/전주1.jpg";
import jeonjuImage2 from "../assets/전주2.jpg";
import jeonjuImage3 from "../assets/전주3.jpg";
import jeonjuImage4 from "../assets/전주4.jpg";
import chuncheonImage1 from "../assets/춘천1.jpg";
import chuncheonImage2 from "../assets/춘천2.jpg";
import chuncheonImage3 from "../assets/춘천3.jpg";
import chuncheonImage4 from "../assets/춘천4.jpg";

// 이미지 맵
const imageMap = {
  // Japan
  Osaka: [osakaImage1, osakaImage2, osakaImage3, osakaImage4],
  Tokyo: [tokyoImage1, tokyoImage2, tokyoImage3, tokyoImage4],
  Sapporo: [sapporoImage1, sapporoImage2, sapporoImage3, sapporoImage4],
  Kyoto: [kyotoImage1, kyotoImage2, kyotoImage3, kyotoImage4],
  Kitakyushu: [
    kitakyushuImage1,
    kitakyushuImage2,
    kitakyushuImage3,
    kitakyushuImage4,
  ],
  Nagoya: [nagoyaImage1, nagoyaImage2, nagoyaImage3, nagoyaImage4],
  Nara: [naraImage1, naraImage2, naraImage3, naraImage4],
  Nikko: [nikkoImage1, nikkoImage2, nikkoImage3, nikkoImage4],
  Sendai: [sendaiImage1, sendaiImage2, sendaiImage3, sendaiImage4],
  Shizuoka: [shizuokaImage1, shizuokaImage2, shizuokaImage3, shizuokaImage4],
  Aomori: [aomoriImage1, aomoriImage2, aomoriImage3, aomoriImage4],
  Yamagata: [yamagataImage1, yamagataImage2, yamagataImage3, yamagataImage4],
  Okinawa: [okinawaImage1, okinawaImage2, okinawaImage3, okinawaImage4],
  Yokohama: [yokohamaImage1, yokohamaImage2, yokohamaImage3, yokohamaImage4],
  Fukuoka: [fukuokaImage1, fukuokaImage2, fukuokaImage3, fukuokaImage4],
  Hiroshima: [
    hiroshimaImage1,
    hiroshimaImage2,
    hiroshimaImage3,
    hiroshimaImage4,
  ],
  // Korea
  Seoul: [seoulImage1, seoulImage2, seoulImage3, seoulImage4],
  Busan: [busanImage1, busanImage2, busanImage3, busanImage4],
  "Jeju Island": [jejuImage1, jejuImage2, jejuImage3, jejuImage4],
  Gangneung: [
    gangneungImage1,
    gangneungImage2,
    gangneungImage3,
    gangneungImage4,
  ],
  Gyeongju: [gyeongjuImage1, gyeongjuImage2, gyeongjuImage3, gyeongjuImage4],
  Gwangju: [gwangjuImage1, gwangjuImage2, gwangjuImage3, gwangjuImage4],
  Damyang: [damyangImage1, damyangImage2, damyangImage3, damyangImage4],
  Daegu: [daeguImage1, daeguImage2, daeguImage3, daeguImage4],
  Daejeon: [daejeonImage1, daejeonImage2, daejeonImage3, daejeonImage4],
  Boseong: [boseongImage1, boseongImage2, boseongImage3, boseongImage4],
  Suwon: [suwonImage1, suwonImage2, suwonImage3, suwonImage4],
  Suncheon: [suncheonImage1, suncheonImage2, suncheonImage3, suncheonImage4],
  Yeosu: [yeosuImage1, yeosuImage2, yeosuImage3, yeosuImage4],
  Ulleungdo: [
    ulleungdoImage1,
    ulleungdoImage2,
    ulleungdoImage3,
    ulleungdoImage4,
  ],
  Jeonju: [jeonjuImage1, jeonjuImage2, jeonjuImage3, jeonjuImage4],
  Chuncheon: [
    chuncheonImage1,
    chuncheonImage2,
    chuncheonImage3,
    chuncheonImage4,
  ],
};

function DashboardPage() {
  const { language } = useContext(LanguageContext);
  const texts = allTexts[language];
  const [activeTab, setActiveTab] = useState("japan");
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
          {texts.myTrips.map((trip) => (
            <div key={trip.name} className="trip-item">
              <span className="trip-name">{trip.name}</span>
              <span className="trip-date">{trip.date}</span>
            </div>
          ))}
          {texts.pastTrips.map((trip) => (
            <div key={trip.name} className="trip-item past">
              <span className="trip-name">{trip.name}</span>
              <span className="trip-date">{trip.date}</span>
            </div>
          ))}
          <div
            className="trip-item add-new-trip"
            onClick={handleNewScheduleClick}
          >
            +
          </div>
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
          <button
            className={`tab-item ${activeTab === "japan" ? "active" : ""}`}
            onClick={() => setActiveTab("japan")}
          >
            {texts.tabJapan}
          </button>
          <button
            className={`tab-item ${activeTab === "korea" ? "active" : ""}`}
            onClick={() => setActiveTab("korea")}
          >
            {texts.tabKorea}
          </button>
        </div>
        <div className="destination-grid">
          {texts.destinations[activeTab].map((dest) => (
            <div
              key={dest.name}
              className="destination-card"
              onClick={() => handleCardClick(dest)}
            >
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
