import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';

const navItems = [
  { path: '/', label: 'Dashboard', icon: '' },
  { path: '/sessions', label: 'Sessions', icon: '' },
];

export default function Sidebar() {
  return (
    <motion.aside
      initial={{ x: -260 }}
      animate={{ x: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      className="fixed left-0 top-0 h-screen w-[260px] glass flex flex-col z-50"
      style={{ borderRight: '1px solid var(--color-border)' }}
    >
      {/* Logo */}
      <div className="p-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div>
          <h1 className="text-5xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Study Buddy
          </h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive ? '' : 'hover:opacity-80'
              }`
            }
            style={({ isActive }) => ({
              background: isActive ? 'var(--gradient-primary)' : 'transparent',
              color: isActive ? '#fff' : 'var(--color-text-secondary)',
              boxShadow: isActive ? '0 4px 20px rgba(129, 255, 107, 0.41)' : 'none',
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </motion.aside>
  );
}
