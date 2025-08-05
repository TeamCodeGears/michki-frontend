import { useContext } from 'react';
import { useOutletContext } from 'react-router-dom';
import LoginButton from "../components/LoginButton";
import mainPhoto from '../assets/MainPhoto.webp';
import { LanguageContext } from '../context/LanguageContext';

function HomePage () {
    const { texts } = useContext(LanguageContext);
    const { setIsLoggedIn } = useOutletContext();

    return (
        <>
        <div className='main-text'>
            {texts.catchphrase} <br />
            {texts.startNow}
        </div>
        <div className="main-photo"
        style={{ backgroundImage: `url(${mainPhoto})` }}>
        </div>

        {/*<img src = {mainPhoto} alt = "메인 이미지" className="main-photo" /> 외국인 사진이 맘에 안들어 */}
        <LoginButton setIsLoggedIn={setIsLoggedIn} />
        </>
    );
}

export default HomePage;