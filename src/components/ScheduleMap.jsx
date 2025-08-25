// src/components/ScheduleMap.jsx
import { useState, useRef, useEffect, useContext, useMemo } from "react";
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from "@react-google-maps/api";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";

import styles from "./ScheduleMap.module.css";

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
  recommendPlaces,
} from "../api/place";
import { leavePlan } from "../api/plans";
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
    id: p.id,
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

// ---- 사진/주소 캐시 ----
const getCachedPhoto = (pid) => {
  try {
    return localStorage.getItem(`placePhoto:${pid}`) || null;
  } catch {
    return null;
  }
};
const setCachedPhoto = (pid, url) => {
  try {
    localStorage.setItem(`placePhoto:${pid}`, url);
  } catch {}
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
    localStorage.setItem(`placeAddr:${pid}`, a);
  } catch {}
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
  useEffect(() => {
    document.body.classList.add("hide-native-cursor");
    return () => document.body.classList.remove("hide-native-cursor");
  }, []);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoggedIn, setIsLoggedIn, setUser } = useOutletContext() || {};
  const { planId: planIdFromParam } = useParams();

  const { destination, title: incomingTitle, startDate: incomingStart, endDate: incomingEnd, planId: planIdFromState } =
    location.state || {};

  const qs = new URLSearchParams(location.search);
  const planIdFromQuery = qs.get("planId") || undefined;
  const sdFromQuery = qs.get("sd");
  const edFromQuery = qs.get("ed");
  const titleFromQuery = qs.get("t");

  const planId = planIdFromParam || planIdFromState || planIdFromQuery || undefined;
  const roomKey = useMemo(
    () => planId || destination || location.pathname || "schedule-room",
    [planId, destination, location.pathname]
  );

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

  const isReadOnly = !isLoggedIn;

  // 목적지 이동
  useEffect(() => {
    if (!destination || !geocoder || !mapRef.current) return;
    geocoder.geocode({ address: destination }, (results, status) => {
      if (status === "OK" && results[0]) {
        const p = toPlainLatLng(results[0].geometry.location);
        if (p) {
          mapRef.current.panTo(p);
          mapRef.current.setZoom(14);
        }
      }
    });
  }, [destination, geocoder]);

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
    if (destination) setSearchInput(destination);
  }, [incomingTitle, incomingStart, incomingEnd, destination, sdFromQuery, edFromQuery, titleFromQuery]);

  // 플랜 정보 로드
  useEffect(() => {
    const needsFetch = planId && !(incomingTitle && incomingStart && incomingEnd);
    if (!needsFetch || !API_BASE) return;

    const token = localStorage.getItem("accessToken");

    (async () => {
      try {
        const headers = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${API_BASE}/plans/${planId}`, { headers });
        if (!res.ok) throw new Error(`GET /plans/${planId} ${res.status}`);
        const data = await res.json();
        setTitle(data.title ?? "여행");
        if (data.startDate && data.endDate) setDateRange([new Date(data.startDate), new Date(data.endDate)]);
      } catch (err) {
        console.error("플랜 로드 실패:", err);
      }
    })();
  }, [planId, incomingTitle, incomingStart, incomingEnd]);

  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY, libraries: GOOGLE_MAPS_LIBRARIES });

  const selectedDayIdxRef = useRef(selectedDayIdx);
  useEffect(() => {
    selectedDayIdxRef.current = selectedDayIdx;
  }, [selectedDayIdx]);

  const [startDate, endDate] = dateRange;
  const hasValidDates = startDate instanceof Date && !isNaN(startDate) && endDate instanceof Date && !isNaN(endDate);
  const daysArr = hasValidDates ? getDaysArr(startDate, endDate) : [];
  const pins = pinsByDay[selectedDayIdx] || [];

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
    if (!planId || !hasValidDates) return;
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
  }, [planId, roomKey, hasValidDates, startDate, endDate]); // eslint-disable-line

  // 로컬 저장
  useEffect(() => {
    if (!hasValidDates || planId) return;
    localStorage.setItem(lsKey(roomKey), JSON.stringify(pinsByDay));
  }, [pinsByDay, planId, roomKey, hasValidDates]);

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
            setInfoWindow({
              position: pos,
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

    // 우클릭 → 자유 핀
    rightClickListenerRef.current = map.addListener("rightclick", async (e) => {
      if (isReadOnly) {
        alert("로그인 후 이용할 수 있어요.");
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

          // 추천 탭 열려 있으면 새로고침 (닫지 않음)
          if (activeCategory === "__recommended__" && showCategoryList) {
            handleNearbySearch("__recommended__", { forceRefresh: true });
          }
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

    // 캐시 반영
    for (const pin of dayPins) {
      if (!pin.googlePlaceId) continue;
      const cachedPhoto = getCachedPhoto(pin.googlePlaceId);
      const cachedAddr = getCachedAddress(pin.googlePlaceId);
      if (cachedPhoto || cachedAddr) {
        patchPin(pin.id, { photo: pin.photo || cachedPhoto || null, address: pin.address || cachedAddr || "" });
      }
    }

    // 네트워크 조회
    const tasks = [];
    for (const pin of dayPins) {
      if (!pin.googlePlaceId) continue;
      const needPhoto = !pin.photo && !getCachedPhoto(pin.googlePlaceId);
      const needAddr = !pin.address && !getCachedAddress(pin.googlePlaceId);
      if (!needPhoto && !needAddr) continue;

      tasks.push(
        new Promise((resolve) => {
          service.getDetails(
            { placeId: pin.googlePlaceId, fields: ["photos", "formatted_address"] },
            (place, status) => {
              if (status === window.google.maps.places.PlacesServiceStatus.OK) {
                const url = place?.photos?.[0]?.getUrl() || null;
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

  // 핀 추가 (정보창/검색결과)
  const handleAddPin = async () => {
    if (isReadOnly) {
      alert("로그인 후 이용할 수 있어요.");
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

        // 추천 탭 열려 있으면 새로고침 (닫지 않음)
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
    if (isReadOnly) {
      alert("로그인 후 이용할 수 있어요.");
      return;
    }
    if (planId) {
      try {
        await deletePlace(planId, id);
        await refreshPinsFromServer();

        // 추천 탭 열려 있으면 새로고침 (닫지 않음)
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
        photo: place.photos?.[0]?.getUrl() ?? null,
      },
    });

    map.panTo(location);
    map.setZoom(15);
    setNearbyMarkers([]);
  };

  // PlacesService 재사용
  const serviceRef = useRef(null);

  // 주변 탐색(추천 포함) — forceRefresh 추가: 열려 있어도 새로고침
  const handleNearbySearch = (type, { forceRefresh = false } = {}) => {
    // 같은 버튼 다시 누르면 닫기 (단, 강제 새로고침이면 닫지 않음)
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

    // ⭐ 추천: 서버 DTO(centerLatitude, centerLongitude, zoomLevel)로 호출
    if (type === "__recommended__") {
      (async () => {
        try {
          if (!planId) {
            alert("플랜 ID가 없어 추천을 불러올 수 없어요.");
            return;
          }
          const zoomLevel = Math.round(map.getZoom?.() ?? 14);

          const res = await recommendPlaces(planId, {
            centerLatitude: centerPlain.lat,
            centerLongitude: centerPlain.lng,
            zoomLevel,
          });
          const arr = Array.isArray(res) ? res : res ? [res] : [];

          // 서버 누적 카운트 필드 사용
          const pinCountOf = (r) =>
            Number(r.pinCount ?? r.count ?? r.total ?? r.hits ?? r.frequency ?? r.numPins ?? r.placeCount ?? 0) || 0;

          const top3 = arr
            .map((r) => ({ ...r, __pinCount: pinCountOf(r) }))
            .sort((a, b) => b.__pinCount - a.__pinCount)
            .slice(0, 3);

          // 구글 디테일 보강
          const enrichOne = (item) =>
            new Promise((resolve) => {
              if (item.googlePlaceId) {
                service.getDetails(
                  {
                    placeId: item.googlePlaceId,
                    fields: ["name", "geometry", "photos", "rating", "user_ratings_total", "vicinity", "place_id"],
                  },
                  (place, status) => {
                    if (status === window.google.maps.places.PlacesServiceStatus.OK) {
                      resolve({ ...place, __isRecommended: true, __pinCount: item.__pinCount });
                    } else {
                      resolve({
                        place_id: item.googlePlaceId,
                        name: item.name ?? "추천 장소",
                        geometry: { location: new window.google.maps.LatLng(item.latitude, item.longitude) },
                        __isRecommended: true,
                        __pinCount: item.__pinCount,
                      });
                    }
                  }
                );
              } else {
                resolve({
                  place_id: `reco-${item.latitude},${item.longitude}`,
                  name: item.name ?? "추천 장소",
                  geometry: { location: new window.google.maps.LatLng(item.latitude, item.longitude) },
                  __isRecommended: true,
                  __pinCount: item.__pinCount,
                });
              }
            });

          const results = await Promise.all(top3.map(enrichOne));
          setNearbyMarkers(results);
          setShowCategoryList(true);
        } catch (e) {
          console.error("추천 불러오기 실패:", e);
          alert("추천 장소를 불러오지 못했어요.");
        }
      })();
      return;
    }

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
            setInfoWindow({
              position: pos,
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
    if (isReadOnly) return;
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

          <button
            type="button"
            onClick={async () => {
              try {
                const url = new URL(window.location.href);
                if (planId && startDate && endDate) {
                  url.searchParams.set("sd", ymd(startDate));
                  url.searchParams.set("ed", ymd(endDate));
                  url.searchParams.set("t", title || "여행");
                }
                await navigator.clipboard.writeText(url.toString());
                alert("일정이 클립보드에 복사되었습니다!");
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

          <button
            type="button"
            disabled={!planId || isLeaving || isReadOnly}
            className={`${styles.chipBtn} ${styles.leaveBtn}`}
            onClick={async () => {
              if (isReadOnly) {
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
                await leavePlan(planId);
                alert("방 나가기 완료");
                navigate("/dashboard", { replace: true });
              } catch (err) {
                console.error("leave failed", err);
                alert("방 나가기 실패: " + (err?.response?.data?.message || err?.message || "알 수 없는 오류"));
              } finally {
                setIsLeaving(false);
              }
            }}
            title={isReadOnly ? "로그인 후 사용 가능" : !planId ? "플랜 ID 없음" : "방을 나갑니다"}
          >
            {isLeaving ? "나가는 중..." : texts.outRoom}
          </button>
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

        {/* 주변/추천 리스트 */}
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
                      ? place.photos[0].getUrl?.() ?? place.photos[0].getUrl?.({ maxWidth: 120 })
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
          {isReadOnly && <span style={{ marginLeft: 8, color: "#b3261e", fontSize: 12 }}>읽기 전용(로그인 필요)</span>}
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
                  readOnly={isReadOnly}
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
          {/* 내 핀(빨간 마커) */}
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

          {/* 카테고리/추천 결과(파란 마커) */}
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

          <CursorLayer planId={planId} currentUser={user} isLoggedIn={!!isLoggedIn} roomKey={roomKey} map={mapInstance} />
        </GoogleMap>

        {/* 모달 */}
        <PinModal
          pin={selectedPin}
          open={modalOpen}
          onClose={handleModalClose}
          onCommentChange={async (comment) => {
            if (isReadOnly) {
              alert("로그인 후 이용할 수 있어요.");
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
          readOnly={isReadOnly}
        />
      </div>

      <RoomPresenceDock roomKey={roomKey} currentUser={user} planId={planId} />

      {isReadOnly && (
        <InlineLoginFab
          onLoggedIn={(u) => {
            setIsLoggedIn?.(true);
            setUser?.(u);
            refreshPinsFromServer?.();
          }}
          planId={planId}
        />
      )}
    </div>
  );
}

export default ScheduleMap;