// src/pages/Homepage.jsx
import {useOutletContext} from 'react-router-dom';
import LoginButton from "../components/LoginButton";
import mainPhoto from '../assets/foreigner-Photo.png';


function HomePage () {
    const {texts} = useOutletContext ();
    
    return (
        <>
        <div className='main-text'>
            {texts.catchphrase} <br />
            {texts.startNow}
        </div>
        
        <img src = {mainPhoto} alt = "메인 이미지" className="main-photo" />
        <LoginButton texts = {texts} />
        </>
    );
}

export default HomePage;