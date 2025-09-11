import { useEffect, useState, useContext, useMemo } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import "./DashboardPage.css";
import YearSelector from "../components/YearSelector";
import ScheduleCreationModal from "../components/ScheduleCreationModal";
import { LanguageContext } from "../context/LanguageContext";
import { texts as allTexts } from "../data/translations";
import { listPlans, deletePlan } from "../api/plans";
import Notifications from "../components/Notifications";

// (생략 없는 이미지 임포트들 그대로 유지)
import osakaImage1 from "../assets/Osaka1.webp";
import osakaImage2 from "../assets/Osaka2.webp";
import osakaImage3 from "../assets/Osaka3.webp";
import osakaImage4 from "../assets/Osaka4.webp";
import tokyoImage1 from "../assets/Tokyo1.webp";
import tokyoImage2 from "../assets/Tokyo2.webp";
import tokyoImage3 from "../assets/Tokyo3.webp";
import tokyoImage4 from "../assets/Tokyo4.webp";
import sapporoImage1 from "../assets/Sapporo1.webp";
import sapporoImage2 from "../assets/Sapporo2.webp";
import sapporoImage3 from "../assets/Sapporo3.webp";
import sapporoImage4 from "../assets/Sapporo4.webp";
import kyotoImage1 from "../assets/Kyoto1.webp";
import kyotoImage2 from "../assets/Kyoto2.webp";
import kyotoImage3 from "../assets/Kyoto3.webp";
import kyotoImage4 from "../assets/Kyoto4.webp";
import kitakyushuImage1 from "../assets/Kitakyushu1.webp";
import kitakyushuImage2 from "../assets/Kitakyushu2.webp";
import kitakyushuImage3 from "../assets/Kitakyushu3.webp";
import kitakyushuImage4 from "../assets/Kitakyushu4.webp";
import nagoyaImage1 from "../assets/Nagoya1.webp";
import nagoyaImage2 from "../assets/Nagoya2.webp";
import nagoyaImage3 from "../assets/Nagoya3.webp";
import nagoyaImage4 from "../assets/Nagoya4.webp";
import naraImage1 from "../assets/Nara1.webp";
import naraImage2 from "../assets/Nara2.webp";
import naraImage3 from "../assets/Nara3.webp";
import naraImage4 from "../assets/Nara4.webp";
import nikkoImage1 from "../assets/Nikko1.webp";
import nikkoImage2 from "../assets/Nikko2.webp";
import nikkoImage3 from "../assets/Nikko3.webp";
import nikkoImage4 from "../assets/Nikko4.webp";
import sendaiImage1 from "../assets/Sendai1.webp";
import sendaiImage2 from "../assets/Sendai2.webp";
import sendaiImage3 from "../assets/Sendai3.webp";
import sendaiImage4 from "../assets/Sendai4.webp";
import shizuokaImage1 from "../assets/Shizuoka.webp";
import shizuokaImage2 from "../assets/Shizuoka2.webp";
import shizuokaImage3 from "../assets/Shizuoka3.webp";
import shizuokaImage4 from "../assets/Shizuoka4.webp";
import aomoriImage1 from "../assets/Aomori1.webp";
import aomoriImage2 from "../assets/Aomori2.webp";
import aomoriImage3 from "../assets/Aomori3.webp";
import aomoriImage4 from "../assets/Aomori4.webp";
import yamagataImage1 from "../assets/Yamagata1.webp";
import yamagataImage2 from "../assets/Yamagata2.webp";
import yamagataImage3 from "../assets/Yamagata3.webp";
import yamagataImage4 from "../assets/Yamagata4.webp";
import okinawaImage1 from "../assets/Okinawa1.webp";
import okinawaImage2 from "../assets/Okinawa2.webp";
import okinawaImage3 from "../assets/Okinawa3.webp";
import okinawaImage4 from "../assets/Okinawa4.webp";
import yokohamaImage1 from "../assets/Yokohama1.webp";
import yokohamaImage2 from "../assets/Yokohama2.webp";
import yokohamaImage3 from "../assets/Yokohama3.webp";
import yokohamaImage4 from "../assets/Yokohama4.webp";
import fukuokaImage1 from "../assets/Fukuoka1.webp";
import fukuokaImage2 from "../assets/Fukuoka2.webp";
import fukuokaImage3 from "../assets/Fukuoka3.webp";
import fukuokaImage4 from "../assets/Fukuoka4.webp";
import hiroshimaImage1 from "../assets/Hiroshima1.webp";
import hiroshimaImage2 from "../assets/Hiroshima2.webp";
import hiroshimaImage3 from "../assets/Hiroshima3.webp";
import hiroshimaImage4 from "../assets/Hiroshima4.webp";
// Korea
import seoulImage1 from "../assets/Seoul1.webp";
import seoulImage2 from "../assets/Seoul2.webp";
import seoulImage3 from "../assets/Seoul3.webp";
import seoulImage4 from "../assets/Seoul4.webp";
import busanImage1 from "../assets/Busan1.webp";
import busanImage2 from "../assets/Busan2.webp";
import busanImage3 from "../assets/Busan3.webp";
import busanImage4 from "../assets/Busan4.webp";
import jejuImage1 from "../assets/Jejudo1.webp";
import jejuImage2 from "../assets/Jejudo2.webp";
import jejuImage3 from "../assets/Jejudo3.webp";
import jejuImage4 from "../assets/Jejudo4.webp";
import gangneungImage1 from "../assets/Gangneung1.webp";
import gangneungImage2 from "../assets/Gangneung2.webp";
import gangneungImage3 from "../assets/Gangneung3.webp";
import gangneungImage4 from "../assets/Gangneung4.webp";
import gyeongjuImage1 from "../assets/Gyeongju1.webp";
import gyeongjuImage2 from "../assets/Gyeongju2.webp";
import gyeongjuImage3 from "../assets/Gyeongju3.webp";
import gyeongjuImage4 from "../assets/Gyeongju4.webp";
import gwangjuImage1 from "../assets/Gwangju1.webp";
import gwangjuImage2 from "../assets/Gwangju2.webp";
import gwangjuImage3 from "../assets/Gwangju3.webp";
import gwangjuImage4 from "../assets/Gwangju4.webp";
import damyangImage1 from "../assets/Damyang1.webp";
import damyangImage2 from "../assets/Damyang2.webp";
import damyangImage3 from "../assets/Damyang3.webp";
import damyangImage4 from "../assets/Damyang4.webp";
import daeguImage1 from "../assets/Daegu1.webp";
import daeguImage2 from "../assets/Daegu2.webp";
import daeguImage3 from "../assets/Daegu3.webp";
import daeguImage4 from "../assets/Daegu4.webp";
import daejeonImage1 from "../assets/Daejeon1.webp";
import daejeonImage2 from "../assets/Daejeon2.webp";
import daejeonImage3 from "../assets/Daejeon3.webp";
import daejeonImage4 from "../assets/Daejeon4.webp";
import boseongImage1 from "../assets/Boseong1.webp";
import boseongImage2 from "../assets/Boseong2.webp";
import boseongImage3 from "../assets/Boseong3.webp";
import boseongImage4 from "../assets/Boseong4.webp";
import suwonImage1 from "../assets/Suwon1.webp";
import suwonImage2 from "../assets/Suwon2.webp";
import suwonImage3 from "../assets/Suwon3.webp";
import suwonImage4 from "../assets/Suwon4.webp";
import suncheonImage1 from "../assets/Suncheon1.webp";
import suncheonImage2 from "../assets/Suncheon2.webp";
import suncheonImage3 from "../assets/Suncheon3.webp";
import suncheonImage4 from "../assets/Suncheon4.webp";
import yeosuImage1 from "../assets/Yeosu1.webp";
import yeosuImage2 from "../assets/Yeosu2.webp";
import yeosuImage3 from "../assets/Yeosu3.webp";
import yeosuImage4 from "../assets/Yeosu4.webp";
import ulleungdoImage1 from "../assets/Ulleungdo1.webp";
import ulleungdoImage2 from "../assets/Ulleungdo2.webp";
import ulleungdoImage3 from "../assets/Ulleungdo3.webp";
import ulleungdoImage4 from "../assets/Ulleungdo4.webp";
import jeonjuImage1 from "../assets/Jeonju1.webp";
import jeonjuImage2 from "../assets/Jeonju2.webp";
import jeonjuImage3 from "../assets/Jeonju3.webp";
import jeonjuImage4 from "../assets/Jeonju4.webp";
import chuncheonImage1 from "../assets/Chuncheon1.webp";
import chuncheonImage2 from "../assets/Chuncheon2.webp";
import chuncheonImage3 from "../assets/Chuncheon3.webp";
import chuncheonImage4 from "../assets/Chuncheon4.webp";

const imageMap = {
  Osaka: [osakaImage1, osakaImage2, osakaImage3, osakaImage4],
  Tokyo: [tokyoImage1, tokyoImage2, tokyoImage3, tokyoImage4],
  Sapporo: [sapporoImage1, sapporoImage2, sapporoImage3, sapporoImage4],
  Kyoto: [kyotoImage1, kyotoImage2, kyotoImage3, kyotoImage4],
  Kitakyushu: [kitakyushuImage1, kitakyushuImage2, kitakyushuImage3, kitakyushuImage4],
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
  Hiroshima: [hiroshimaImage1, hiroshimaImage2, hiroshimaImage3, hiroshimaImage4],
  Seoul: [seoulImage1, seoulImage2, seoulImage3, seoulImage4],
  Busan: [busanImage1, busanImage2, busanImage3, busanImage4],
  "Jeju Island": [jejuImage1, jejuImage2, jejuImage3, jejuImage4],
  Gangneung: [gangneungImage1, gangneungImage2, gangneungImage3, gangneungImage4],
  Gyeongju: [gyeongjuImage1, gyeongjuImage2, gyeongjuImage3, gyeongjuImage4],
  Gwangju: [gwangjuImage1, gwangjuImage2, gwangjuImage3, gwangjuImage4],
  Damyang: [damyangImage1, damyangImage2, damyangImage3, damyangImage4],
  Daegu: [daeguImage1, daeguImage2, daeguImage3, daeguImage4],
  Daejeon: [daejeonImage1, daejeonImage2, daejeonImage3, daejeonImage4],
  Boseong: [boseongImage1, boseongImage2, boseongImage3, boseongImage4],
  Suwon: [suwonImage1, suwonImage2, suwonImage3, suwonImage4],
  Suncheon: [suncheonImage1, suncheonImage2, suncheonImage3, suncheonImage4],
  Yeosu: [yeosuImage1, yeosuImage2, yeosuImage3, yeosuImage4],
  Ulleungdo: [ulleungdoImage1, ulleungdoImage2, ulleungdoImage3, ulleungdoImage4],
  Jeonju: [jeonjuImage1, jeonjuImage2, jeonjuImage3, jeonjuImage4],
  Chuncheon: [chuncheonImage1, chuncheonImage2, chuncheonImage3, chuncheonImage4],
};

function DashboardPage() {
  const navigate = useNavigate();
  const { isLoggedIn, bootstrapped } = useOutletContext();   // ★ bootstrapped 함께 받기
  const { language } = useContext(LanguageContext);
  const texts = allTexts[language];

  const [activeTab, setActiveTab] = useState("japan");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [searchInput, setSearchInput] = useState("");

  const [year, setYear] = useState(new Date().getFullYear());
  const [remotePlans, setRemotePlans] = useState([]);

  // ★ 복원이 끝난 뒤에만 리다이렉트 판단
  useEffect(() => {
    if (bootstrapped && !isLoggedIn) {
      navigate("/", { replace: true });
    }
  }, [bootstrapped, isLoggedIn, navigate]);

  useEffect(() => {
    (async () => {
      try {
        const data = await listPlans(year);
        setRemotePlans(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("failed", e);
      }
    })();
  }, [year]);

  // notifications 관련 로직은 별도 컴포넌트로 분리되어 `Notifications`에서 관리합니다.

  // localStorage에서 memberId와 token을 읽어 Notifications에 전달
  const rawUser = typeof window !== "undefined" ? localStorage.getItem("user") : null;
  let memberId = null;
  try {
    const u = rawUser ? JSON.parse(rawUser) : null;
    memberId = u?.memberId ?? u?.id ?? null;
  } catch (err) {
    memberId = null;
  }
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

  const handleCardClick = (destinationData) => {
    const imgs = imageMap[destinationData.engName] || [];
    const destinationWithImages = {
      ...destinationData,
      image: imgs[0] || null,
      slideshowImages: imgs,
    };
    setSelectedDestination(destinationWithImages);
    setIsModalOpen(true);
  };

  const handleNewScheduleClick = () => {
    setSelectedDestination(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedDestination(null);
  };

  const onCreated = () => {
    listPlans(year).then((d) => setRemotePlans(Array.isArray(d) ? d : []))
                   .catch(console.error);
  };

  // 안전 가드(번역/탭 로딩 전)
  const filteredDestinations = useMemo(() => {
    const destinations = texts?.destinations?.[activeTab] ?? [];
    const q = searchInput.trim().toLowerCase();
    if (!q) return destinations;
    return destinations.filter(
      (dest) =>
        dest.name.toLowerCase().includes(q) ||
        dest.engName.toLowerCase().includes(q)
    );
  }, [texts, activeTab, searchInput]);

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <div className="sidebar-top" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="year-wrap">
            <YearSelector
              value={year}
              onChange={(y) => setYear(Number(String(y).match(/\d{4}/)?.[0]))}
            />
          </div>
          <Notifications memberId={memberId} token={token} />
        </div>

        <div className="trip-list" style={{ marginTop: 12 }}>
          {remotePlans.length === 0 ? (
            <div className="trip-item" style={{ justifyContent: "center" }}>
              {texts?.notSchedule ?? "등록된 일정이 없습니다."}
            </div>
          ) : (
            remotePlans.map((p) => (
              <div
                key={p.planId}
                className="trip-item"
                onClick={() => navigate(`/schedule/${p.planId}`)}
                style={{
                  cursor: "pointer",
                  position: "relative",
                  paddingRight: 28, // 오른쪽 X 버튼 자리
                }}
              >
                <span className="trip-name">{p.title}</span>
                <span className="trip-date">
                  {p.startDate} ~ {p.endDate}
                </span>

                {/* 삭제 버튼: 카드 '오른쪽 위' 고정 */}
                <button
                  aria-label="일정 삭제"
                  title="일정 삭제"
                  onClick={async (e) => {
                    e.stopPropagation();
                    const ok = confirm(`"${p.title}" 일정을 삭제할까요? 이 작업은 되돌릴 수 없어요.`);
                    if (!ok) return;
                    try {
                      await deletePlan(p.planId);
                      setRemotePlans((prev) => prev.filter((x) => x.planId !== p.planId));
                    } catch (err) {
                      console.error(err);
                      alert("삭제 중 오류가 발생했어요.");
                    }
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    border: "none",
                    background: "transparent",
                    fontSize: 16,
                    lineHeight: 1,
                    cursor: "pointer",
                    color: "#222",
                    padding: "6px 6px",
                    borderRadius: 6,
                  }}
                >
                  ×
                </button>
              </div>
            ))
          )}

          {/* 새 계획 버튼 */}
          <div className="trip-item add-new-trip" onClick={handleNewScheduleClick}>
            +
          </div>
        </div>
      </aside>

      <main className="main-content">
        {/* 검색 입력창 */}
        <div className="search-bar">
          <input
            type="text"
            placeholder={texts?.searchPlaceholder ?? "어디로 떠날까요?"}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{
              flex: 1,
              fontSize: 17,
              fontFamily: "inherit",
              border: "1px solid #e8e3cf",
              borderRadius: 12,
              padding: "9px 15px",
              background: "#fffdf5",
              color: "#333",
            }}
          />
          <div className="search-button-wrapper">
            <button className="search-button" tabIndex={-1}>🔍</button>
          </div>
        </div>

        {/* 탭 */}
        <div className="country-tabs">
          <button
            className={`tab-item ${activeTab === "japan" ? "active" : ""}`}
            onClick={() => { setActiveTab("japan"); setSearchInput(""); }}
          >
            {texts?.tabJapan ?? "일본"}
          </button>
          <button
            className={`tab-item ${activeTab === "korea" ? "active" : ""}`}
            onClick={() => { setActiveTab("korea"); setSearchInput(""); }}
          >
            {texts?.tabKorea ?? "한국"}
          </button>
        </div>

        {/* 카드 목록 */}
        <div className="destination-grid">
          {filteredDestinations.length === 0 ? (
            <div style={{ color: "#bbb", textAlign: "center", padding: 36, }}>
            검색 결과가 없습니다.
            </div>
          ) : (
            filteredDestinations.map((dest) => {
              const imgs = imageMap[dest.engName] || [];
              const firstImg = imgs[0] || "";
              return (
                <div
                  key={dest.name}
                  className="destination-card"
                  onClick={() => handleCardClick(dest)}
                  style={{
                    cursor: "pointer",
                    border: "1.5px solid #ece3d6",
                    borderRadius: 14,
                    overflow: "hidden",
                    background: "#fff",
                  }}
                >
                  {firstImg && (
                    <img
                      src={firstImg}
                      alt={dest.name}
                      style={{ width: "100%", height: 170, objectFit: "cover" }}
                      loading="lazy"
                    />
                  )}
                  <div className="card-title" style={{ fontWeight: 700, fontSize: 19 }}>{dest.name}</div>
                  <div className="card-subtitle" style={{ color: "#888", fontSize: 15 }}>{dest.engName}</div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* 모달: 왼쪽 플러스는 sm, 카드 클릭은 lg */}
      <ScheduleCreationModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onCreated={onCreated}
        destination={selectedDestination}
        size={selectedDestination ? "lg" : "sm"}
      />
    </div>
  );
}

export default DashboardPage;
