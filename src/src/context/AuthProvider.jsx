import { useState } from 'react';
import { AuthContext } from './auth-context.js'; 

// AuthProvider 컴포넌트는 그대로 둡니다.
export function AuthProvider({ children }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accessToken, setAccessToken] = useState(null);

  const login = (token) => {
    localStorage.setItem('accessToken', token);
    setAccessToken(token);
    setIsLoggedIn(true);
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    setAccessToken(null);
    setIsLoggedIn(false);
  };

  const value = { isLoggedIn, accessToken, login, logout };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
/*
// useAuth 훅도 여기에 그대로 둡니다.
export function useAuth() {
  return useContext(AuthContext);
}
  */