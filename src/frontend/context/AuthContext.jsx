import React, { createContext, useContext, useState, useCallback } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token    = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    const role     = localStorage.getItem("role") || "engineer";
    const team_id  = localStorage.getItem("team_id") || null;
    return token && username ? { token, username, role, team_id } : null;
  });

  const login = useCallback((token, username, role = "engineer", team_id = null) => {
    localStorage.setItem("token",    token);
    localStorage.setItem("username", username);
    localStorage.setItem("role",     role);
    if (team_id) localStorage.setItem("team_id", team_id);
    else         localStorage.removeItem("team_id");
    setUser({ token, username, role, team_id });
  }, []);

  const logout = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (token) {
      await fetch("http://localhost:8000/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("role");
    localStorage.removeItem("team_id");
    setUser(null);
  }, []);

  const authFetch = useCallback((url, options = {}) => {
    const token = localStorage.getItem("token");
    return fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
