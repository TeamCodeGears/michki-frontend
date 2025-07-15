import './DashboardPage.css';
import osakaImage from '../assets/Osaka.jpg'; // 오사카 이미지 불러오기

function DashboardPage() {

    // 임시로 보여줄 여행 데이터
    const trips = [
        { name : '내 여행 1', date : '2025/06/08 ~ 2025/06/13' },
        { name : '내 여행 2', date : '2025/07/01 ~ 2025/07/05' },
    ];
    const pastTrips = [
        { name : '지난 여행 1', date : '2025/05/01 ~ 2025/05/05' },
        { name : '지난 여행 2', date : '2025/04/15 ~ 2025/04/20' },
    ];

    return (
        <div className = "dashboard-container">
            { /*왼쪽에 위치한 사이드 바 */ }
            <aside className = "sidebar">
                <div className = "year-selector"> 2025 ▼ </div>
                <div className = "trip-list">
                    {trips.map(trip => (
                        <div key = {trip.name} className = "trip-item">
                            <span className = "trip-name"> {trip.name} </span>
                            <span className = "trip-date"> {trip.date} </span>
                        </div>
                    ))}
                    {pastTrips.map (trip => (
                        <div key = {trip.name} className = "trip-item past">
                            <span className = "trip-name"> {trip.name} </span>
                            <span className = "trip-date"> {trip.date} </span>
                        </div>
                    ))}
                    </div>
                </aside>

            { /*오른쪽에 위치한 메인 컨텐츠 영역 */ }
                <main className = "main-content">
                    <div className = "search-bar">
                        <input type = "text" placeholder = "도시 명을 검색해보세요." />
                        <div className = "search-button-wrapper">
                        <button className = "search-button"> 🔍 </button>
                        </div>
                    </div>
                    <div className = "country-tabs">
                        <button className = "tab-item active"> 일본 </button>
                        <button className = "tab-item"> 한국 </button>
                    </div>
                    <div className = "destination-grid">
                        <div className = "destination-card">
                            <img src = {osakaImage} alt = "오사카" />
                            <div className = "card-title"> 오사카 </div>
                            <div className = "card-subtitle"> Osaka </div>
                            </div>
                            
                            <div className = "destination-card">
                            <img src = {osakaImage} alt = "도쿄" />
                            <div className = "card-title"> 도쿄 </div>
                            <div className = "card-subtitle"> Tokyo </div>
                            </div>

                            <div className = "destination-card">
                            <img src = {osakaImage} alt = "삿포로" />
                            <div className = "card-title"> 삿포로 </div>
                            <div className = "card-subtitle"> Sapporo </div>
                            </div>

                            <div className = "destination-card">
                            <img src = {osakaImage} alt = "후쿠오카" />
                            <div className = "card-title"> 후쿠오카 </div>
                            <div className = "card-subtitle"> Fukuoka </div>
                            </div>
                            <div className = "destination-card">
                            <img src = {osakaImage} alt = "교토" />
                            <div className = "card-title"> 교토 </div>
                            <div className = "card-subtitle"> Kyoto </div>
                    </div>
                    </div>
             </main>
             </div>
    );
}

export default DashboardPage;