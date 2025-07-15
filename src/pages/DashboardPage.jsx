import './DashboardPage.css';
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import YearSelector from '../components/YearSelector';

function DashboardPage() {

    const { texts } = useOutletContext();
    const [ activeTab, setActiveTab ] = useState('japan');

    return (
        <div className = "dashboard-container">
            { /*왼쪽에 위치한 사이드 바 */ }
            <aside className = "sidebar">
                <YearSelector />
                <div className = "trip-list">
                    {texts.myTrips.map(trip => (
                        <div key = {trip.name} className = "trip-item">
                            <span className = "trip-name"> {trip.name} </span>
                            <span className = "trip-date"> {trip.date} </span>
                        </div>
                    ))}
                    {texts.pastTrips.map (trip => (
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
                        <input type = "text" placeholder = { texts.searchPlaceholder} />
                        <div className = "search-button-wrapper">
                        <button className = "search-button"> 🔍 </button>
                        </div>
                    </div>
                    <div className = "country-tabs">
                        <button 
                      className={`tab-item ${activeTab === 'japan' ? 'active' : ''}`}
                      onClick={() => setActiveTab('japan')}
                      >
                        {texts.tabJapan}
                        </button>
                        <button 
                        className={`tab-item ${activeTab === 'korea' ? 'active' : ''}`}
                        onClick={() => setActiveTab('korea')}
                        >
                        {texts.tabKorea}
                        </button>
                    </div>
                    <div className = "destination-grid">
                        {texts.destinations[activeTab].map(dest => (
                            <div key = {dest.name} className = "destination-card">
                                <img src = {dest.image} alt = {dest.name} />
                                <div className = "card-title"> {dest.name} </div>
                                <div className = "card-subtitle"> {dest.engName} </div>
                            </div>
                        ))}
                    </div>
             </main>
        </div>
    );
}

export default DashboardPage;