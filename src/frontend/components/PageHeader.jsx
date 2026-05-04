import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/home-page.css";

const IconLogout = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

export default function PageHeader({ subtitle = "SMR Optimization Platform" }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isManager = user?.role === "manager";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="home-topbar">
      <div className="home-brand">
        <div className="home-brand-logo">H₂</div>
        <div>
          <div className="home-brand-name">Hydrogen Network</div>
          <div className="home-brand-sub">{subtitle}</div>
        </div>
      </div>
      <div className="home-topbar-right">
        <div className="home-user-info">
          <div className="home-avatar">{user?.username?.[0]?.toUpperCase()}</div>
          <span className="home-username">{user?.username}</span>
          {isManager && <span className="home-role-badge">Manager</span>}
        </div>
        <button className="home-signout-btn" onClick={handleLogout}>
          <IconLogout /> Sign Out
        </button>
      </div>
    </div>
  );
}
