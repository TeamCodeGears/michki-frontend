import React, { useState, useRef, useEffect } from 'react';
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Polyline,
  InfoWindow,
  Autocomplete,
} from '@react-google-maps/api';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import michikiLogo from './assets/michiki-logo.png';

const GOOGLE_MAPS_API_KEY = 'AIzaSyDn1VXCTNaUR06NGsorLWChvsOKtsUrmH0';

const containerStyle = {
  width: '100%',
  height: '100vh',
};

const center = {
  lat: 43.0687,
  lng: 141.3508,
};

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

function ScheduleMap() {
  const [title, setTitle] = useState('여행');
  const [dateRange, setDateRange] = useState([null, null]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [pinsByDay, setPinsByDay] = useState([[]]);
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [showDayDropdown, setShowDayDropdown] = useState(false);

  // 최신 일차 index 참조 ref (우클릭 이슈 해결용)
  const selectedDayIdxRef = useRef(selectedDayIdx);
  useEffect(() => {
    selectedDayIdxRef.current = selectedDayIdx;
  }, [selectedDayIdx]);

  // 지도/검색 상태
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: ['places'],
  });
  const [infoWindow, setInfoWindow] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [selectedPin, setSelectedPin] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [autocomplete, setAutocomplete] = useState(null);
  const mapRef = useRef(null);
  const rightClickListenerRef = useRef(null);
  const clickListenerRef = useRef(null);

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

  // 복사 텍스트
  const getPinShareText = () => {
    const [startDate, endDate] = dateRange;
    const daysArr = getDaysArr(startDate, endDate);
    return (
      `${title}\n` +
      (startDate && endDate
        ? `${startDate.toLocaleDateString('ko-KR').replace(/\./g, '.').replace(/\s/g, '')} ~ ${endDate.toLocaleDateString('ko-KR').replace(/\./g, '.').replace(/\s/g, '')}\n`
        : '') +
      (pinsByDay.length
        ? pinsByDay
            .map(
              (pins, idx) =>
                `${daysArr[idx] ? daysArr[idx].toLocaleDateString('ko-KR').replace(/\./g, '.').replace(/\s/g, '') : `${idx + 1}일차`}:\n` +
                (pins.length
                  ? pins
                      .map(
                        (p, i) =>
                          `  ${i + 1}. ${p.name} (${p.position.lat}, ${p.position.lng})${p.comment ? ` - ${p.comment}` : ''}`
                      )
                      .join('\n')
                  : '  장소 없음')
            )
            .join('\n\n')
        : '등록된 일정이 없습니다.')
    );
  };

  // 항상 {lat, lng} 변환
  function toLatLngObj(pos) {
    if (!pos) return null;
    if (typeof pos.lat === 'function' && typeof pos.lng === 'function') {
      return { lat: pos.lat(), lng: pos.lng() };
    }
    return pos;
  }

  // 지도 로딩시 리스너 등록
  const onLoadMap = (map) => {
    mapRef.current = map;

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
            fields: ['name', 'geometry', 'formatted_address', 'photos'],
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
                },
              });
            }
          }
        );
      }
    });

    // **여기서 최신 selectedDayIdxRef.current 사용!**
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
  };

  if (!isLoaded) return <div>Loading...</div>;

  const [startDate, endDate] = dateRange;
  const daysArr = getDaysArr(startDate, endDate);
  const pins = pinsByDay[selectedDayIdx] || [];

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#fffbe5' }}>
      {/* 왼쪽 패널 */}
      <div
        style={{
          width: 320,
          background: '#fffaf0',
          color: '#333',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          borderRight: '1px solid #e2d5bb',
          boxSizing: 'border-box',
        }}
      >
        {/* 로고 + 공유버튼 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <img src={michikiLogo} alt="Michiki" style={{ width: 36, height: 36 }} />
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(getPinShareText());
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
              marginLeft: 8,
              marginTop: 2,
              height: 34,
              minWidth: 52,
              cursor: 'pointer',
            }}
          >
            공유
          </button>
        </div>

        {/* 방 제목 */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{
            fontWeight: 700,
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
              fontWeight: 500,
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
                fontWeight: 700,
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
          onSubmit={(e) => {
            e.preventDefault();
            handleAddPin();
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
        {/* 일정 리스트 */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {pins.map((pin) => (
            <div
              key={pin.id}
              onClick={() => handlePinClick(pin)}
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#fff',
                color: '#333',
                marginBottom: 10,
                borderRadius: 14,
                padding: 10,
                cursor: 'pointer',
                boxShadow: '0 2px 8px #0002',
                position: 'relative',
                minHeight: 70,
              }}
            >
              <div
                style={{
                  width: 60,
                  height: 60,
                  background: '#eee',
                  borderRadius: 12,
                  backgroundImage: pin.photo
                    ? `url(${pin.photo})`
                    : undefined,
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
              {/* 삭제(X) 버튼 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeletePin(pin.id);
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
              {/* 우측 하단 끝에 순번 뱃지 */}
              <div
                style={{
                  position: 'absolute',
                  right: 10,
                  bottom: 10,
                  width: 32,
                  height: 32,
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
                {pin.order}
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* 지도 */}
      <div style={{ flex: 1, position: 'relative' }}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={14}
          onLoad={onLoadMap}
        >
          <Polyline
            path={pins.map((p) => toLatLngObj(p.position))}
            options={{
              strokeColor: 'red',
              strokeWeight: 3,
              strokeOpacity: 1,
              clickable: false,
            }}
          />
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
              <div>
                <div style={{ fontWeight: 600 }}>
                  {(infoWindow || searchResult).info.name}
                </div>
                <div style={{ fontSize: 13, marginBottom: 4 }}>
                  {(infoWindow || searchResult).info.address}
                </div>
                {(infoWindow || searchResult).info.photo && (
                  <img
                    src={(infoWindow || searchResult).info.photo}
                    alt=""
                    style={{
                      width: 160,
                      borderRadius: 8,
                      marginBottom: 6,
                    }}
                  />
                )}
                <button
                  onClick={handleAddPin}
                  style={{
                    background: '#f0d8a8',
                    border: 'none',
                    borderRadius: 8,
                    padding: '6px 20px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    marginTop: 8,
                  }}
                >
                  핀찍기
                </button>
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
