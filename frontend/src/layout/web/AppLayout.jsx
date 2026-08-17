import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Link, Home, MessageCircle, Radio, Bell, User, LogOut } from 'lucide-react';
import './AppLayout.css';

const NAV_ITEMS = [
  { path: '/home',          icon: Home,          label: 'Home' },
  { path: '/messages',      icon: MessageCircle, label: 'Messages' },
  { path: '/rooms',         icon: Radio,         label: 'Live Rooms' },
  { path: '/notifications', icon: Bell,          label: 'Activity' },
  { path: '/profile',       icon: User,          label: 'Profile' },
];

export default function WebAppLayout({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) =>
    location.pathname === path ||
    (path !== '/home' && location.pathname.startsWith(path + '/'));

  return (
    <div className="web-app-layout">
      {/* Sidebar */}
      <aside className="web-sidebar">
        <div className="web-sidebar-logo" onClick={() => navigate('/home')}>
          <div className="web-sidebar-logo-glow" />
          <Link size={24} color="var(--accent-1)" strokeWidth={2.5} />
          <span className="web-sidebar-logo-text web-nav-label">Connectify</span>
        </div>

        {NAV_ITEMS.map(({ path, icon: Icon, label }) => (
          <div
            key={path}
            className={`web-nav-item ${isActive(path) ? 'active' : ''}`}
            onClick={() => navigate(path)}
          >
            <Icon size={20} className="web-nav-icon" />
            <span className="web-nav-label">{label}</span>
          </div>
        ))}

        <div className="web-nav-spacer" />

        <div className="web-nav-logout" onClick={onLogout}>
          <LogOut size={20} />
          <span className="web-nav-label">Logout</span>
        </div>
      </aside>

      {/* Main content area */}
      <main className="web-content">
        <Outlet />
      </main>
    </div>
  );
}
