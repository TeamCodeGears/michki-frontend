import React, { useState, useRef, useEffect } from 'react';
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  InfoWindow,
  Autocomplete,
} from '@react-google-maps/api';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import michikiLogo from './assets/michiki-logo.png';

// DND-kit import
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

const GOOGLE_MAPS_API_KEY = 'AIzaSyDn1VXCTNaUR06NGsorLWChvsOKtsUrmH0';
const GOOGLE_MAPS_LIBRARIES = ['places'];

const containerStyle = {
  width: '100%',
  height: '100vh',
};

const center = {
  lat: 43.0687,
  lng: 141.3508,
};

const categories = [
  { label: "음식점", type: "restaurant", icon: "🍽️" },
  { label: "호텔", type: "lodging", icon: "🛏️" },
  { label: "즐길 거리", type: "tourist_attraction", icon: "📸" },
  { label: "박물관", type: "museum", icon: "🏛️" },
  { label: "대중교통", type: "transit_station", icon: "🚉" },
  { label: "약국", type: "pharmacy", icon: "💊" },
  { label: "ATM", type: "atm", icon: "🏧" },
];

function getDaysArr(startDate, endDate) {
  if (!startDate || !endDate) return [];
  const days = [];
  const cur = new Date(startDate);
  cur.setHours(0, 0, 0, 0);
  while (cur <= endDate) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// ----------- dnd-kit 용 SortableItem 컴포넌트 -----------
function SortablePin({ pin, index, onClick, onDelete, selected, listeners, attributes, setNodeRef, style, isDragging }) {
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        display: 'flex',
        alignItems: 'center',
        background: isDragging ? '#f0d8a8' : '#fff',
        color: '#333',
        marginBottom: 10,
        borderRadius: 14,
        padding: 10,
        cursor: 'pointer',
        boxShadow: '0 2px 8px #0002',
        position: 'relative',
        minHeight: 70,
        opacity: isDragging ? 0.6 : 1,
        ...style,
      }}
      onClick={onClick}
    >
      <div
        style={{
          width: 60,
          height: 60,
          background: '#eee',
          borderRadius: 12,
          backgroundImage: pin.photo ? `url(${pin.photo})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          marginRight: 10,
        }}
      ></div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{pin.name}</div>
        <div style={{ fontSize: 13, color: '#888' }}>
          {pin.comment || '메모 없음'}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: 'none',
          border: 'none',
          color: '#222',
          fontSize: 22,
          cursor: 'pointer',
          fontWeight: 700,
          lineHeight: 1,
        }}
        title="삭제"
      >
        ×
      </button>
      {/* 순번 뱃지 */}
      <div
        style={{
          position: 'absolute',
          right: 10,
          bottom: 10,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: '#f0d8a8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 600,
          fontSize: 18,
          zIndex: 1,
        }}
      >
        {index + 1}
      </div>
      {/* DND 핸들(왼쪽 끝에 조그맣게 표시, 없어도됨) */}
      <div style={{
        position: 'absolute',
        left: 4,
        top: '50%',
        transform: 'translateY(-50%)',
        color: '#aaa',
        fontSize: 20,
        cursor: 'grab',
        userSelect: 'none',
      }}>
        ≡
      </div>
    </div>
  );
}

function DraggablePin({ pin, index, onClick, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(pin.id) });
  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
    zIndex: isDragging ? 2 : 1,
  };
  return (
    <SortablePin
      pin={pin}
      index={index}
      onClick={onClick}
      onDelete={onDelete}
      listeners={listeners}
      attributes={attributes}
      setNodeRef={setNodeRef}
      style={style}
      isDragging={isDragging}
    />
  );
}

function ScheduleMap() {
  const [title, setTitle] = useState('여행');
  const [dateRange, setDateRange] = useState([null, null]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [pinsByDay, setPinsByDay] = useState([[]]);
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [showDayDropdown, setShowDayDropdown] = useState(false);

  const selectedDayIdxRef = useRef(selectedDayIdx);
  useEffect(() => { selectedDayIdxRef.current = selectedDayIdx; }, [selectedDayIdx]);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
  const [infoWindow, setInfoWindow] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [selectedPin, setSelectedPin] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [autocomplete, setAutocomplete] = useState(null);
  const [geocoder, setGeocoder] = useState(null);

  const mapRef = useRef(null);
  const rightClickListenerRef = useRef(null);
  const clickListenerRef = useRef(null);

  const [nearbyMarkers, setNearbyMarkers] = useState([]); // 임시 마커
  const [activeCategory, setActiveCategory] = useState(null);
  const [showCategoryList, setShowCategoryList] = useState(false); // 결과 목록 토글

  // === 동선(Polyline) 온오프 ===
  const [showPath, setShowPath] = useState(true);

  // pins을 최상단에서 선언! (아래에서 절대 선언하지 말 것)
  const pins = pinsByDay[selectedDayIdx] || [];

  // 날짜 바뀔 때 pinsByDay 동기화 & selectedDayIdx 안전처리
  useEffect(() => {
    const [start, end] = dateRange;
    if (!start || !end) {
      setPinsByDay([[]]);
      setSelectedDayIdx(0);
      return;
    }
    const daysArr = getDaysArr(start, end);
    setPinsByDay(prev => {
      if (prev.length !== daysArr.length) {
        return Array.from({ length: daysArr.length }, (_, i) => prev[i] || []);
      }
      return prev;
    });
    setSelectedDayIdx(idx => idx < daysArr.length ? idx : 0);
  }, [dateRange[0], dateRange[1]]);

  function toLatLngObj(pos) {
    if (!pos) return null;
    if (typeof pos.lat === 'function' && typeof pos.lng === 'function') {
      return { lat: pos.lat(), lng: pos.lng() };
    }
    return pos;
  }

  // 지도 Polyline 직접 관리
  const polylineRef = useRef(null);
  useEffect(() => {
    if (!mapRef.current) return;

    // Polyline 직접 생성/삭제
    if (showPath && pins.length > 1) {
      if (polylineRef.current) polylineRef.current.setMap(null);
      polylineRef.current = new window.google.maps.Polyline({
        path: pins.map((p) => toLatLngObj(p.position)),
        strokeColor: 'red',
        strokeWeight: 3,
        strokeOpacity: 1,
        clickable: false,
        map: mapRef.current,
      });
    } else {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    }
  }, [showPath, pins, mapRef.current]);

  // 지도 로딩시 리스너 등록 + Geocoder 등록
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
    clickListenerRef.current = map.addListener('click', (e) => {
      if (e.placeId) {
        e.stop();
        const service = new window.google.maps.places.PlacesService(map);
        service.getDetails(
          {
            placeId: e.placeId,
            fields: [
              'name', 'geometry', 'formatted_address', 'photos', 'rating',
              'user_ratings_total', 'types', 'formatted_phone_number'
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

    // 우클릭 핀
    rightClickListenerRef.current = map.addListener('rightclick', (e) => {
      const latLng = e.latLng;
      if (!latLng) return;
      setPinsByDay((prev) =>
        prev.map((pins, idx) =>
          idx === selectedDayIdxRef.current
            ? [
                ...pins,
                {
                  id: Date.now(),
                  name: '직접 지정한 위치',
                  address: `위도: ${latLng.lat().toFixed(5)}, 경도: ${latLng.lng().toFixed(5)}`,
                  photo: null,
                  position: { lat: latLng.lat(), lng: latLng.lng() },
                  order: pins.length + 1,
                  comment: '',
                },
              ]
            : pins
        )
      );
    });
  };

  // 카테고리 버튼 클릭시 주변 장소 검색 (선택 해제 기능 포함)
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
    const center = map.getCenter();

    service.nearbySearch(
      {
        location: center,
        radius: 1200,
        type,
      },
      (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results.length) {
          setNearbyMarkers(results.slice(0, 20));
        } else {
          setNearbyMarkers([]);
          alert("주변에 결과가 없습니다.");
        }
      }
    );
  };

  // 주변 장소 상세조회 (getDetails) → InfoWindow 스타일로 표시
  const showPlaceDetail = (place) => {
    const map = mapRef.current;
    if (!map) return;
    const service = new window.google.maps.places.PlacesService(map);
    service.getDetails(
      {
        placeId: place.place_id,
        fields: [
          'name', 'geometry', 'formatted_address', 'photos', 'rating',
          'user_ratings_total', 'types', 'formatted_phone_number'
        ]
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
            }
          });
        }
      }
    );
  };

  // 핀찍기 (선택 일차만)
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
                comment: '',
              },
            ]
          : pins
      )
    );
    setInfoWindow(null);
    setSearchResult(null);
    setSearchInput('');
  };

  // 핀 삭제
  const handleDeletePin = (id) => {
    setPinsByDay((prev) =>
      prev.map((pins, idx) =>
        idx === selectedDayIdx
          ? pins.filter((p) => p.id !== id).map((p, i) => ({ ...p, order: i + 1 }))
          : pins
      )
    );
  };

  // 상세 모달 등
  const handlePinClick = (pin) => {
    setSelectedPin(pin);
    setModalOpen(true);
  };
  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedPin(null);
  };

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

  // ------------------- DND kit 적용 -------------------
  // 왼쪽 일정 리스트 드래그앤드롭용 sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );
  // 드래그 종료시 순서 변경
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = pins.findIndex(p => String(p.id) === String(active.id));
    const newIndex = pins.findIndex(p => String(p.id) === String(over.id));
    const newOrder = arrayMove(pins, oldIndex, newIndex).map((p, i) => ({
      ...p,
      order: i + 1,
    }));

    setPinsByDay((prev) =>
      prev.map((dayPins, idx) =>
        idx === selectedDayIdx ? newOrder : dayPins
      )
    );
  };

  if (!isLoaded) return <div>Loading...</div>;

  const [startDate, endDate] = dateRange;
  const daysArr = getDaysArr(startDate, endDate);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#fffbe5' }}>
      {/* 왼쪽 패널 전체 */}
      <div
        style={{
          width: 350,
          background: '#fffaf0',
          color: '#333',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          borderRight: '1px solid #e2d5bb',
          boxSizing: 'border-box',
          zIndex: 100,
        }}
      >
        {/* 로고 + 공유버튼 + 동선 토글 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
          <img src={michikiLogo} alt="Michiki" style={{ width: 36, height: 36 }} />
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(window.location.href);
                alert('일정이 클립보드에 복사되었습니다!');
              } catch {
                alert('복사 실패! (브라우저 권한 또는 HTTPS 환경 확인)');
              }
            }}
            style={{
              background: '#e7d3b5',
              color: '#222',
              border: 'none',
              borderRadius: 8,
              padding: '7px 13px',
              fontWeight: 600,
              fontSize: 14,
              height: 34,
              minWidth: 52,
              cursor: 'pointer',
            }}
          >
            공유
          </button>
          <button
            type="button"
            onClick={() => setShowPath(v => !v)}
            style={{
              background: showPath ? '#f0d8a8' : '#e2d5bb',
              color: '#222',
              border: 'none',
              borderRadius: 8,
              padding: '7px 13px',
              fontWeight: 600,
              fontSize: 14,
              height: 34,
              minWidth: 52,
              cursor: 'pointer',
              marginLeft: 0
            }}
            title="동선 선(Polyline) 보이기/숨기기"
          >
            {showPath ? '동선 ON' : '동선 OFF'}
          </button>
        </div>

        {/* 카테고리 탐색 결과 */}
        {showCategoryList && nearbyMarkers.length > 0 && (
          <div style={{
            maxHeight: 400, overflowY: "auto", marginBottom: 16, marginTop: 4,
            background: "#fff", borderRadius: 10, boxShadow: "0 2px 6px #0001", padding: 8
          }}>
            <div style={{fontWeight:700, margin: "7px 0 8px 5px", fontSize: 16}}>검색 결과</div>
            {nearbyMarkers.map(place => (
              <div
                key={place.place_id}
                style={{
                  display: "flex", alignItems: "center", marginBottom: 13,
                  borderBottom: "1px solid #eee", paddingBottom: 8, cursor: "pointer"
                }}
                onClick={() => showPlaceDetail(place)}
              >
                <img src={
                  place.photos && place.photos[0] ? place.photos[0].getUrl() :
                  "https://via.placeholder.com/60?text=No+Image"
                } style={{
                  width: 60, height: 60, borderRadius: 9, objectFit: "cover", marginRight: 13
                }} alt=""/>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontWeight:600, fontSize:15, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>
                    {place.name}
                  </div>
                  {place.rating &&
                    <div style={{color:"#dc143c", fontSize:14}}>
                      ⭐ {place.rating}
                      <span style={{color:"#666", fontSize:13, marginLeft:6}}>({place.user_ratings_total}건)</span>
                    </div>
                  }
                  <div style={{fontSize:12, color:"#888", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>
                    {place.vicinity}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 방 제목 */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{
            fontWeight: 600,
            fontSize: 18,
            background: '#e7d3b5',
            border: 'none',
            borderRadius: 10,
            padding: '9px 15px',
            width: '100%',
            marginBottom: 6,
            boxSizing: 'border-box',
          }}
          maxLength={30}
          placeholder="방 이름을 입력하세요"
        />

        {/* 날짜 선택 */}
        <div style={{ position: 'relative', marginBottom: 1 }}>
          <button
            type="button"
            onClick={() => setShowDatePicker((v) => !v)}
            style={{
              background: '#e7d3b5',
              border: 'none',
              borderRadius: 10,
              padding: '9px 15px',
              fontWeight: 600,
              fontSize: 16,
              color: '#222',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
            }}
          >
            {startDate && endDate
              ? `${startDate.toLocaleDateString('ko-KR').replace(/\./g, '.').replace(/\s/g, '')} ~ ${endDate.toLocaleDateString('ko-KR').replace(/\./g, '.').replace(/\s/g, '')}`
              : '여행 날짜 선택'}
          </button>
          {showDatePicker && (
            <div
              style={{
                position: 'absolute',
                top: 45,
                left: 0,
                zIndex: 100,
              }}
            >
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

        {/* 일차 선택 버튼 */}
        {daysArr.length > 0 && (
          <div style={{ marginBottom: 5, position: 'relative' }}>
            <button
              onClick={() => setShowDayDropdown((v) => !v)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                background: '#e7d3b5',
                color: '#222',
                border: 'none',
                borderRadius: 8,
                padding: '8px 15px',
                fontWeight: 600,
                fontSize: 16,
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
            >
              {(() => {
                const thisDate = daysArr[selectedDayIdx];
                const weekday = ['일', '월', '화', '수', '목', '금', '토'][thisDate.getDay()];
                const mmdd = `${String(thisDate.getMonth() + 1).padStart(2, '0')}.${String(thisDate.getDate()).padStart(2, '0')}`;
                return `${mmdd} (${weekday}) ▼`;
              })()}
            </button>
            {showDayDropdown && (
              <div style={{
                background: '#fffbe5',
                position: 'absolute',
                borderRadius: 8,
                boxShadow: '0 2px 10px #0002',
                zIndex: 20,
                marginTop: 2,
                width: '100%',
              }}>
                {daysArr.map((d, idx) => {
                  const weekday = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
                  const mmdd = `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedDayIdx(idx);
                        setShowDayDropdown(false);
                      }}
                      style={{
                        padding: 11,
                        cursor: 'pointer',
                        fontWeight: idx === selectedDayIdx ? 700 : 400,
                        background: idx === selectedDayIdx ? '#f0d8a8' : undefined,
                        color: '#222',
                      }}
                    >
                      {mmdd} ({weekday}) {idx === selectedDayIdx && '✔'}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 검색 폼 */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (searchResult) {
              handleAddPin();
              return;
            }
            if (searchInput.trim() && geocoder && mapRef.current) {
              geocoder.geocode({ address: searchInput.trim() }, (results, status) => {
                if (status === 'OK' && results[0]) {
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
                    }
                  });
                } else {
                  alert('해당 지역을 찾을 수 없습니다.');
                }
              });
            }
          }}
          style={{ display: 'flex', marginBottom: 6 }}
        >
          <Autocomplete
            onLoad={onLoadAutocomplete}
            onPlaceChanged={onPlaceChanged}
            style={{ width: '100%' }}
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
                border: '1px solid #bbb',
                fontSize: 15,
              }}
            />
          </Autocomplete>
        </form>
        {/* 일정 리스트 - DND kit 적용 */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={pins.map(p=>String(p.id))} strategy={verticalListSortingStrategy}>
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 50 }}>
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
      {/* 지도 */}
      <div style={{ flex: 1, position: 'relative', overflow: "hidden" }}>
        {/* 상단 카테고리 버튼 바 */}
        <div style={{
          display: "flex",
          gap: 14,
          padding: "16px 0 10px 20px",
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          minHeight: 60,
          alignItems: "center"
        }}>
          {categories.map(cat => (
            <button
              key={cat.type}
              onClick={() => handleNearbySearch(cat.type)}
              style={{
                border: "none",
                outline: "none",
                background: activeCategory === cat.type ? "#fffbe5" : "#fff",
                color: "#222",
                borderRadius: 22,
                padding: "8px 18px 8px 12px",
                boxShadow: "0 1px 8px #0002",
                fontSize: 15,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 7,
                cursor: "pointer",
                transition: "background 0.2s"
              }}>
              <span style={{ fontSize: 19, marginRight: 2 }}>{cat.icon}</span> {cat.label}
            </button>
          ))}
        </div>
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
          {/* 일정 핀(순번) */}
          {pins.map((pin) => (
            <Marker
              key={pin.id}
              position={toLatLngObj(pin.position)}
              label={{
                text: `${pin.order}`,
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '16px',
              }}
              onClick={() => handlePinClick(pin)}
              onRightClick={() => handleDeletePin(pin.id)}
              icon={{
                url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                labelOrigin: { x: 15, y: 10 },
              }}
            />
          ))}
          {/* 카테고리 검색 결과 임시 마커 */}
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
          {/* InfoWindow */}
          {(infoWindow || searchResult) && (
            <InfoWindow
              position={toLatLngObj(
                (infoWindow || searchResult).position
              )}
              onCloseClick={() => {
                setInfoWindow(null);
                setSearchResult(null);
              }}
            >
              <div style={{
                minWidth: 320,
                maxWidth: 390,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                fontFamily: 'Pretendard, Noto Sans KR, Arial, sans-serif',
              }}>
                {(infoWindow || searchResult).info.photo &&
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
                  />}
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontWeight: 700,
                    fontSize: 18,
                    marginBottom: 6,
                    lineHeight: 1.3,
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}>
                    {(infoWindow || searchResult).info.name}
                  </div>
                  {(infoWindow || searchResult).info.rating && (
                    <div style={{ color: "#dc143c", fontWeight: 600, marginBottom: 3 }}>
                      ⭐ {(infoWindow || searchResult).info.rating}
                      <span style={{ color: "#666", fontWeight: 400, marginLeft: 7 }}>
                        ({(infoWindow || searchResult).info.user_ratings_total}건)
                      </span>
                    </div>
                  )}
                  <div style={{
                    fontSize: 14,
                    color: "#555",
                    marginBottom: 2,
                    whiteSpace: "pre-line"
                  }}>
                    {(infoWindow || searchResult).info.address}
                  </div>
                  {(infoWindow || searchResult).info.phone && (
                    <div style={{ fontSize: 14, color: "#555", marginBottom: 2 }}>
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
                      background: '#f0d8a8',
                      border: 'none',
                      borderRadius: 8,
                      padding: '7px 22px',
                      cursor: 'pointer',
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
        {/* 상세 모달 */}
        {modalOpen && selectedPin && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                minWidth: 400,
                minHeight: 320,
                background: '#fff',
                borderRadius: 24,
                boxShadow: '0 4px 24px #0005',
                padding: 32,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                position: 'relative',
              }}
            >
              <button
                onClick={handleModalClose}
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  border: 'none',
                  background: 'transparent',
                  fontSize: 24,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 20,
                  marginBottom: 10,
                }}
              >
                {selectedPin.name}
              </div>
              <img
                src={
                  selectedPin.photo ||
                  'https://via.placeholder.com/200x120?text=No+Image'
                }
                alt=""
                style={{
                  width: 200,
                  borderRadius: 12,
                  marginBottom: 12,
                }}
              />
              <textarea
                value={selectedPin.comment}
                onChange={(e) => {
                  setPinsByDay((arr) =>
                    arr.map((pins, idx) =>
                      idx !== selectedDayIdx
                        ? pins
                        : pins.map((p) =>
                            p.id === selectedPin.id
                              ? { ...p, comment: e.target.value }
                              : p
                          )
                    )
                  );
                  setSelectedPin((p) => ({
                    ...p,
                    comment: e.target.value,
                  }));
                }}
                placeholder="여기에 메모나 일정을 입력하세요!"
                style={{
                  width: '100%',
                  minHeight: 80,
                  border: '1px solid #ccc',
                  borderRadius: 8,
                  padding: 10,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ScheduleMap;
