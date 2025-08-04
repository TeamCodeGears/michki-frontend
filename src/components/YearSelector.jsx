import { useState } from 'react';
import './YearSelector.css';

function YearSelector() {

    // 드롭다운 메뉴 열렸나, 안 열렸나 기억하는거
    const [ isOpen, setIsOpen ] = useState (false);
    // 선택된 년도 기억할 것 (*기본값은 2025로)
    const [ selectedYear, setSelectedYear ] = useState('2025');

    // 선택 가능한 연도 나열
    const years = Array.from({ length: 10 }, (_, i) => (2025 - i).toString());

    // 연도 선택시 실행될 함수식
    const handleYearSelect = (year) => {
        setSelectedYear (year);  // 선택된 연도로 상태 변경
        setIsOpen (false);       // 메뉴 닫기 기능
    };

    return (
        <div className = "year-selector-container">
            <div className = "selected-year-display" onClick = {() => setIsOpen(!isOpen)}>
                <span>{selectedYear}</span>
                <span>▼</span>
            </div>

            {/* isOpen 이 true일 때만 드롭다운 메뉴 표시 */}
            {isOpen && (
                <ul className = "year-dropdown-list">
                    {years.map(year => (
                        <li key = {year} onClick = {() => handleYearSelect (year)}>
                            {year}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default YearSelector;