import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Gauge, ChartBar, GraduationCap, SignOut, Brain } from '@phosphor-icons/react';

export default function Sidebar() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = isAdmin
    ? [
        { path: '/', label: 'Admin Dashboard', icon: Gauge, end: true },
        { path: '/sessions', label: 'All Candidate Sessions', icon: ChartBar, end: false },
      ]
    : [
        { path: '/sessions', label: 'My Interview Sessions', icon: GraduationCap, end: false },
      ];

  return (
    <motion.aside
      initial={{ x: -260 }}
      animate={{ x: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      className="fixed left-0 top-0 h-screen w-[260px] glass flex flex-col z-50 justify-between"
      style={{ borderRight: '1px solid var(--color-border)' }}
    >
      <div>
        {/* Logo Header */}
        <div className="p-5 flex items-center gap-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
            <Brain size={22} color="#fff" weight="bold" />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Study Buddy AI
            </h1>
            {user && (
              <span
                className="inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full"
                style={{
                  background: isAdmin ? 'rgba(129, 255, 107, 0.15)' : 'rgba(77, 166, 255, 0.15)',
                  color: isAdmin ? 'var(--color-success)' : 'var(--color-accent)',
                  border: `1px solid ${isAdmin ? 'rgba(129, 255, 107, 0.3)' : 'rgba(77, 166, 255, 0.3)'}`,
                }}
              >
                {user.role} Role
              </span>
            )}
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 flex flex-col gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    isActive ? '' : 'hover:opacity-80'
                  }`
                }
                style={({ isActive }) => ({
                  background: isActive ? 'var(--gradient-primary)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--color-text-secondary)',
                  boxShadow: isActive ? '0 4px 20px rgba(129, 255, 107, 0.41)' : 'none',
                })}
              >
                <Icon size={18} weight="bold" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* User Footer Profile & Logout */}
      {user && (
        <div className="p-4" style={{ borderTop: '1px solid var(--color-border)' }}>
          <div className="flex items-center justify-between mb-3 px-2">
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>
                {user.name}
              </p>
              <p className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                {user.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-80 cursor-pointer"
            style={{
              background: 'rgba(255, 77, 77, 0.1)',
              color: 'var(--color-danger)',
              border: '1px solid rgba(255, 77, 77, 0.2)',
            }}
          >
            <SignOut size={16} weight="bold" />
            Logout
          </button>
        </div>
      )}
    </motion.aside>
  );
}
