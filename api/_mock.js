// 임시 여행 데이터 (실제 DB에 저장될 데이터와 모양이 같다고 가정)
const mockTripData = {
  myTrips: [
    { id: 'trip1', name: '내 여행 1', date: '2025/07/01 ~ 2025/07/05' },
    { id: 'trip2', name: '내 여행 2', date: '2025/06/15 ~ 2025/06/20' },
  ],
  pastTrips: [
    { id: 'trip3', name: '지난 여행 1', date: '2025/05/01 ~ 2025/05/05' },
    { id: 'trip4', name: '지난 여행 2', date: '2025/04/15 ~ 2025/04/20' },
  ],
};

// 가짜 API 함수: 0.5초 후에 임시 데이터를 반환합니다.
export const fetchTrips = () => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(mockTripData);
    }, 500); // 0.5초 지연
  });
};