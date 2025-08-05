import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthProvider.jsx';
import './index.css';
import App from './App.jsx';
import TermsPage from './pages/TermsPage';
import HomePage from './pages/HomePage';
import PrivacyPage from './pages/PrivacyPage';
import DashboardPage from './pages/DashboardPage';
import ErrorPage from './pages/ErrorPage';
import ScheduleMap from './pages/ScheduleMap';



const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
    ],
  },
  {
    path: '*',
    element: <ErrorPage />,
  },
  {
    path: 'schedule/:scheduleId',
    element: <ScheduleMap />,
  },
]);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <LanguageProvider>
        <AuthProvider>
        <RouterProvider router={router} />
        </AuthProvider>
      </LanguageProvider>
    </GoogleOAuthProvider>
  </StrictMode>
);
