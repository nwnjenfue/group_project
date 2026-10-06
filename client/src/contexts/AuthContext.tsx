import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';

export interface User { id: string; username: string; email: string; role: 'admin' | 'user'; isBlocked: boolean; }
interface AuthContextType { user: User | null; loading: boolean; isAdmin: boolean; login: (user: User, token: string) => void; logout: () => void; }
const AuthContext = createContext<AuthContextType>({ user: null, loading: true, isAdmin: false, login: () => {}, logout: () => {} });
export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const logout = () => { localStorage.removeItem('token'); setUser(null); };
  const login = (nextUser: User, token: string) => { localStorage.setItem('token', token); setUser(nextUser); };

  useEffect(() => {
    const handler = () => logout();
    window.addEventListener('efot:logout', handler);
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return () => window.removeEventListener('efot:logout', handler); }
    api.get('/auth/profile').then(r => setUser(r.data)).catch(() => logout()).finally(() => setLoading(false));
    return () => window.removeEventListener('efot:logout', handler);
  }, []);

  return <AuthContext.Provider value={{ user, loading, isAdmin: user?.role === 'admin', login, logout }}>{children}</AuthContext.Provider>;
};
