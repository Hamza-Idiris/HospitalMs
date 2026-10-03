import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export const HOME = { super_admin: '/admin', manager: '/manager', receptionist: '/reception', cashier: '/cashier', doctor: '/doctor', lab: '/laboratory', xray: '/xray', pharmacist: '/pharmacy' };
export const ROLE_LABEL = { super_admin: 'Super Admin', manager: 'Hospital Manager', receptionist: 'Receptionist', cashier: 'Cashier', doctor: 'Doctor', lab: 'Laboratory Technician', xray: 'X-Ray Technician', pharmacist: 'Pharmacist' };

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: !!localStorage.getItem('hms_token'), user: null, hospital: null });
  useEffect(() => {
    if (!localStorage.getItem('hms_token')) return;
    api.get('/auth/me').then((r) => setState({ loading: false, ...r.data })).catch(() => { localStorage.removeItem('hms_token'); setState({ loading: false, user: null, hospital: null }); });
  }, []);
  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('hms_token', data.token);
    setState({ loading: false, user: data.user, hospital: data.hospital });
    return data.user;
  }, []);
  const logout = useCallback(() => { localStorage.removeItem('hms_token'); setState({ loading: false, user: null, hospital: null }); }, []);
  return <Ctx.Provider value={{ ...state, login, logout }}>{children}</Ctx.Provider>;
}
