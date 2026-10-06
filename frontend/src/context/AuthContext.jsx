import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/services';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sentinel_user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data: tokenData } = await authService.login(email, password);
      localStorage.setItem('sentinel_token', tokenData.access_token);
      const { data: me } = await authService.me();
      localStorage.setItem('sentinel_user', JSON.stringify(me));
      setUser(me);
      return me;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try { await authService.logout(); } catch {}
    localStorage.removeItem('sentinel_token');
    localStorage.removeItem('sentinel_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
