// src/pages/ScheduleMap.jsx
import { useState, useRef, useEffect, useContext, useMemo } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Autocomplete,
} from "@react-google-maps/api";
import {
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import RoomPresenceDock from "./RoomPresenceDock";

import michikiLogo from "../assets/michiki-logo.webp";
import { getDaysArr } from "../hooks/useDaysArray";
import toLatLngObj from "../utils/toLatLngObj";
import DraggablePin from "./DraggablePin";
import PinModal from "./PinModal";
import CategoryButtons from "./CategoryButtons";
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
import { LanguageContext } from "../context/LanguageContext";
import { texts as allTexts } from "../data/translations";
import CustomInfoWindow from "./CustomInfoWindow";

import {
  createPlace,
  updatePlace,
  deletePlace,
  reorderPlaces,
  listPlaces,
} from "../api/place";
import { leavePlan } from "../api/plans"; // 그대로 사용

const API_BASE = import.meta.env.VITE_API_BASE;

// Google Maps
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const GOOGLE_MAPS_LIBRARIES = ["places"];

const containerStyle = { width: "100%", height: "100vh" };
const center = { lat: 43.0687, lng: 141.3508 };

// ✅ 로컬스토리지 키
const lsKey = (roomKey) => `pins:${roomKey}`;

function ScheduleMap() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useOutletContext();

  const { planId: planIdFromParam } = useParams();

  const {
    destination,
    title: incomingTitle,
    startDate: incomingStart,
    endDate: incomingEnd,
    planId: planIdFromState,
  } = location.state || {};

  const searchParams = new URLSearchParams(location.search);
  const planIdFromQuery = searchParams.get("planId") || undefined;

  const planId =
    planIdFromParam || planIdFromState || planIdFromQuery || undefined;

  const roomKey = useMemo(() => {
    return planId || destination || location.pathname || "schedule-room";
  }, [planId, destination, location.pathname]);

  const { language } = useContext(LanguageContext);
  const texts = allTexts[language];

  const categories = [
    { label: texts.food, type: "restaurant", icon: "🍽️" },
    { label: texts.hotel, type: "lodging", icon: "🛏️" },
    { label: texts.enjoy, type: "tourist_attraction", icon: "📸" },
    { label: texts.museum, type: "museum", icon: "🏛️" },
    { label: texts.transport, type: "transit_station", icon: "🚉" },
    { label: texts.pharmacy, type: "pharmacy", icon: "💊" },
    { label: "ATM", type: "atm", icon: "🏧" },
  ];

  // 상태
  const [title, setTitle] = useState("여행");
  const [dateRange, setDateRange] = useState([null, null]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // pin 공통 포맷: { id, name, address, photo, position:{lat,lng}, order, comment, googlePlaceId? }
  const [pinsByDay, setPinsByDay] = useState([[]]);
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [showDayDropdown, setShowDayDropdown] = useState(false);

  const [infoWindow, setInfoWindow] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [selectedPin, setSelectedPin] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [autocomplete, setAutocomplete] = useState(null);
  const [geocoder, setGeocoder] = useState(null);

  const mapRef = useRef(null);
  const rightClickListenerRef = useRef(null);
  const clickListenerRef = useRef(null);

  const [nearbyMarkers, setNearbyMarkers] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [showCategoryList, setShowCategoryList] = useState(false);
  const [showPath, setShowPath] = useState(true);

  const [isLeaving, setIsLeaving] = useState(false);
  const [isLoadingPins, setIsLoadingPins] = useState(false);

  // 목적지 주소로 자동 이동
  useEffect(() => {
    if (!destination || !geocoder || !mapRef.current) return;
    geocoder.geocode({ address: destination }, (results, status) => {
      if (status === "OK" && results[0]) {
        const loc = results[0].geometry.location;
        mapRef.current.panTo({ lat: loc.lat(), lng: loc.lng() });
        mapRef.current.setZoom(14);
      }
    });
  }, [destination, geocoder]);

  // state에서 받은 초기 값 반영
  useEffect(() => {
    if (incomingTitle) setTitle(incomingTitle);
    if (incomingStart && incomingEnd) {
      const sd =
        typeof incomingStart === "string"
          ? new Date(incomingStart)
          : incomingStart;
      const ed =
        typeof incomingEnd === "string" ? new Date(incomingEnd) : incomingEnd;
      setDateRange([sd, ed]);
    }
    if (destination) setSearchInput(destination);
  }, [incomingTitle, incomingStart, incomingEnd, destination]);

  // URL로 진입 시 플랜 기본 정보(제목/기간) 로드
  useEffect(() => {
    const needsFetch = planId && !(incomingTitle && incomingStart && incomingEnd);
    if (!needsFetch) return;

    const token = localStorage.getItem("accessToken");
    if (!token || !API_BASE) return;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/plans/${planId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        if (!res.ok) throw new Error(`GET /plans/${planId} ${res.status}`);
        const data = await res.json();
        const t = data.title ?? "여행";
        const sd = new Date(data.startDate);
        const ed = new Date(data.endDate);
        setTitle(t);
        setDateRange([sd, ed]);
      } catch (err) {
        console.error("플랜 로드 실패:", err);
      }
    })();
  }, [planId, incomingTitle, incomingStart, incomingEnd]);

  // Google Maps Loader
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const selectedDayIdxRef = useRef(selectedDayIdx);
  useEffect(() => {
    selectedDayIdxRef.current = selectedDayIdx;
  }, [selectedDayIdx]);

  const [startDate, endDate] = dateRange;
  const daysArr = getDaysArr(startDate, endDate);
  const pins = pinsByDay[selectedDayIdx] || [];

  // 날짜 변경 시 일수 보정
  useEffect(() => {
    if (!startDate || !endDate) {
      setPinsByDay([[]]);
      setSelectedDayIdx(0);
      return;
    }
    setPinsByDay((prev) =>
      prev.length === daysArr.length
        ? prev
        : Array.from({ length: daysArr.length }, (_, i) => prev[i] || [])
    );
    setSelectedDayIdx((idx) => (idx < daysArr.length ? idx : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  // ✅ 핀 로드: planId 있으면 서버, 없으면 localStorage
  useEffect(() => {
    const loadPins = async () => {
      if (!startDate || !endDate) return;

      const blank = Array.from({ length: daysArr.length }, () => []);
      setIsLoadingPins(true);
      try {
        if (planId) {
          const serverPins = await listPlaces(planId);
          const groups = daysArr.map(() => []);
          serverPins
            .sort(
              (a, b) =>
                (a.travelDate || "").localeCompare(b.travelDate || "") ||
                (a.orderInDay ?? 0) - (b.orderInDay ?? 0)
            )
            .forEach((p) => {
              const idx = daysArr.findIndex(
                (d) =>
                  d.toISOString().slice(0, 10) ===
                  (p.travelDate || "").slice(0, 10)
              );
              if (idx >= 0) {
                groups[idx].push({
                  id: p.id, // 서버 id
                  name: p.name || "장소",
                  address: p.description || "",
                  photo: null,
                  position: { lat: p.latitude, lng: p.longitude },
                  order: p.orderInDay ?? groups[idx].length + 1,
                  comment: p.description || "",
                  googlePlaceId: p.googlePlaceId || "",
                });
              }
            });
          setPinsByDay(groups);
        } else {
          const raw = localStorage.getItem(lsKey(roomKey));
          if (!raw) {
            setPinsByDay(blank);
          } else {
            const parsed = JSON.parse(raw);
            const adjusted = Array.from(
              { length: daysArr.length },
              (_, i) => parsed[i] || []
            );
            setPinsByDay(adjusted);
          }
        }
      } catch (e) {
        console.error("핀 로드 실패:", e);
        setPinsByDay(blank);
      } finally {
        setIsLoadingPins(false);
      }
    };
    loadPins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, roomKey, startDate, endDate]);

  // ✅ planId 없으면 자동 로컬 저장
  useEffect(() => {
    if (!startDate || !endDate) return;
    if (planId) return;
    localStorage.setItem(lsKey(roomKey), JSON.stringify(pinsByDay));
  }, [pinsByDay, planId, roomKey, startDate, endDate]);

  // Polyline 토글
  const polylineRef = useRef(null);
  useEffect(() => {
    if (!mapRef.current) return;
    if (showPath && pins.length > 1) {
      if (polylineRef.current) polylineRef.current.setMap(null);
      polylineRef.current = new window.google.maps.Polyline({
        path: pins.map((p) => toLatLngObj(p.position)),
        strokeColor: "red",
        strokeWeight: 3,
        strokeOpacity: 1,
        clickable: false,
        map: mapRef.current,
      });
    } else if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
  }, [showPath, pins]);

  // 지도 onLoad
  const onLoadMap = (map) => {
    mapRef.current = map;
    setGeocoder(new window.google.maps.Geocoder());

    if (rightClickListenerRef.current) {
      window.google.maps.event.removeListener(rightClickListenerRef.current);
      rightClickListenerRef.current = null;
    }
    if (clickListenerRef.current) {
      window.google.maps.event.removeListener(clickListenerRef.current);
      clickListenerRef.current = null;
    }

    // 장소 클릭 → 상세 팝업
    clickListenerRef.current = map.addListener("click", (e) => {
      if (!e.placeId) return;
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
            "place_id",
          ],
        },
        (place, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK) {
            setInfoWindow({
              position: toLatLngObj(place.geometry.location),
              info: {
                placeId: place.place_id,
                name: place.name,
                address: place.formatted_address,
                photo: place.photos?.[0]?.getUrl() ?? null,
                rating: place.rating,
                user_ratings_total: place.user_ratings_total,
                phone: place.formatted_phone_number,
              },
            });
          }
        }
      );
    });

    // 우클릭 → 자유 핀 추가 (서버/로컬 동시 대응)
    rightClickListenerRef.current = map.addListener(
      "rightclick",
      async (e) => {
        const latLng = e.latLng;
        if (!latLng) return;

        const [sd, ed] = dateRange;
        if (!sd || !ed) {
          alert("먼저 여행 날짜를 선택하세요.");
          return;
        }
        const days = getDaysArr(sd, ed);
        const travelDate = days[selectedDayIdxRef.current]
          .toISOString()
          .slice(0, 10);

        const basePin = {
          name: "직접 지정한 위치",
          address: `위도: ${latLng.lat().toFixed(5)}, 경도: ${latLng
            .lng()
            .toFixed(5)}`,
          photo: null,
          position: { lat: latLng.lat(), lng: latLng.lng() },
          order: (pinsByDay[selectedDayIdxRef.current]?.length || 0) + 1,
          comment: "",
          googlePlaceId: "",
        };

        if (planId) {
          try {
            const saved = await createPlace(planId, {
              name: basePin.name,
              description: basePin.address,
              latitude: basePin.position.lat,
              longitude: basePin.position.lng,
              googlePlaceId: "",
              travelDate,
              orderInDay: basePin.order,
            });
            const serverId = saved?.id ?? Date.now();
            setPinsByDay((prev) =>
              prev.map((arr, idx) =>
                idx === selectedDayIdxRef.current
                  ? [...arr, { ...basePin, id: serverId }]
                  : arr
              )
            );
          } catch (err) {
            console.error("자유핀 저장 실패:", err);
            alert("자유 핀 저장 실패: " + err.message);
          }
        } else {
          const localId = Date.now();
          setPinsByDay((prev) =>
            prev.map((arr, idx) =>
              idx === selectedDayIdxRef.current
                ? [...arr, { ...basePin, id: localId }]
                : arr
            )
          );
        }
      }
    );
  };

  // 주변 탐색 실행
  const handleNearbySearch = (type) => {
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
    const c = map.getCenter();

    service.nearbySearch(
      { location: c, radius: 1200, type },
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

  // 주변/검색 결과 장소 상세
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
          "place_id",
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
              placeId: result.place_id,
              name: result.name,
              address: result.formatted_address,
              photo: result.photos?.[0]?.getUrl() ?? null,
              rating: result.rating,
              user_ratings_total: result.user_ratings_total,
              phone: result.formatted_phone_number,
            },
          });
        }
      }
    );
  };

  // 핀 추가 (정보창/검색창에서)
  const handleAddPin = async () => {
    if (!infoWindow && !searchResult) return;
    if (!startDate || !endDate) {
      alert("먼저 여행 날짜를 선택하세요.");
      return;
    }
    const data = infoWindow || searchResult;
    const position = toLatLngObj(data.position);
    const days = getDaysArr(startDate, endDate);
    const travelDate = days[selectedDayIdx].toISOString().slice(0, 10);

    const basePin = {
      name: data.info.name || "장소",
      address: data.info.address || "",
      photo: data.info.photo ?? null,
      position,
      order: pins.length + 1,
      comment: "",
      googlePlaceId: data.info.placeId || "",
    };

    try {
      if (planId) {
        const saved = await createPlace(planId, {
          name: basePin.name,
          description: basePin.address,
          latitude: position.lat,
          longitude: position.lng,
          googlePlaceId: basePin.googlePlaceId,
          travelDate,
          orderInDay: basePin.order,
        });
        const serverId = saved?.id ?? Date.now();
        setPinsByDay((prev) =>
          prev.map((arr, idx) =>
            idx === selectedDayIdx ? [...arr, { ...basePin, id: serverId }] : arr
          )
        );
      } else {
        const localId = Date.now();
        setPinsByDay((prev) =>
          prev.map((arr, idx) =>
            idx === selectedDayIdx ? [...arr, { ...basePin, id: localId }] : arr
          )
        );
      }
    } catch (err) {
      console.error(err);
      alert("장소 등록 실패: " + err.message);
    } finally {
      setInfoWindow(null);
      setSearchResult(null);
      setSearchInput("");
    }
  };

  // 핀 삭제
  const handleDeletePin = async (id) => {
    if (planId) {
      try {
        await deletePlace(planId, id);
      } catch (e) {
        console.error("서버 삭제 실패:", e);
        alert("삭제 실패: " + e.message);
        // 실패 시 화면 반영 취소하려면 return; 추가
      }
    }
    setPinsByDay((prev) =>
      prev.map((arr, idx) =>
        idx === selectedDayIdx
          ? arr.filter((p) => p.id !== id).map((p, i) => ({ ...p, order: i + 1 }))
          : arr
      )
    );
  };

  // 모달
  const handlePinClick = (pin) => {
    setSelectedPin(pin);
    setModalOpen(true);
  };
  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedPin(null);
  };

  // Autocomplete
  const onLoadAutocomplete = (ac) => setAutocomplete(ac);
  const onPlaceChanged = () => {
    if (!autocomplete) return;
    const place = autocomplete.getPlace();
    if (!place.geometry?.location) return;
    const location = toLatLngObj(place.geometry.location);
    const map = mapRef.current;

    setSearchResult({
      position: location,
      info: {
        placeId: place.place_id,
        name: place.name,
        address: place.formatted_address,
        photo: place.photos?.[0]?.getUrl() ?? null,
      },
    });

    map.panTo(location);
    map.setZoom(15);
    setNearbyMarkers([]);
  };

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );
  const handleDragEnd = async ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = pins.findIndex((p) => String(p.id) === String(active.id));
    const newIndex = pins.findIndex((p) => String(p.id) === String(over.id));
    const newOrder = arrayMove(pins, oldIndex, newIndex).map((p, i) => ({
      ...p,
      order: i + 1,
    }));
    setPinsByDay((prev) =>
      prev.map((arr, idx) => (idx === selectedDayIdx ? newOrder : arr))
    );

    // ✅ 서버 순서 재정렬
    try {
      if (planId) {
        const dayDate = getDaysArr(startDate, endDate)
          [selectedDayIdx].toISOString()
          .slice(0, 10);
        const payload = newOrder.map((p) => ({
          placeId: p.id,
          orderInDay: p.order,
          travelDate: dayDate,
        }));
        await reorderPlaces(planId, payload);
      }
    } catch (e) {
      console.error("reorder 실패:", e);
      // 필요 시 되돌리기 로직 추가 가능
    }
  };

  if (!isLoaded) return <div>Loading...</div>;

  return (
    <div style={{ display: "flex", height: "100vh", background: "#fffbe5" }}>
      {/* ===== 왼쪽 패널 ===== */}
      <div
        style={{
          width: 350,
          background: "#46463C",
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
        {/* 상단 로고 + 공유 + 동선ON/OFF + 방 나가기 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 8,
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/")}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
            aria-label="메인으로"
          >
            <img src={michikiLogo} alt="Michiki" style={{ width: 36, height: 36 }} />
          </button>

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
              background: "#FAF5EB",
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
            {texts.share}
          </button>

          <button
            type="button"
            onClick={() => setShowPath((v) => !v)}
            style={{
              background: showPath ? "#FAF5EB" : "#e2d5bb",
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
            title="동선 선(Polyline) 보이기/숨기기"
          >
            {showPath ? texts.pathOn : texts.pathOff}
          </button>

          {/* 방 나가기 */}
          <button
            type="button"
            disabled={!planId || isLeaving}
            onClick={async () => {
              if (!planId) {
                alert("플랜 ID가 없어 방을 나갈 수 없어요.");
                return;
              }
              const ok = confirm(
                "이 방을 나가시겠어요? (마지막 1인이라면 방이 삭제됩니다)"
              );
              if (!ok) return;
              try {
                setIsLeaving(true);
                await leavePlan(planId);
                alert("방 나가기 완료");
                navigate("/dashboard", { replace: true });
              } catch (err) {
                console.error("leave failed", err);
                const s = err?.response?.status;
                const msg =
                  err?.response?.data?.message ||
                  err?.message ||
                  "알 수 없는 오류";
                alert(`방 나가기 실패 (${s ?? "네트워크"}): ${msg}`);
              } finally {
                setIsLeaving(false);
              }
            }}
            style={{
              background: "#FAF5EB",
              color: "222",
              border: "none",
              borderRadius: 8,
              padding: "7px 13px",
              fontWeight: 700,
              fontSize: 14,
              height: 34,
              minWidth: 82,
              cursor: planId && !isLeaving ? "pointer" : "not-allowed",
            }}
            title={!planId ? "플랜 ID가 없어 사용할 수 없습니다" : "방을 나갑니다"}
          >
            {isLeaving ? "나가는 중..." : "방 나가기"}
          </button>
        </div>

        {/* 방 제목 */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            fontWeight: 600,
            fontSize: 18,
            color: "#222",
            background: "#FAF5EB",
            border: "none",
            borderRadius: 10,
            padding: "9px 15px",
            width: "100%",
            marginBottom: 6,
            boxSizing: "border-box",
          }}
          maxLength={30}
          placeholder={texts.tripNamePlaceholder}
        />

        {/* 날짜 버튼 + DatePicker */}
        <div style={{ position: "relative", marginBottom: 1 }}>
          <button
            type="button"
            onClick={() => setShowDatePicker((v) => !v)}
            style={{
              background: "#FAF5EB",
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
              : texts.tripDateSelect}
          </button>
          {showDatePicker && (
            <div style={{ position: "absolute", top: 45, left: 0, zIndex: 100 }}>
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

        {/* 날짜 드롭다운 */}
        {daysArr.length > 0 && (
          <div style={{ marginBottom: 5, position: "relative" }}>
            <button
              onClick={() => setShowDayDropdown((v) => !v)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                background: "#FAF5EB",
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
              {(() => {
                const d = daysArr[selectedDayIdx];
                const weekday = texts.weekdays[d.getDay()];
                const mmdd = `${String(d.getMonth() + 1).padStart(2, "0")}.${String(
                  d.getDate()
                ).padStart(2, "0")}`;
                return `${mmdd} (${weekday}) ▼`;
              })()}
            </button>
            {showDayDropdown && (
              <div
                style={{
                  background: "#FAF5EB",
                  position: "absolute",
                  borderRadius: 8,
                  boxShadow: "0 2px 10px #0002",
                  zIndex: 20,
                  marginTop: 2,
                  width: "100%",
                }}
              >
                {daysArr.map((d, idx) => {
                  const weekday = texts.weekdays[d.getDay()];
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
                        background: idx === selectedDayIdx ? "#FAF5EB" : undefined,
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

        {/* 검색 & 오토컴플릿 */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (searchResult) return handleAddPin();
            if (searchInput.trim() && geocoder && mapRef.current) {
              geocoder.geocode(
                { address: searchInput.trim() },
                (results, status) => {
                  if (status === "OK" && results[0]) {
                    const loc = results[0].geometry.location;
                    mapRef.current.panTo({ lat: loc.lat(), lng: loc.lng() });
                    mapRef.current.setZoom(14);
                  } else {
                    alert(texts.notFound);
                  }
                }
              );
            }
          }}
          style={{
            marginBottom: 6,
            margin: 0,
            boxSizing: "border-box",
            width: "100%",
          }}
        >
          <Autocomplete onLoad={onLoadAutocomplete} onPlaceChanged={onPlaceChanged}>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={texts.searchPlace}
              style={{
                color: "#222",
                background: "#FAF5EB",
                border: "none",
                borderRadius: 10,
                padding: "9px 15px",
                fontWeight: 600,
                fontSize: 16,
                width: "100%",
                display: "block",
                boxSizing: "border-box",
                margin: 0,
              }}
            />
          </Autocomplete>
        </form>

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
              style={{
                fontWeight: 700,
                margin: "7px 0 8px 5px",
                fontSize: 16,
              }}
            >
              {texts.searchResultTitle}
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
                onClick={() => showPlaceDetail(place)}
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
                        style={{
                          color: "#666",
                          fontSize: 13,
                          marginLeft: 6,
                        }}
                      >
                        ({place.user_ratings_total}
                        {texts.cnt})
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

        {/* 핀 리스트 (DnD) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          {isLoadingPins && <span style={{ color: "#FAF5EB" }}>불러오는 중…</span>}
        </div>

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

      {/* ===== 지도 영역 ===== */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <CategoryButtons
          categories={categories}
          activeCategory={activeCategory}
          onClick={handleNearbySearch}
        />

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

          {nearbyMarkers.map((place) => (
            <Marker
              key={place.place_id}
              position={{
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
              }}
              icon={{ url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png" }}
              title={place.name}
              onClick={() => showPlaceDetail(place)}
            />
          ))}

          {(infoWindow || searchResult) && (
            <CustomInfoWindow
              position={toLatLngObj((infoWindow || searchResult).position)}
              info={(infoWindow || searchResult).info}
              onClose={() => {
                setInfoWindow(null);
                setSearchResult(null);
              }}
              onAddPin={handleAddPin}
              texts={texts}
            />
          )}
        </GoogleMap>

        <PinModal
          pin={selectedPin}
          open={modalOpen}
          onClose={handleModalClose}
          onCommentChange={async (comment) => {
            // 화면 즉시 반영
            setPinsByDay((arr) =>
              arr.map((pins, idx) =>
                idx !== selectedDayIdx
                  ? pins
                  : pins.map((p) =>
                      p.id === selectedPin.id ? { ...p, comment, address: comment } : p
                    )
              )
            );
            setSelectedPin((p) => ({ ...p, comment, address: comment }));

            // 서버 반영
            try {
              if (planId) {
                const position = selectedPin.position;
                await updatePlace(planId, selectedPin.id, {
                  name: selectedPin.name || "장소",
                  description: comment, // 메모 = 설명
                  latitude: position.lat,
                  longitude: position.lng,
                  googlePlaceId: selectedPin.googlePlaceId || "",
                });
              }
            } catch (err) {
              console.error("메모 수정 실패:", err);
              alert("메모 수정 실패: " + err.message);
            }
          }}
        />
      </div>

      {/* 참가자 도크 (좌하단) */}
      <RoomPresenceDock roomKey={roomKey} currentUser={user} />
    </div>
  );
}

export default ScheduleMap;
