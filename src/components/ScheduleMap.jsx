import { useState, useRef, useEffect, useContext, useMemo } from "react";
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from "@react-google-maps/api";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";

import styles from "./ScheduleMap.module.css";
import createPlanStompClient, { subscribePlanPlaces, subscribePlanChat, sendPlanChat } from "../socket/planSocket";

import RoomPresenceDock from "./RoomPresenceDock";
import michikiLogo from "../assets/michiki-logo.webp";
import { getDaysArr } from "../hooks/useDaysArray";
import toLatLngObj from "../utils/toLatLngObj";
import DraggablePin from "./DraggablePin";
import PinModal from "./PinModal";
import CategoryButtons from "./CategoryButtons";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
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
import { leavePlan, getSharedPlan, getPlan } from "../api/plans";
import InlineLoginFab from "./InlineLoginFab";
import CursorLayer from "./cursor/CursorLayer";
import "./cursor/CursorLayer.css";

const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const API_BASE = import.meta.env.VITE_API_BASE;
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const GOOGLE_MAPS_LIBRARIES = ["places"];

const containerStyle = { width: "100%", height: "100vh" };
const center = { lat: 43.0687, lng: 141.3508 };
const lsKey = (roomKey) => `pins:${roomKey}`;



function toUiPin(p, fallbackOrder = 1) {
  return {
    id: p.id ?? p.placeId,
    name: p.name || "장소",
    address: "",
    photo: null,
    position: { lat: p.latitude, lng: p.longitude },
    order: p.orderInDay ?? fallbackOrder,
    comment: p.description || "",
    googlePlaceId: p.googlePlaceId || "",
    travelDate: p.travelDate || null,
  };
}

/* ============ 사진/주소 캐시(TTL) ============ */
const PHOTO_TTL_MS = 30 * 60 * 1000;

const getCachedPhoto = (pid) => {
  try {
    const raw = localStorage.getItem(`placePhoto:${pid}`);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj?.url || !obj?.ts) return null;
    if (Date.now() - obj.ts > PHOTO_TTL_MS) return null;
    return obj.url;
  } catch {
    return null;
  }
};
const setCachedPhoto = (pid, url) => {
  try {
    if (!url) return;
    localStorage.setItem(`placePhoto:${pid}`, JSON.stringify({ url, ts: Date.now() }));
  } catch { }
};
const getCachedAddress = (pid) => {
  try {
    return localStorage.getItem(`placeAddr:${pid}`) || null;
  } catch {
    return null;
  }
};
const setCachedAddress = (pid, a) => {
  try {
    if (!a) return;
    localStorage.setItem(`placeAddr:${pid}`, a);
  } catch { }
};

const toPlainLatLng = (obj) => {
  if (!obj) return null;
  const lat = typeof obj.lat === "function" ? obj.lat() : obj.lat;
  const lng = typeof obj.lng === "function" ? obj.lng() : obj.lng;
  return typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;
};

const formatKDate = (d) =>
  d instanceof Date && !isNaN(d) ? d.toLocaleDateString("ko-KR").replace(/\./g, ".").replace(/\s/g, "") : "날짜 미지정";

function ScheduleMap() {
  // === center sync helpers (컴포넌트 내부) ===

  // 로컬 캐시 키
  const centerLsKey = (roomKey) => `center:${roomKey}`;

  // senderId (루프 방지)
  const getSenderId = () => {
    try {
      const u = JSON.parse(localStorage.getItem("user") || "null");
      if (u?.memberId) return `m:${u.memberId}`;
    } catch { }
    let id = localStorage.getItem("center-sync:senderId");
    if (!id) {
      id = `g:${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem("center-sync:senderId", id);
    }
    return id;
  };

  const stompRef = useRef(null);
  const senderIdRef = useRef(getSenderId());
  const pendingCenterRef = useRef(null);

  const saveCenterCache = (p, zoom) => {
    try { localStorage.setItem(centerLsKey(roomKey), JSON.stringify({ p, zoom })); } catch { }
  };
  const readCenterCache = () => {
    try {
      const raw = localStorage.getItem(centerLsKey(roomKey));
      if (!raw) return null;
      const { p, zoom } = JSON.parse(raw);
      if (p && typeof p.lat === "number" && typeof p.lng === "number") {
        return { p, zoom: typeof zoom === "number" ? zoom : 14 };
      }
    } catch { }
    return null;
  };

  const broadcastCenter = (p, zoom) => {
    const msg = { __sys: "CENTER", center: p, zoom, senderId: senderIdRef.current, ts: Date.now() };
    if (centerSyncEnabled && stompRef.current) {
      sendPlanChat(stompRef.current, planId, msg);
      pendingCenterRef.current = null;
    } else {
      pendingCenterRef.current = msg; // 연결 전이면 대기
    }
  };

  const applyCenter = (p, zoom = 14, { shouldBroadcast = true } = {}) => {
    if (!p || !mapRef.current) return;
    mapRef.current.panTo(p);
    mapRef.current.setZoom(zoom);
    saveCenterCache(p, zoom);
    if (shouldBroadcast) broadcastCenter(p, zoom);
  };

  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoggedIn, setIsLoggedIn, setUser } = useOutletContext() || {};
  const { planId: planIdFromParam, shareURI: shareURIFromRoute } = useParams();
  const shareURI = shareURIFromRoute ?? null; // ← state 아님, 파라미터 그대로

  const {
    destination,
    title: incomingTitle,
    startDate: incomingStart,
    endDate: incomingEnd,
    planId: planIdFromState,
  } = location.state || {};

  const qs = new URLSearchParams(location.search);
  const planIdFromQuery = qs.get("planId") || undefined;
  const sdFromQuery = qs.get("sd");
  const edFromQuery = qs.get("ed");
  const titleFromQuery = qs.get("t");
  const destFromQuery = qs.get("d") || qs.get("dest") || qs.get("destination") || undefined;
  const clatFromQuery = qs.get("clat");
  const clngFromQuery = qs.get("clng");
  const czoomFromQuery = qs.get("cz");

  // URL 또는 state 중 하나라도 있으면 초기 목적지로 사용
  const initialDestination = useMemo(
    () => (destination || destFromQuery || ""),
    [destination, destFromQuery]
  );

  // 공유 모드 여부
  const isSharedMode = !!shareURI;

  // 일반 모드에서는 planId 사용
  const planId = isSharedMode ? undefined : (planIdFromParam || planIdFromState || planIdFromQuery || undefined);

  // ===== DEBUG: route / mode snapshot =====
  useEffect(() => {
    // 콘솔 보존 켜기: DevTools → ⚙️ → "Preserve log" 체크 추천
    console.groupCollapsed("%c[ScheduleMap] route debug", "color:#888");
    console.log("pathname             :", location.pathname);
    console.log("search               :", location.search);
    console.log("params.planId        :", planIdFromParam);
    console.log("params.shareURI      :", shareURIFromRoute);
    console.log("state.shareURI(useState):", shareURI);
    console.log("isSharedMode         :", isSharedMode);
    console.log("planId (effective)   :", planId);
    console.groupEnd();

    // /schedule인데 isSharedMode가 true면 즉시 경고
    if (location.pathname.startsWith("/schedule") && isSharedMode) {
      console.warn("⚠️ /schedule/* 경로인데 isSharedMode=true 입니다. shareURI state가 남아있을 가능성.");
    }
  }, [
    location.pathname,
    location.search,
    planIdFromParam,
    shareURIFromRoute,
    shareURI,          // state
    isSharedMode,
    planId
  ]);


  // roomKey
  const roomKey = useMemo(
    () => (isSharedMode ? `share:${shareURI}` : (planId || initialDestination || location.pathname || "schedule-room")),
    [isSharedMode, shareURI, planId, initialDestination, location.pathname]
  );

  const centerSyncEnabled = !!planId && !isSharedMode;

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

  // state
  const [title, setTitle] = useState("여행");
  const [dateRange, setDateRange] = useState([null, null]);
  const [shareUriState, setShareUriState] = useState(null); // ✅ 추가
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
  const [mapInstance, setMapInstance] = useState(null);
  const rightClickListenerRef = useRef(null);
  const clickListenerRef = useRef(null);

  const [nearbyMarkers, setNearbyMarkers] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [showCategoryList, setShowCategoryList] = useState(false);
  const [showPath, setShowPath] = useState(true);

  const [isLeaving, setIsLeaving] = useState(false);
  const [isLoadingPins, setIsLoadingPins] = useState(false);
  const [members, setMembers] = useState([]);

  // 색 변경 등 서버 상태 반영: 멤버 재조회
  const refetchMembers = async () => {
    if (!planId) return;
    try {
      const data = await getPlan(planId);
      setMembers(data.members || []);
    } catch (e) {
      console.warn("refetch members failed:", e);
    }
  };

  // 읽기 전용 여부
  const readOnly = isSharedMode ? true : !isLoggedIn;

  // 커서 숨김 (편집 가능일 때만)
  useEffect(() => {
    if (!readOnly) {
      document.body.classList.add("hide-native-cursor");
      return () => document.body.classList.remove("hide-native-cursor");
    } else {
      document.body.classList.remove("hide-native-cursor");
    }
  }, [readOnly]);

  // ===== 장소 변경 브로드캐스트 구독 (웹소켓)
  useEffect(() => {
    if (!planId || isSharedMode) return;

    const token = localStorage.getItem("accessToken") || null;
    let subPlaces, subChat;
    const client = createPlanStompClient({
      token,
      onConnect: () => {
        stompRef.current = client;

        subPlaces = subscribePlanPlaces(client, planId, () => {
          refreshPinsFromServer();
        });

        subChat = subscribePlanChat(client, planId, (frame) => {
          try {
            const msg = JSON.parse(frame.body || "{}");
            if (msg?.__sys === "CENTER") {
              if (msg.senderId && msg.senderId === senderIdRef.current) return;
              const p = msg.center;
              if (!p || typeof p.lat !== "number" || typeof p.lng !== "number") return;
              applyCenter(p, typeof msg.zoom === "number" ? msg.zoom : 14, { shouldBroadcast: false });
              return;
            }
            if (msg?.__sys === "COLOR") {
              const { memberId, color } = msg;
              if (!memberId || !color) return;
              // members 즉시 반영 → colorsByMember(useMemo) 재계산 → CursorLayer/Avatar 즉시 갱신
              setMembers((prev) =>
                prev.map((m) =>
                  String(m.memberId ?? m.id) === String(memberId) ? { ...m, color } : m
                )
              );
              return;
            }
          } catch { }
        });

        // ✅ 연결 직후 대기열이 있으면 즉시 브로드캐스트
        if (pendingCenterRef.current) {
          sendPlanChat(client, planId, pendingCenterRef.current);
          pendingCenterRef.current = null;
        }
      },
    });

    client.activate();

    return () => {
      try { subPlaces?.unsubscribe(); } catch { }
      try { subChat?.unsubscribe(); } catch { }
      try { client.deactivate(); } catch { }
      stompRef.current = null;
    };
  }, [planId, isSharedMode, dateRange]);

  // 목적지 이동 (state 또는 URL에서 온 initialDestination)
  useEffect(() => {
    if (!initialDestination || !geocoder || !mapRef.current) return;
    geocoder.geocode({ address: initialDestination }, (results, status) => {
      if (status === "OK" && results[0]) {
        const p = toPlainLatLng(results[0].geometry.location);
        if (p) {
          // ✅ 공용 함수: 이동 + 캐시 + (연결되면) 브로드캐스트 / (미연결) 대기열
          applyCenter(p, 14, { shouldBroadcast: true });
        }
      }
    });
  }, [initialDestination, geocoder]); // centerSyncEnabled/planId는 applyCenter에서 처리됨

  // 초기값 반영
  useEffect(() => {
    if (incomingTitle) setTitle(incomingTitle);
    else if (titleFromQuery) setTitle(titleFromQuery);

    if (incomingStart && incomingEnd) {
      setDateRange([
        typeof incomingStart === "string" ? new Date(incomingStart) : incomingStart,
        typeof incomingEnd === "string" ? new Date(incomingEnd) : incomingEnd,
      ]);
    } else if (sdFromQuery && edFromQuery) {
      const sd = new Date(sdFromQuery);
      const ed = new Date(edFromQuery);
      if (!isNaN(sd) && !isNaN(ed)) setDateRange([sd, ed]);
    }
    if (initialDestination) setSearchInput(initialDestination);
  }, [incomingTitle, incomingStart, incomingEnd, initialDestination, sdFromQuery, edFromQuery, titleFromQuery]);



  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY, libraries: GOOGLE_MAPS_LIBRARIES });

  const selectedDayIdxRef = useRef(selectedDayIdx);
  useEffect(() => {
    selectedDayIdxRef.current = selectedDayIdx;
  }, [selectedDayIdx]);

  const [startDate, endDate] = dateRange;
  const hasValidDates = startDate instanceof Date && !isNaN(startDate) && endDate instanceof Date && !isNaN(endDate);
  const daysArr = hasValidDates ? getDaysArr(startDate, endDate) : [];
  const pins = pinsByDay[selectedDayIdx] || [];

  // 플랜 정보 로드 (공유/일반) - 항상 서버 진실 사용
  useEffect(() => {
    const load = async () => {
      if (!API_BASE) return;
      try {
        setIsLoadingPins(true);
        if (isSharedMode) {
          // 공유 모드도 서버에서 전부
          const data = await getSharedPlan(encodeURIComponent(shareURI));
          setTitle(data.title ?? "여행");
          if (data.startDate && data.endDate) setDateRange([new Date(data.startDate), new Date(data.endDate)]);
          setShareUriState(data.shareURI || shareURI || null); // ✅ 추가: 서버 응답의 shareURI(없으면 라우트값)
          setMembers(data.members || []); // 공유 보기에서도 멤버 반영

          // 로그인 상태면 서버가 자동 참여 처리 → 일반 모드로 전환
          if (isLoggedIn && data?.planId) {
            navigate(`/schedule/${data.planId}`, {
              replace: true,
              state: {
                title: data.title,
                startDate: data.startDate,
                endDate: data.endDate,
                planId: data.planId,
              },
            });
            return;
          }
          // places → 화면에 즉시 반영
          if (data.startDate && data.endDate) {
            const sd = new Date(data.startDate); const ed = new Date(data.endDate);
            const days = getDaysArr(sd, ed);
            const dayIndexByIso = new Map(days.map((d, i) => [ymd(d), i]));
            const groups = Array.from({ length: days.length }, () => []);
            (data.places || [])
              .slice()
              .sort((a, b) => (a.travelDate || "").localeCompare(b.travelDate || "") || (a.orderInDay ?? 0) - (b.orderInDay ?? 0))
              .forEach(p => {
                const idx = dayIndexByIso.get((p.travelDate || "").slice(0, 10));
                if (idx == null) return;
                groups[idx].push(toUiPin(p, (groups[idx].length || 0) + 1));
              });
            setPinsByDay(groups);
          } else {
            setPinsByDay([(data.places || []).map((p, i) => toUiPin(p, i + 1))]);
          }
          return;
        }

        // 일반 모드: 항상 서버에서 title/dates/members/places 수신
        if (!planId) return;
        const token = localStorage.getItem("accessToken") || "";
        const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
        const res = await fetch(`${API_BASE}/plans/${planId}`, { headers });
        if (!res.ok) throw new Error(`GET /plans/${planId} ${res.status}`);
        const data = await res.json();

        setTitle(data.title ?? "여행");
        if (data.startDate && data.endDate) setDateRange([new Date(data.startDate), new Date(data.endDate)]);
        setMembers(data.members || []); // ✅ 서버 내려준 멤버/색만 사용
        setShareUriState(data.shareURI || null); // ✅ 서버 응답의 shareURI 저장

        // places도 즉시 반영
        if (data.startDate && data.endDate) {
          const sd = new Date(data.startDate); const ed = new Date(data.endDate);
          const days = getDaysArr(sd, ed);
          const dayIndexByIso = new Map(days.map((d, i) => [ymd(d), i]));
          const groups = Array.from({ length: days.length }, () => []);
          (data.places || [])
            .slice()
            .sort((a, b) => (a.travelDate || "").localeCompare(b.travelDate || "") || (a.orderInDay ?? 0) - (b.orderInDay ?? 0))
            .forEach(p => {
              const idx = dayIndexByIso.get((p.travelDate || "").slice(0, 10));
              if (idx == null) return;
              groups[idx].push(toUiPin(p, (groups[idx].length || 0) + 1));
            });
          setPinsByDay(groups);
        } else {
          setPinsByDay([(data.places || []).map((p, i) => toUiPin(p, i + 1))]);
        }
      } catch (err) {
        console.error("플랜 로드 실패:", err);
      } finally {
        setIsLoadingPins(false);
      }
    };
    load();
  }, [API_BASE, isSharedMode, shareURI, planId, isLoggedIn]); // ← 로그인 상태 변할 때도 재평가


  // 서버가 내려준 멤버 색상만 사용
  const colorsByMember = useMemo(() => {
    const m = new Map();
    for (const it of (members || [])) {
      const id = String(it.memberId ?? it.id ?? "");
      if (id) m.set(id, it.color || null);
    }
    return m;
  }, [members]);


  // 날짜 길이 보정
  useEffect(() => {
    if (!hasValidDates) {
      setPinsByDay([[]]);
      setSelectedDayIdx(0);
      return;
    }
    setPinsByDay((prev) =>
      prev.length === daysArr.length ? prev : Array.from({ length: daysArr.length }, (_, i) => prev[i] || [])
    );
  }, [hasValidDates, startDate, endDate]); // eslint-disable-line

  // 서버 핀 동기화
  const refreshPinsFromServer = async () => {
    if (!planId || !hasValidDates || isSharedMode) return;
    const all = await listPlaces(planId);
    const dayIndexByIso = new Map(getDaysArr(startDate, endDate).map((d, i) => [ymd(d), i]));
    const groups = Array.from({ length: getDaysArr(startDate, endDate).length }, () => []);
    all
      .sort((a, b) => (a.travelDate || "").localeCompare(b.travelDate || "") || (a.orderInDay ?? 0) - (b.orderInDay ?? 0))
      .forEach((p) => {
        const idx = dayIndexByIso.get((p.travelDate || "").slice(0, 10));
        if (idx == null) return;
        groups[idx].push(toUiPin(p, (groups[idx].length || 0) + 1));
      });
    setPinsByDay(groups);
  };

  // 핀 로드
  useEffect(() => {
    const loadPins = async () => {
      if (!hasValidDates) return;
      if (isSharedMode) return;

      const blank = Array.from({ length: daysArr.length }, () => []);
      setIsLoadingPins(true);
      try {
        if (planId) await refreshPinsFromServer();
        else {
          const raw = localStorage.getItem(lsKey(roomKey));
          if (!raw) setPinsByDay(blank);
          else {
            const parsed = JSON.parse(raw);
            const adjusted = Array.from({ length: daysArr.length }, (_, i) => parsed[i] || []);
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
  }, [isSharedMode, planId, roomKey, hasValidDates, startDate, endDate]); // eslint-disable-line

  // 로컬 저장 (비로그인 로컬방)
  useEffect(() => {
    if (!hasValidDates || planId || isSharedMode) return;
    localStorage.setItem(lsKey(roomKey), JSON.stringify(pinsByDay));
  }, [pinsByDay, planId, roomKey, hasValidDates, isSharedMode]);

  // Polyline
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

  const hydrationBusyRef = useRef(false);

  const onLoadMap = (map) => {
    mapRef.current = map;
    setMapInstance(map);
    setGeocoder(new window.google.maps.Geocoder());
    // 5-1) URL에 clat/clng 있으면 최우선 적용
    if (clatFromQuery && clngFromQuery) {
      const p = { lat: parseFloat(clatFromQuery), lng: parseFloat(clngFromQuery) };
      if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
        applyCenter(p, Number.isFinite(+czoomFromQuery) ? +czoomFromQuery : 14, { shouldBroadcast: true });
      }
    } else {
      // ✅ 캐시가 있으면 즉시 적용(깜빡임 최소화, 새로고침 시 유지)
      const cached = readCenterCache();
      if (cached) {
        applyCenter(cached.p, cached.zoom ?? 14, { shouldBroadcast: false });
      }
    }

    if (rightClickListenerRef.current) {
      window.google.maps.event.removeListener(rightClickListenerRef.current);
      rightClickListenerRef.current = null;
    }
    if (clickListenerRef.current) {
      window.google.maps.event.removeListener(clickListenerRef.current);
      clickListenerRef.current = null;
    }

    // 지도 클릭 → 정보창
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
            const pos = toPlainLatLng(place.geometry.location);
            if (!pos) return;
            const freshPhoto =
              place.photos?.[0]?.getUrl?.({ maxWidth: 800 }) ||
              place.photos?.[0]?.getUrl?.() ||
              null;
            setInfoWindow({
              position: pos,
              info: {
                placeId: place.place_id,
                name: place.name,
                address: place.formatted_address,
                photo: freshPhoto,
                rating: place.rating,
                user_ratings_total: place.user_ratings_total,
                phone: place.formatted_phone_number,
              },
            });
          }
        }
      );
    });

    // 우클릭 → 자유 핀
    rightClickListenerRef.current = map.addListener("rightclick", async (e) => {
      if (readOnly) {
        alert("읽기 전용입니다. 공유 보기에서는 편집할 수 없어요.");
        return;
      }
      const latLng = e.latLng;
      if (!latLng) return;

      const [sd, ed] = dateRange;
      if (!(sd instanceof Date) || isNaN(sd) || !(ed instanceof Date) || isNaN(ed)) {
        alert("먼저 여행 날짜를 선택하세요.");
        return;
      }
      const days = getDaysArr(sd, ed);
      const travelDate = ymd(days[selectedDayIdxRef.current]);

      const basePin = {
        name: "직접 지정한 위치",
        address: `위도: ${latLng.lat().toFixed(5)}, 경도: ${latLng.lng().toFixed(5)}`,
        photo: null,
        position: { lat: latLng.lat(), lng: latLng.lng() },
        order: (pinsByDay[selectedDayIdxRef.current]?.length || 0) + 1,
        comment: "",
        googlePlaceId: "",
      };

      if (planId) {
        try {
          await createPlace(planId, {
            name: basePin.name,
            description: "",
            latitude: basePin.position.lat,
            longitude: basePin.position.lng,
            googlePlaceId: "",
            travelDate,
            orderInDay: basePin.order,
          });
          await refreshPinsFromServer();

        } catch (err) {
          console.error("자유핀 저장 실패:", err);
          alert("자유 핀 저장 실패: " + err.message);
        }
      } else {
        const localId = Date.now();
        setPinsByDay((prev) =>
          prev.map((arr, idx) => (idx === selectedDayIdxRef.current ? [...arr, { ...basePin, id: localId }] : arr))
        );
      }
    });

    hydrateSavedPinPhotos();
  };

  // 저장 핀 사진/주소 하이드레이션
  const hydrateSavedPinPhotos = () => {
    if (!mapRef.current || hydrationBusyRef.current) return;
    hydrationBusyRef.current = true;

    const service = new window.google.maps.places.PlacesService(mapRef.current);
    const dayIdx = selectedDayIdxRef.current;
    const dayPins = pinsByDay[dayIdx] || [];
    if (dayPins.length === 0) {
      hydrationBusyRef.current = false;
      return;
    }

    let nextDay = dayPins.slice();
    let mutated = false;

    const patchPin = (id, patch) => {
      const i = nextDay.findIndex((p) => p.id === id);
      if (i === -1) return;
      const before = nextDay[i];
      const after = { ...before, ...patch };
      if (before.photo !== after.photo || before.address !== after.address) {
        nextDay = nextDay.map((p, idx) => (idx === i ? after : p));
        mutated = true;
      }
    };

    const tasks = [];
    for (const pin of dayPins) {
      if (!pin.googlePlaceId) continue;

      const cachedPhoto = getCachedPhoto(pin.googlePlaceId);
      const cachedAddr = getCachedAddress(pin.googlePlaceId);

      if (cachedPhoto || cachedAddr) {
        patchPin(pin.id, { photo: pin.photo || cachedPhoto || null, address: pin.address || cachedAddr || "" });
      }

      const needPhoto = !cachedPhoto && !pin.photo;
      const needAddr = !cachedAddr && !pin.address;
      if (!needPhoto && !needAddr) continue;

      tasks.push(
        new Promise((resolve) => {
          service.getDetails(
            { placeId: pin.googlePlaceId, fields: ["photos", "formatted_address"] },
            (place, status) => {
              if (status === window.google.maps.places.PlacesServiceStatus.OK) {
                const url =
                  place?.photos?.[0]?.getUrl?.({ maxWidth: 800 }) ||
                  place?.photos?.[0]?.getUrl?.() ||
                  null;
                const addr = place?.formatted_address || "";
                if (url) setCachedPhoto(pin.googlePlaceId, url);
                if (addr) setCachedAddress(pin.googlePlaceId, addr);
                resolve({ id: pin.id, url, addr });
              } else resolve(null);
            }
          );
        })
      );
    }

    Promise.allSettled(tasks).then((results) => {
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          const { id, url, addr } = r.value;
          const cur = nextDay.find((p) => p.id === id);
          if (!cur) continue;
          patchPin(id, { photo: cur.photo || url || null, address: cur.address || addr || "" });
        }
      }
      hydrationBusyRef.current = false;
      if (!mutated) return;

      setPinsByDay((prev) => {
        const prevDay = prev[dayIdx] || [];
        if (prevDay === nextDay) return prev;
        const nextAll = prev.slice();
        nextAll[dayIdx] = nextDay;
        return nextAll;
      });
    });
  };

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;

    // 우선순위 조건이 하나라도 있으면 스킵
    const hasUrlCenter =
      Number.isFinite(parseFloat(clatFromQuery)) &&
      Number.isFinite(parseFloat(clngFromQuery));
    const hasInitialDest = !!initialDestination;
    const cached = readCenterCache();
    if (hasUrlCenter || hasInitialDest || cached) return;

    // 선택된 날짜 핀 -> 없으면 모든 날짜 핀
    const dayPins = (pinsByDay[selectedDayIdx] || []).map(p => p.position);
    const allPins = pinsByDay.flat().map(p => p.position);
    const pick = dayPins.length > 0 ? dayPins : allPins;

    if (pick.length === 0) return;

    // 핀이 1개면 그 핀으로 이동
    if (pick.length === 1) {
      const p = pick[0];
      applyCenter({ lat: p.lat, lng: p.lng }, 14, { shouldBroadcast: false });
      return;
    }

    // 여러 개면 bounds로 맞추기
    const bounds = new window.google.maps.LatLngBounds();
    for (const pos of pick) bounds.extend(new window.google.maps.LatLng(pos.lat, pos.lng));
    mapRef.current.fitBounds(bounds);

    // 너무 과도한 줌 보정(선택 사항)
    const z = mapRef.current.getZoom?.();
    if (typeof z === "number" && z > 16) mapRef.current.setZoom(16);

    // 캐시만 갱신(브로드캐스트 X)
    const c = mapRef.current.getCenter?.();
    if (c) {
      const centerPlain = { lat: c.lat(), lng: c.lng() };
      saveCenterCache(centerPlain, mapRef.current.getZoom?.() ?? 14);
    }
  }, [
    isLoaded,
    pinsByDay,
    selectedDayIdx,
    initialDestination,
    clatFromQuery,
    clngFromQuery
  ]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    hydrateSavedPinPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinsByDay, selectedDayIdx, isLoaded]);

  useEffect(() => {
    return () => {
      if (rightClickListenerRef.current) window.google.maps.event.removeListener(rightClickListenerRef.current);
      if (clickListenerRef.current) window.google.maps.event.removeListener(clickListenerRef.current);
      if (polylineRef.current) polylineRef.current.setMap(null);
    };
  }, []);

  // 핀 추가
  const handleAddPin = async () => {
    if (readOnly) {
      alert("읽기 전용입니다. 공유 보기에서는 편집할 수 없어요.");
      return;
    }
    if (!infoWindow && !searchResult) return;
    if (!hasValidDates) {
      alert("먼저 여행 날짜를 선택하세요.");
      return;
    }

    const data = infoWindow || searchResult;
    const position = toLatLngObj(data.position);
    const days = getDaysArr(startDate, endDate);
    const travelDate = ymd(days[selectedDayIdx]);

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
        await createPlace(planId, {
          name: basePin.name,
          description: "",
          latitude: position.lat,
          longitude: position.lng,
          googlePlaceId: basePin.googlePlaceId,
          travelDate,
          orderInDay: basePin.order,
        });
        await refreshPinsFromServer();

        if (activeCategory === "__recommended__" && showCategoryList) {
          handleNearbySearch("__recommended__", { forceRefresh: true });
        }
      } else {
        const localId = Date.now();
        setPinsByDay((prev) =>
          prev.map((arr, idx) => (idx === selectedDayIdx ? [...arr, { ...basePin, id: localId }] : arr))
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

  // 삭제
  const handleDeletePin = async (id) => {
    if (readOnly) {
      alert("읽기 전용입니다. 공유 보기에서는 편집할 수 없어요.");
      return;
    }
    if (planId) {
      try {
        await deletePlace(planId, id);
        await refreshPinsFromServer();

        if (activeCategory === "__recommended__" && showCategoryList) {
          handleNearbySearch("__recommended__", { forceRefresh: true });
        }
        return;
      } catch (e) {
        console.error("서버 삭제 실패:", e);
        alert("삭제 실패: " + (e?.message || "서버 오류"));
      }
    }
    setPinsByDay((prev) =>
      prev.map((arr, idx) =>
        idx === selectedDayIdx ? arr.filter((p) => p.id !== id).map((p, i) => ({ ...p, order: i + 1 })) : arr
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
    const location = toPlainLatLng(place.geometry.location);
    if (!location) return;
    const map = mapRef.current;

    setSearchResult({
      position: location,
      info: {
        placeId: place.place_id,
        name: place.name,
        address: place.formatted_address,
        photo:
          place.photos?.[0]?.getUrl?.({ maxWidth: 800 }) ||
          place.photos?.[0]?.getUrl?.() ||
          null,
      },
    });

    applyCenter(location, 15, { shouldBroadcast: true });
    setNearbyMarkers([]);
  };

  // PlacesService 재사용
  const serviceRef = useRef(null);

  // 주변 탐색(추천 포함)
  const handleNearbySearch = (type, { forceRefresh = false } = {}) => {
    if (!forceRefresh && activeCategory === type && showCategoryList) {
      setShowCategoryList(false);
      setNearbyMarkers([]);
      setActiveCategory(null);
      return;
    }

    setActiveCategory(type);
    setShowCategoryList(true);
    setNearbyMarkers([]);
    if (!mapRef.current) return;

    const map = mapRef.current;
    if (!serviceRef.current) serviceRef.current = new window.google.maps.places.PlacesService(map);
    const service = serviceRef.current;

    const c = map.getCenter();
    const centerPlain = toPlainLatLng(c) || { lat: c.lat(), lng: c.lng() };

    // 기본 구글 카테고리
    service.nearbySearch({ location: centerPlain, radius: 1200, type }, (results, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && results.length) {
        setNearbyMarkers(results.slice(0, 20));
      } else {
        setNearbyMarkers([]);
        alert("주변에 결과가 없습니다.");
      }
    });
  };

  // 상세 보기
  const showPlaceDetail = (place) => {
    const map = mapRef.current;
    if (!map) return;
    if (!serviceRef.current) serviceRef.current = new window.google.maps.places.PlacesService(map);
    const service = serviceRef.current;

    if (place.place_id) {
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
            const pos = toPlainLatLng(result.geometry.location);
            if (!pos) return;
            const freshPhoto =
              result.photos?.[0]?.getUrl?.({ maxWidth: 800 }) ||
              result.photos?.[0]?.getUrl?.() ||
              null;
            setInfoWindow({
              position: pos,
              info: {
                placeId: result.place_id,
                name: result.name,
                address: result.formatted_address,
                photo: freshPhoto,
                rating: result.rating,
                user_ratings_total: result.user_ratings_total,
                phone: result.formatted_phone_number,
              },
            });
          }
        }
      );
    } else {
      const pos = toPlainLatLng(place.geometry?.location);
      if (!pos) return;
      setInfoWindow({
        position: pos,
        info: { placeId: "", name: place.name ?? "추천 장소", address: "", photo: null },
      });
    }
  };

  // DnD
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const handleDragEnd = async ({ active, over }) => {
    if (readOnly) return;
    if (!over || String(active.id) === String(over.id)) return;
    const oldIndex = pins.findIndex((p) => String(p.id) === String(active.id));
    const newIndex = pins.findIndex((p) => String(p.id) === String(over.id));
    const newOrder = arrayMove(pins, oldIndex, newIndex).map((p, i) => ({ ...p, order: i + 1 }));
    setPinsByDay((prev) => prev.map((arr, idx) => (idx === selectedDayIdx ? newOrder : arr)));

    try {
      if (planId && hasValidDates) {
        const dayDate = ymd(getDaysArr(startDate, endDate)[selectedDayIdx]);
        await reorderPlaces(
          planId,
          dayDate,
          newOrder.map((p) => ({ placeId: p.id, orderInDay: p.order }))
        );
      }
    } catch (e) {
      console.error("reorder 실패:", e);
    }
  };

  if (!isLoaded) return <div>Loading...</div>;

  return (
    <div className={styles.page}>
      {/* ===== 왼쪽 패널 ===== */}
      <div className={styles.leftPanel}>
        <div className={styles.topActions}>
          <button type="button" onClick={() => navigate("/")} className={styles.logoBtn} aria-label="메인으로">
            <img src={michikiLogo} alt="Michiki" style={{ width: 36, height: 36 }} />
          </button>

          {/* 공유 버튼 - 서버 shareURI 기반 */}
          <button
            type="button"
            onClick={async () => {
              try {
                const effectiveShare = isSharedMode ? (shareURIFromRoute || shareUriState) : shareUriState;
                if (!effectiveShare) { alert("공유 링크를 불러오지 못했습니다."); return; }
                const shareUrl = `${window.location.origin}/share/${effectiveShare}`;
                await navigator.clipboard.writeText(shareUrl);
                alert("공유 링크가 클립보드에 복사되었습니다!");
              } catch {
                alert("복사 실패! (브라우저 권한 또는 HTTPS 환경 확인)");
              }
            }}
            className={styles.chipBtn}
          >
            {texts.share}
          </button>


          <button
            type="button"
            onClick={() => setShowPath((v) => !v)}
            className={`${styles.chipBtn} ${showPath ? styles.toggleOn : styles.toggle}`}
            title="동선 선(Polyline) 보이기/숨기기"
          >
            {showPath ? texts.pathOn : texts.pathOff}
          </button>

          {/* 방 나가기는 일반 모드에서만 */}
          {!isSharedMode && (
            <button
              type="button"
              disabled={!planId || isLeaving || readOnly}
              className={`${styles.chipBtn} ${styles.leaveBtn}`}
              onClick={async () => {
                if (readOnly) {
                  alert("로그인 후 이용할 수 있어요.");
                  return;
                }
                if (!planId) {
                  alert("플랜 ID가 없어 방을 나갈 수 없어요.");
                  return;
                }
                const ok = confirm("이 방을 나가시겠어요? (마지막 1인이라면 방이 삭제됩니다)");
                if (!ok) return;
                try {
                  setIsLeaving(true);
                  const msg = await leavePlan(planId);
                  alert(msg);
                  navigate("/dashboard", { replace: true });
                } catch (err) {
                  console.error("leave failed", err);
                  alert("방 나가기 실패: " + (err?.response?.data?.message || err?.message || "알 수 없는 오류"));
                } finally {
                  setIsLeaving(false);
                }
              }}
              title={readOnly ? "로그인 후 사용 가능" : !planId ? "플랜 ID 없음" : "방을 나갑니다"}
            >
              {isLeaving ? "나가는 중..." : texts.outRoom}
            </button>
          )}
        </div>

        <button
          type="button"
          className={`${styles.dateBtn} ${styles.dateLockedBtn}`}
          disabled
          aria-disabled="true"
        >
          {title || "여행"}
        </button>

        <div style={{ position: "relative", marginBottom: 1 }}>
          <button type="button" className={`${styles.dateBtn} ${styles.dateLockedBtn}`} disabled aria-disabled="true">
            {`${formatKDate(startDate)} ~ ${formatKDate(endDate)}`}
          </button>
        </div>

        {daysArr.length > 0 && (
          <div className={styles.dayDropdownWrap}>
            <button onClick={() => setShowDayDropdown((v) => !v)} className={styles.dayBtn}>
              {(() => {
                const d = daysArr[selectedDayIdx];
                const weekday = texts.weekdays[d.getDay()];
                const mmdd = `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
                return `${mmdd} (${weekday}) ▼`;
              })()}
            </button>
            {showDayDropdown && (
              <div className={styles.dayList}>
                {daysArr.map((d, idx) => {
                  const weekday = texts.weekdays[d.getDay()];
                  const mmdd = `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
                  const active = idx === selectedDayIdx;
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedDayIdx(idx);
                        setShowDayDropdown(false);
                      }}
                      className={`${styles.dayItem} ${active ? styles.dayItemActive : ""}`}
                    >
                      {mmdd} ({weekday}) {active && "✔"}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (searchResult) return handleAddPin();
            if (searchInput.trim() && geocoder && mapRef.current) {
              geocoder.geocode({ address: searchInput.trim() }, (results, status) => {
                if (status === "OK" && results[0]) {
                  const p = toPlainLatLng(results[0].geometry.location);
                  if (p) {
                    mapRef.current.panTo(p);
                    mapRef.current.setZoom(14);
                  }
                } else {
                  alert(texts.notFound);
                }
              });
            }
          }}
          className={styles.searchForm}
        >
          <Autocomplete onLoad={setAutocomplete} onPlaceChanged={onPlaceChanged}>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={texts.searchPlace}
              className={styles.searchInput}
            />
          </Autocomplete>
        </form>

        {/* 카테고리 장소 리스트 */}
        {showCategoryList && nearbyMarkers.length > 0 && (
          <div className={styles.nearbyList}>
            <div className={styles.nearbyTitle}>
              {activeCategory === "__recommended__" ? texts.recommended ?? "추천" : texts.searchResultTitle}
            </div>
            {nearbyMarkers.map((place, i) => (
              <div
                key={place.place_id || `nearby-${i}`}
                className={styles.nearbyItem}
                onClick={() => showPlaceDetail(place)}
              >
                <img
                  src={
                    place.photos && place.photos[0]
                      ? (place.photos[0].getUrl
                        ? place.photos[0].getUrl({ maxWidth: 120 })
                        : (place.photos[0].url || place.photos[0].uri))
                      : "https://via.placeholder.com/60?text=No+Image"
                  }
                  className={styles.nearbyThumb}
                  alt=""
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={styles.nearbyName}>{place.name}</div>

                  {activeCategory === "__recommended__" ? (
                    <div className={styles.nearbyMeta}>
                      ⭐ {place.__pinCount}
                      <span style={{ color: "#666", fontSize: 13, marginLeft: 6 }}>(핀찍힌 수)</span>
                    </div>
                  ) : (
                    place.rating && (
                      <div className={styles.nearbyMeta}>
                        ⭐ {place.rating}
                        <span style={{ color: "#666", fontSize: 13, marginLeft: 6 }}>
                          ({place.user_ratings_total ?? "?"}건)
                        </span>
                      </div>
                    )
                  )}

                  <div className={styles.nearbySub}>{place.vicinity || ""}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={styles.pinListHead}>
          {isLoadingPins && <span className={styles.pinLoading}>불러오는 중…</span>}
          {readOnly && <span style={{ marginLeft: 8, color: "#b3261e", fontSize: 12 }}>읽기 전용</span>}
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={pins.map((p) => String(p.id))} strategy={verticalListSortingStrategy}>
            <div style={{ flex: 1, overflowY: "auto", minHeight: 50 }}>
              {pins.map((pin, idx) => (
                <DraggablePin
                  key={pin.id}
                  pin={pin}
                  index={idx}
                  onClick={() => handlePinClick(pin)}
                  onDelete={() => handleDeletePin(pin.id)}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* ===== 지도 ===== */}
      <div className={styles.mapArea}>
        <CategoryButtons categories={categories} activeCategory={activeCategory} onClick={handleNearbySearch} />

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
            zoomControl: false,
            panControl: false,
            disableDefaultUI: true,
          }}
        >
          {/* 내 핀 */}
          {pins.map((pin, idx) => (
            <Marker
              key={pin.id}
              position={toLatLngObj(pin.position)}
              label={{ text: String(idx + 1), color: "#fff", fontWeight: "bold", fontSize: "14px" }}
              onClick={() => handlePinClick(pin)}
              onRightClick={() => handleDeletePin(pin.id)}
              icon={{
                url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
                labelOrigin: new window.google.maps.Point(15, 10),
              }}
            />
          ))}

          {/* 카테고리/추천 결과 */}
          {nearbyMarkers.map((place, i) => {
            const pos = toPlainLatLng(place.geometry?.location);
            if (!pos) return null;
            return (
              <Marker
                key={place.place_id || `nearby-${i}`}
                position={pos}
                icon={{ url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png" }}
                title={place.name}
                onClick={() => showPlaceDetail(place)}
              />
            );
          })}

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

          {/* 커서 레이어 */}
          <CursorLayer
            planId={planId}
            currentUser={user}
            isLoggedIn={!readOnly}
            roomKey={roomKey}
            map={mapInstance}
            colorsByMember={colorsByMember}
          />
        </GoogleMap>

        {/* 모달 */}
        <PinModal
          pin={selectedPin}
          open={modalOpen}
          onClose={handleModalClose}
          onCommentChange={async (comment) => {
            if (readOnly) {
              alert("읽기 전용입니다. 공유 보기에서는 편집할 수 없어요.");
              return;
            }
            setPinsByDay((arr) =>
              arr.map((pins, idx) =>
                idx !== selectedDayIdx ? pins : pins.map((p) => (p.id === selectedPin.id ? { ...p, comment } : p))
              )
            );
            setSelectedPin((p) => ({ ...p, comment }));
            try {
              if (planId) {
                await updatePlace(planId, selectedPin.id, { name: selectedPin.name || "장소", description: comment });
              }
            } catch (err) {
              console.error("메모 수정 실패:", err);
              alert("메모 수정 실패: " + err.message);
            }
          }}
          readOnly={readOnly}
        />
      </div>

      {/* 로그인 FAB: 읽기 전용이면(= 비로그인 또는 공유) 노출 */}
      {readOnly && (
        <InlineLoginFab
          onLoggedIn={async (u) => {
            setIsLoggedIn?.(true);
            setUser?.(u);

            // 공유 링크로 온 상태였다면, 먼저 자동 참여 시도 후 일반 라우트로 전환
            if (isSharedMode && shareURI) {
              try {
                const data = await getSharedPlan(encodeURIComponent(shareURI)); // 서버가 join 처리
                const joinedPlanId = data?.planId;
                if (joinedPlanId) {
                  navigate(`/schedule/${joinedPlanId}`, {
                    replace: true,
                    state: {
                      title: data?.title,
                      startDate: data?.startDate,
                      endDate: data?.endDate,
                      planId: joinedPlanId,
                    },
                  });
                  return;
                }
              } catch (e) {
                console.warn("re-join via shareURI failed:", e);
              }
            }

            // 일반 모드면 핀 갱신
            await refreshPinsFromServer?.();
          }}
          planId={planId}
        />
      )}

      {/* 일반 모드에서만 프레즌스 도크 */}
      {!isSharedMode && (
        <RoomPresenceDock
          roomKey={roomKey}
          currentUser={user}
          planId={planId}
          colorsByMember={colorsByMember}
          onColorSaved={({ memberId, color }) => {
            if (!memberId || !color) { return; }
            setMembers(prev =>
              prev.map(m =>
                String(m.memberId ?? m.id) === String(memberId)
                  ? { ...m, color }
                  : m
              )
            );
          }}
        />
      )}
    </div>
  );
}

export default ScheduleMap;