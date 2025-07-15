import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google'; // 구글 로그인 관련
import './index.css';
import App from './App.jsx';
import TermsPage from './pages/TermsPage'; // 이용약관 관련 페이지 불러옴
import HomePage from './pages/HomePage'; // Homepage 불러와
import PrivacyPage from './pages/PrivacyPage'; // 개인정보처리방침 불러와
import DashboardPage from './pages/DashboardPage'; // 구글 로그인 -> 대쉬보드 페이지

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID; // 구글 클라이언트 ID 가져오기

const router = createBrowserRouter ([
  {
    path : '/', // 미치키 기본 주소 (메인페이지로 진입)
    element: <App /> , // 앱 부분에서 전체 레이아웃
    children : [ // App의 <Outlet>에 들어갈 자식 페이지들
      { index : true, element : <HomePage />},// path : '/' 와 동일한 경로일 때 보여줄 페이지
      { path : 'terms', element : <TermsPage />}, // '/terms' 경로 일 때 보여줄 페이지
      { path : 'privacy', element : <PrivacyPage />}, // 개인정보처리방침에 들어갈 부분
      { path : 'dashboard', element : <DashboardPage /> }, // 대쉬보드 페이지로 이동
      {
        path : 'dashboard',
        element : <DashboardPage />
      },
    ]
  },
]);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}> {/* 구글 OAuth 제공자 설정 */}
    {/*<App />*/}
    <RouterProvider router = {router} />
    </GoogleOAuthProvider>
  </StrictMode>,
)