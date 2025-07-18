import { useContext } from 'react';
import { useOutletContext } from 'react-router-dom';
import LoginButton from "../components/LoginButton";
import mainPhoto from '../assets/foreigner-Photo.png';
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
        
        <img src = {mainPhoto} alt = "메인 이미지" className="main-photo" />
        <LoginButton setIsLoggedIn={setIsLoggedIn} />
        </>
    );
}

export default HomePage;