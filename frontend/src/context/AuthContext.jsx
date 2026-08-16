import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/endpoints';
import { storage, TOKEN_KEY, USER_KEY, setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

function readStoredUser() {
  const raw = storage.get(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [profile, setProfile] = useState(null);
  const [initialising, setInitialising] = useState(Boolean(storage.get(TOKEN_KEY)));

  const clearSession = useCallback(() => {
    storage.remove(TOKEN_KEY);
    storage.remove(USER_KEY);
    setUser(null);
    setProfile(null);
  }, []);

  // Any 401 from the API drops the session immediately.
  useEffect(() => {
    setUnauthorizedHandler(() => clearSession());
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  // Revalidate a stored token on first load so a stale session can't linger.
  useEffect(() => {
    let cancelled = false;
    const token = storage.get(TOKEN_KEY);
    if (!token) {
      setInitialising(false);
      return () => {};
    }

    authApi
      .me()
      .then((data) => {
        if (cancelled) return;
        setUser(data.user);
        setProfile(data.profile);
        storage.set(USER_KEY, JSON.stringify(data.user));
      })
      .catch(() => {
        if (!cancelled) clearSession();
      })
      .finally(() => {
        if (!cancelled) setInitialising(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const persist = useCallback((data) => {
    storage.set(TOKEN_KEY, data.token);
    storage.set(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
    setProfile(data.profile ?? null);
    return data.user;
  }, []);

  const login = useCallback(
    async (email, password) => persist(await authApi.login({ email, password })),
    [persist]
  );

  const register = useCallback(
    async (payload) => persist(await authApi.register(payload)),
    [persist]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // A failed logout call must never trap the user in the app.
    }
    clearSession();
  }, [clearSession]);

  const refreshProfile = useCallback(async () => {
    const data = await authApi.me();
    setUser(data.user);
    setProfile(data.profile);
    storage.set(USER_KEY, JSON.stringify(data.user));
    return data;
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      role: user?.role ?? null,
      isAuthenticated: Boolean(user),
      initialising,
      login,
      register,
      logout,
      refreshProfile,
    }),
    [user, profile, initialising, login, register, logout, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
