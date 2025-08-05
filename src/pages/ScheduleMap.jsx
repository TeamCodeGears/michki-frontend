import React, { useState, useRef, useEffect } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  InfoWindow,
  Autocomplete,
} from "@react-google-maps/api";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
// import michikiLogo from "../assets/michiki-logo.png";
import { getDaysArr } from "../utils/useDaysArray.js";
import toLatLngObj from "../utils/toLatLngObj";
import DraggablePin from "../components/DraggablePin";
import PinModal from "../components/PinModal";
import CategoryButtons from "../components/CategoryButtons.jsx";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

// 구글맵 API 키 및 라이브러리
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const GOOGLE_MAPS_LIBRARIES = ["places"];

// 지도 스타일 및 기본 중심 위치(삿포로)
const containerStyle = {
  width: "100%",
  height: "100vh",
};
const center = {
  lat: 43.0687,
  lng: 141.3508,
};

// 장소 카테고리 버튼 정의
const categories = [
  { label: "음식점", type: "restaurant", icon: "🍽️" },
  { label: "호텔", type: "lodging", icon: "🛏️" },
  { label: "즐길 거리", type: "tourist_attraction", icon: "📸" },
  { label: "박물관", type: "museum", icon: "🏛️" },
  { label: "대중교통", type: "transit_station", icon: "🚉" },
  { label: "약국", type: "pharmacy", icon: "💊" },
  { label: "ATM", type: "atm", icon: "🏧" },
];

function ScheduleMap() {
  // ====== 상태 관리 ======
  const [title, setTitle] = useState("여행"); // 방 제목
  const [dateRange, setDateRange] = useState([null, null]); // 여행 날짜 범위 (시작, 끝)
  const [showDatePicker, setShowDatePicker] = useState(false); // 달력 표시 여부
  const [pinsByDay, setPinsByDay] = useState([[]]); // 날짜별 핀 배열 (2차원 배열)
  const [selectedDayIdx, setSelectedDayIdx] = useState(0); // 선택된 날짜 인덱스
  const [showDayDropdown, setShowDayDropdown] = useState(false); // 일자 드롭다운 표시

  // 최신 selectedDayIdx를 참조하기 위한 ref (비동기/이벤트에서 사용)
  const selectedDayIdxRef = useRef(selectedDayIdx);
  useEffect(() => {
    selectedDayIdxRef.current = selectedDayIdx;
  }, [selectedDayIdx]);

  // 구글맵 API 로딩 상태
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // 인포윈도우/검색 상태 등
  const [infoWindow, setInfoWindow] = useState(null); // 지도에 뜨는 정보창
  const [searchInput, setSearchInput] = useState(""); // 검색 입력값
  const [searchResult, setSearchResult] = useState(null); // 검색된 결과 (핀 후보)
  const [selectedPin, setSelectedPin] = useState(null); // 상세보기용 선택 핀
  const [modalOpen, setModalOpen] = useState(false); // 핀 상세 모달창 열림 여부
  const [autocomplete, setAutocomplete] = useState(null); // 구글맵 자동완성 객체
  const [geocoder, setGeocoder] = useState(null); // 주소→좌표 변환기

  // 지도 및 리스너 참조 저장용 ref
  const mapRef = useRef(null);
  const rightClickListenerRef = useRef(null);
  const clickListenerRef = useRef(null);

  // 주변 탐색 마커 상태
  const [nearbyMarkers, setNearbyMarkers] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null); // 선택된 카테고리
  const [showCategoryList, setShowCategoryList] = useState(false);

  // 동선 선(Polyline) 표시 여부
  const [showPath, setShowPath] = useState(true);

  // 현재 선택 날짜의 핀 목록
  const pins = pinsByDay[selectedDayIdx] || [];

  // ====== 날짜가 바뀔 때 날짜 배열/핀 배열 재구성 ======
  useEffect(() => {
    const [start, end] = dateRange;
    if (!start || !end) {
      setPinsByDay([[]]);
      setSelectedDayIdx(0);
      return;
    }
    const daysArr = getDaysArr(start, end);
    setPinsByDay((prev) => {
      // 날짜 개수 변동 시 기존 핀을 최대한 유지
      if (prev.length !== daysArr.length) {
        return Array.from({ length: daysArr.length }, (_, i) => prev[i] || []);
      }
      return prev;
    });
    setSelectedDayIdx((idx) => (idx < daysArr.length ? idx : 0));
  }, [dateRange[0], dateRange[1]]);

  // ====== Polyline(동선 선) 관리 ======
  const polylineRef = useRef(null);
  useEffect(() => {
    if (!mapRef.current) return;

    if (showPath && pins.length > 1) {
      // 기존 선이 있다면 먼저 제거
      if (polylineRef.current) polylineRef.current.setMap(null);
      // 새 Polyline 생성
      polylineRef.current = new window.google.maps.Polyline({
        path: pins.map((p) => toLatLngObj(p.position)),
        strokeColor: "red",
        strokeWeight: 3,
        strokeOpacity: 1,
        clickable: false,
        map: mapRef.current,
      });
    } else {
      // 선 숨기기(삭제)
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    }
  }, [showPath, pins, mapRef.current]);

  // ====== 지도 최초 로드/이벤트 리스너 등록 ======
  const onLoadMap = (map) => {
    mapRef.current = map;
    setGeocoder(new window.google.maps.Geocoder());

    // 기존 리스너 해제
    if (rightClickListenerRef.current) {
      window.google.maps.event.removeListener(rightClickListenerRef.current);
      rightClickListenerRef.current = null;
    }
    if (clickListenerRef.current) {
      window.google.maps.event.removeListener(clickListenerRef.current);
      clickListenerRef.current = null;
    }

    // 지도 내 장소 클릭 시 정보창 표시
    clickListenerRef.current = map.addListener("click", (e) => {
      if (e.placeId) {
        e.stop();
        const service = new window.google.maps.places.PlacesService(map);
        service.getDetails(
          {
            placeId: e.placeId,
            fields: [
              "name",
              "geometry",
              "formatted_address",
              "photos",
              "rating",
              "user_ratings_total",
              "types",
              "formatted_phone_number",
            ],
          },
          (place, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK) {
              setInfoWindow({
                position: toLatLngObj(place.geometry.location),
                info: {
                  placeId: e.placeId,
                  name: place.name,
                  address: place.formatted_address,
                  photo:
                    place.photos && place.photos.length > 0
                      ? place.photos[0].getUrl()
                      : null,
                  rating: place.rating,
                  user_ratings_total: place.user_ratings_total,
                  phone: place.formatted_phone_number,
                },
              });
            }
          }
        );
      }
    });

    // 지도 우클릭 시 직접 위치에 핀 추가
    rightClickListenerRef.current = map.addListener("rightclick", (e) => {
      const latLng = e.latLng;
      if (!latLng) return;
      setPinsByDay((prev) =>
        prev.map((pins, idx) =>
          idx === selectedDayIdxRef.current
            ? [
                ...pins,
                {
                  id: Date.now(),
                  name: "직접 지정한 위치",
                  address: `위도: ${latLng.lat().toFixed(5)}, 경도: ${latLng
                    .lng()
                    .toFixed(5)}`,
                  photo: null,
                  position: { lat: latLng.lat(), lng: latLng.lng() },
                  order: pins.length + 1,
                  comment: "",
                },
              ]
            : pins
        )
      );
    });
  };

  // ====== 카테고리별 주변 탐색 ======
  const handleNearbySearch = (type) => {
    // 이미 선택된 카테고리 누르면 해제
    if (activeCategory === type) {
      setActiveCategory(null);
      setNearbyMarkers([]);
      setShowCategoryList(false);
      return;
    }
    setActiveCategory(type);
    setNearbyMarkers([]);
    setShowCategoryList(true);
    if (!mapRef.current) return;
    const map = mapRef.current;
    const service = new window.google.maps.places.PlacesService(map);
    const center = map.getCenter();

    service.nearbySearch(
      {
        location: center,
        radius: 1200,
        type,
      },
      (results, status) => {
        if (
          status === window.google.maps.places.PlacesServiceStatus.OK &&
          results.length
        ) {
          setNearbyMarkers(results.slice(0, 20));
        } else {
          setNearbyMarkers([]);
          alert("주변에 결과가 없습니다.");
        }
      }
    );
  };

  // ====== 주변 또는 검색 장소 상세 보기 ======
  const showPlaceDetail = (place) => {
    const map = mapRef.current;
    if (!map) return;
    const service = new window.google.maps.places.PlacesService(map);
    service.getDetails(
      {
        placeId: place.place_id,
        fields: [
          "name",
          "geometry",
          "formatted_address",
          "photos",
          "rating",
          "user_ratings_total",
          "types",
          "formatted_phone_number",
        ],
      },
      (result, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK) {
          setInfoWindow({
            position: {
              lat: result.geometry.location.lat(),
              lng: result.geometry.location.lng(),
            },
            info: {
              name: result.name,
              address: result.formatted_address,
              photo:
                result.photos && result.photos.length > 0
                  ? result.photos[0].getUrl()
                  : null,
              rating: result.rating,
              user_ratings_total: result.user_ratings_total,
              phone: result.formatted_phone_number,
            },
          });
        }
      }
    );
  };

  // ====== 핀 추가(장소 정보창에서 '핀찍기' 누를 때) ======
  const handleAddPin = () => {
    if (!infoWindow && !searchResult) return;
    const data = infoWindow || searchResult;
    const position = toLatLngObj(data.position);

    setPinsByDay((prev) =>
      prev.map((pins, idx) =>
        idx === selectedDayIdx
          ? [
              ...pins,
              {
                id: Date.now(),
                ...data.info,
                position,
                order: pins.length + 1,
                comment: "",
              },
            ]
          : pins
      )
    );
    setInfoWindow(null);
    setSearchResult(null);
    setSearchInput("");
  };

  // ====== 핀 삭제 ======
  const handleDeletePin = (id) => {
    setPinsByDay((prev) =>
      prev.map((pins, idx) =>
        idx === selectedDayIdx
          ? pins
              .filter((p) => p.id !== id)
              .map((p, i) => ({ ...p, order: i + 1 }))
          : pins
      )
    );
  };

  // ====== 핀 상세(모달) 열기/닫기 ======
  const handlePinClick = (pin) => {
    setSelectedPin(pin);
    setModalOpen(true);
  };
  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedPin(null);
  };

  // ====== 구글맵 오토컴플릿 제어 ======
  const onLoadAutocomplete = (ac) => setAutocomplete(ac);
  const onPlaceChanged = () => {
    if (!autocomplete) return;
    const place = autocomplete.getPlace();
    if (!place.geometry || !place.geometry.location) return;
    const location = toLatLngObj(place.geometry.location);
    const map = mapRef.current;

    setSearchResult({
      position: location,
      info: {
        placeId: place.place_id,
        name: place.name,
        address: place.formatted_address,
        photo:
          place.photos && place.photos.length > 0
            ? place.photos[0].getUrl()
            : null,
      },
    });

    map.panTo(location);
    map.setZoom(15);
    setNearbyMarkers([]);
  };

  // ====== DnD(드래그 앤 드롭)용 센서 ======
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ====== 핀 순서 바꾸기(드래그 앤 드롭) ======
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = pins.findIndex((p) => String(p.id) === String(active.id));
    const newIndex = pins.findIndex((p) => String(p.id) === String(over.id));
    const newOrder = arrayMove(pins, oldIndex, newIndex).map((p, i) => ({
      ...p,
      order: i + 1,
    }));

    setPinsByDay((prev) =>
      prev.map((dayPins, idx) => (idx === selectedDayIdx ? newOrder : dayPins))
    );
  };

  // ====== 지도 API 준비 전에는 로딩 표시 ======
  if (!isLoaded) return <div>Loading...</div>;

  // 날짜별 일자 배열 구하기
  const [startDate, endDate] = dateRange;
  const daysArr = getDaysArr(startDate, endDate);

  // ====== 실제 화면 렌더링 ======
  return (
    <div style={{ display: "flex", height: "100vh", background: "#fffbe5" }}>
      {/* ============ 왼쪽 패널(일정 리스트/검색/컨트롤) ============ */}
      <div
        style={{
          width: 350,
          background: "#fffaf0",
          color: "#333",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          borderRight: "1px solid #e2d5bb",
          boxSizing: "border-box",
          zIndex: 100,
        }}
      >
        {/* 상단 로고, 공유/동선ON-OFF 버튼 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 8,
            gap: 8,
          }}
        >
          {/* <img
            src={michikiLogo}
            alt="Michiki"
            style={{ width: 36, height: 36 }}
          /> */}
          {/* 일정 URL 공유 버튼 */}
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                alert("일정이 클립보드에 복사되었습니다!");
              } catch {
                alert("복사 실패! (브라우저 권한 또는 HTTPS 환경 확인)");
              }
            }}
            style={{
              background: "#e7d3b5",
              color: "#222",
              border: "none",
              borderRadius: 8,
              padding: "7px 13px",
              fontWeight: 600,
              fontSize: 14,
              height: 34,
              minWidth: 52,
              cursor: "pointer",
            }}
          >
            공유
          </button>
          {/* 동선 선 ON/OFF 버튼 */}
          <button
            type="button"
            onClick={() => setShowPath((v) => !v)}
            style={{
              background: showPath ? "#f0d8a8" : "#e2d5bb",
              color: "#222",
              border: "none",
              borderRadius: 8,
              padding: "7px 13px",
              fontWeight: 600,
              fontSize: 14,
              height: 34,
              minWidth: 52,
              cursor: "pointer",
              marginLeft: 0,
            }}
            title="동선 선(Polyline) 보이기/숨기기"
          >
            {showPath ? "동선 ON" : "동선 OFF"}
          </button>
        </div>

        {/* 주변 장소 탐색 결과 리스트 */}
        {showCategoryList && nearbyMarkers.length > 0 && (
          <div
            style={{
              maxHeight: 400,
              overflowY: "auto",
              marginBottom: 16,
              marginTop: 4,
              background: "#fff",
              borderRadius: 10,
              boxShadow: "0 2px 6px #0001",
              padding: 8,
            }}
          >
            <div
              style={{ fontWeight: 700, margin: "7px 0 8px 5px", fontSize: 16 }}
            >
              검색 결과
            </div>
            {nearbyMarkers.map((place) => (
              <div
                key={place.place_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 13,
                  borderBottom: "1px solid #eee",
                  paddingBottom: 8,
                  cursor: "pointer",
                }}
                onClick={() => showPlaceDetail(place)} // 클릭 시 정보창 열기
              >
                <img
                  src={
                    place.photos && place.photos[0]
                      ? place.photos[0].getUrl()
                      : "https://via.placeholder.com/60?text=No+Image"
                  }
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 9,
                    objectFit: "cover",
                    marginRight: 13,
                  }}
                  alt=""
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 15,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {place.name}
                  </div>
                  {place.rating && (
                    <div style={{ color: "#dc143c", fontSize: 14 }}>
                      ⭐ {place.rating}
                      <span
                        style={{ color: "#666", fontSize: 13, marginLeft: 6 }}
                      >
                        ({place.user_ratings_total}건)
                      </span>
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 12,
                      color: "#888",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {place.vicinity}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 방 제목 입력 */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            fontWeight: 600,
            fontSize: 18,
            background: "#e7d3b5",
            border: "none",
            borderRadius: 10,
            padding: "9px 15px",
            width: "100%",
            marginBottom: 6,
            boxSizing: "border-box",
          }}
          maxLength={30}
          placeholder="방 이름을 입력하세요"
        />

        {/* 날짜 선택 버튼과 DatePicker */}
        <div style={{ position: "relative", marginBottom: 1 }}>
          <button
            type="button"
            onClick={() => setShowDatePicker((v) => !v)}
            style={{
              background: "#e7d3b5",
              border: "none",
              borderRadius: 10,
              padding: "9px 15px",
              fontWeight: 600,
              fontSize: 16,
              color: "#222",
              cursor: "pointer",
              width: "100%",
              textAlign: "left",
            }}
          >
            {startDate && endDate
              ? `${startDate
                  .toLocaleDateString("ko-KR")
                  .replace(/\./g, ".")
                  .replace(/\s/g, "")} ~ ${endDate
                  .toLocaleDateString("ko-KR")
                  .replace(/\./g, ".")
                  .replace(/\s/g, "")}`
              : "여행 날짜 선택"}
          </button>
          {showDatePicker && (
            <div
              style={{
                position: "absolute",
                top: 45,
                left: 0,
                zIndex: 100,
              }}
            >
              {/* react-datepicker: 날짜 범위 선택 */}
              <DatePicker
                selectsRange
                startDate={startDate}
                endDate={endDate}
                onChange={(update) => {
                  setDateRange(update);
                  if (update[0] && update[1]) setShowDatePicker(false);
                }}
                dateFormat="yyyy.MM.dd"
                minDate={new Date()}
                inline
              />
            </div>
          )}
        </div>

        {/* 날짜 드롭다운(여행 일정이 2일 이상인 경우) */}
        {daysArr.length > 0 && (
          <div style={{ marginBottom: 5, position: "relative" }}>
            <button
              onClick={() => setShowDayDropdown((v) => !v)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                background: "#e7d3b5",
                color: "#222",
                border: "none",
                borderRadius: 8,
                padding: "8px 15px",
                fontWeight: 600,
                fontSize: 16,
                justifyContent: "space-between",
                cursor: "pointer",
              }}
            >
              {/* 선택 중인 날짜 표시 */}
              {(() => {
                const thisDate = daysArr[selectedDayIdx];
                const weekday = ["일", "월", "화", "수", "목", "금", "토"][
                  thisDate.getDay()
                ];
                const mmdd = `${String(thisDate.getMonth() + 1).padStart(
                  2,
                  "0"
                )}.${String(thisDate.getDate()).padStart(2, "0")}`;
                return `${mmdd} (${weekday}) ▼`;
              })()}
            </button>
            {showDayDropdown && (
              <div
                style={{
                  background: "#fffbe5",
                  position: "absolute",
                  borderRadius: 8,
                  boxShadow: "0 2px 10px #0002",
                  zIndex: 20,
                  marginTop: 2,
                  width: "100%",
                }}
              >
                {/* 여행 전체 기간의 날짜 목록 드롭다운 */}
                {daysArr.map((d, idx) => {
                  const weekday = ["일", "월", "화", "수", "목", "금", "토"][
                    d.getDay()
                  ];
                  const mmdd = `${String(d.getMonth() + 1).padStart(
                    2,
                    "0"
                  )}.${String(d.getDate()).padStart(2, "0")}`;
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedDayIdx(idx);
                        setShowDayDropdown(false);
                      }}
                      style={{
                        padding: 11,
                        cursor: "pointer",
                        fontWeight: idx === selectedDayIdx ? 700 : 400,
                        background:
                          idx === selectedDayIdx ? "#f0d8a8" : undefined,
                        color: "#222",
                      }}
                    >
                      {mmdd} ({weekday}) {idx === selectedDayIdx && "✔"}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== 검색/핀추가 폼 ===== */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (searchResult) {
              handleAddPin();
              return;
            }
            if (searchInput.trim() && geocoder && mapRef.current) {
              geocoder.geocode(
                { address: searchInput.trim() },
                (results, status) => {
                  if (status === "OK" && results[0]) {
                    const loc = results[0].geometry.location;
                    const location = { lat: loc.lat(), lng: loc.lng() };
                    mapRef.current.panTo(location);
                    mapRef.current.setZoom(14);
                    setSearchResult({
                      position: location,
                      info: {
                        name: results[0].formatted_address,
                        address: results[0].formatted_address,
                        photo: null,
                      },
                    });
                  } else {
                    alert("해당 지역을 찾을 수 없습니다.");
                  }
                }
              );
            }
          }}
          style={{ display: "flex", marginBottom: 6 }}
        >
          {/* 구글맵 자동완성 input */}
          <Autocomplete
            onLoad={onLoadAutocomplete}
            onPlaceChanged={onPlaceChanged}
            style={{ width: "100%" }}
          >
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="도시·장소 검색"
              style={{
                flex: 1,
                padding: 8,
                borderRadius: 7,
                border: "1px solid #bbb",
                fontSize: 15,
              }}
            />
          </Autocomplete>
        </form>

        {/* ==== 핀 리스트 (DnD 지원) ==== */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={pins.map((p) => String(p.id))}
            strategy={verticalListSortingStrategy}
          >
            <div style={{ flex: 1, overflowY: "auto", minHeight: 50 }}>
              {pins.map((pin, idx) => (
                <DraggablePin
                  key={pin.id}
                  pin={pin}
                  index={idx}
                  onClick={() => handlePinClick(pin)}
                  onDelete={() => handleDeletePin(pin.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* ===================== 지도 영역 ===================== */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {/* 카테고리 버튼 (지도 위 오버레이) */}
        <CategoryButtons
          categories={categories}
          activeCategory={activeCategory}
          onClick={handleNearbySearch}
        />

        {/* 구글맵 자체 */}
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={14}
          onLoad={onLoadMap}
          options={{
            gestureHandling: "greedy",
            clickableIcons: true,
            mapTypeControl: false,
            fullscreenControl: false,
            streetViewControl: false,
            zoomControl: true,
          }}
        >
          {/* 일정 핀 (드래그X, 클릭시 상세) */}
          {pins.map((pin) => (
            <Marker
              key={pin.id}
              position={toLatLngObj(pin.position)}
              label={{
                text: `${pin.order}`,
                color: "#fff",
                fontWeight: "bold",
                fontSize: "16px",
              }}
              onClick={() => handlePinClick(pin)}
              onRightClick={() => handleDeletePin(pin.id)}
              icon={{
                url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
                labelOrigin: { x: 15, y: 10 },
              }}
            />
          ))}

          {/* 주변 검색 마커 (파란색) */}
          {nearbyMarkers.map((place) => (
            <Marker
              key={place.place_id}
              position={{
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
              }}
              icon={{
                url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
              }}
              title={place.name}
              onClick={() => showPlaceDetail(place)}
            />
          ))}

          {/* 인포윈도우(핀찍기/상세) */}
          {(infoWindow || searchResult) && (
            <InfoWindow
              position={toLatLngObj((infoWindow || searchResult).position)}
              onCloseClick={() => {
                setInfoWindow(null);
                setSearchResult(null);
              }}
            >
              <div
                style={{
                  minWidth: 320,
                  maxWidth: 390,
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  fontFamily: "Pretendard, Noto Sans KR, Arial, sans-serif",
                }}
              >
                {(infoWindow || searchResult).info.photo && (
                  <img
                    src={(infoWindow || searchResult).info.photo}
                    alt=""
                    style={{
                      width: 88,
                      height: 88,
                      objectFit: "cover",
                      borderRadius: 8,
                      marginRight: 18,
                      flexShrink: 0,
                    }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 18,
                      marginBottom: 6,
                      lineHeight: 1.3,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {(infoWindow || searchResult).info.name}
                  </div>
                  {(infoWindow || searchResult).info.rating && (
                    <div
                      style={{
                        color: "#dc143c",
                        fontWeight: 600,
                        marginBottom: 3,
                      }}
                    >
                      ⭐ {(infoWindow || searchResult).info.rating}
                      <span
                        style={{
                          color: "#666",
                          fontWeight: 400,
                          marginLeft: 7,
                        }}
                      >
                        ({(infoWindow || searchResult).info.user_ratings_total}
                        건)
                      </span>
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 14,
                      color: "#555",
                      marginBottom: 2,
                      whiteSpace: "pre-line",
                    }}
                  >
                    {(infoWindow || searchResult).info.address}
                  </div>
                  {(infoWindow || searchResult).info.phone && (
                    <div
                      style={{
                        fontSize: 14,
                        color: "#555",
                        marginBottom: 2,
                      }}
                    >
                      <a
                        href={`tel:${(infoWindow || searchResult).info.phone}`}
                        style={{
                          color: "#1769aa",
                          textDecoration: "underline",
                        }}
                      >
                        {(infoWindow || searchResult).info.phone}
                      </a>
                    </div>
                  )}
                  <button
                    onClick={handleAddPin}
                    style={{
                      background: "#f0d8a8",
                      border: "none",
                      borderRadius: 8,
                      padding: "7px 22px",
                      cursor: "pointer",
                      fontWeight: 600,
                      marginTop: 12,
                      fontSize: 16,
                    }}
                  >
                    핀찍기
                  </button>
                </div>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>

        {/* 핀 상세(메모 등) 모달 */}
        <PinModal
          pin={selectedPin}
          open={modalOpen}
          onClose={handleModalClose}
          onCommentChange={(comment) => {
            setPinsByDay((arr) =>
              arr.map((pins, idx) =>
                idx !== selectedDayIdx
                  ? pins
                  : pins.map((p) =>
                      p.id === selectedPin.id ? { ...p, comment } : p
                    )
              )
            );
            setSelectedPin((p) => ({
              ...p,
              comment,
            }));
          }}
        />
      </div>
    </div>
  );
}

export default ScheduleMap;
