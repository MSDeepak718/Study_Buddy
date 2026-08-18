import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { loginUser, registerUser } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { GraduationCap, ArrowRight } from '@phosphor-icons/react';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, login } = useAuth();
  const from = (location.state as any)?.from || new URLSearchParams(location.search).get('redirect');

  useEffect(() => {
    if (token && user) {
      if (from) {
        navigate(from, { replace: true });
      } else if (user.role === 'admin') {
        navigate('/', { replace: true });
      } else {
        navigate('/sessions', { replace: true });
      }
    }
  }, [user, token, navigate, from]);

  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (isRegister && !name) return;

    setLoading(true);
    setErrorMsg('');

    try {
      let res;
      if (isRegister) {
        res = await registerUser(name, email, password, 'student');
      } else {
        res = await loginUser(email, password);
      }

      login(res.access_token, res.user);

      if (from) {
        navigate(from, { replace: true });
      } else if (res.user.role === 'admin') {
        navigate('/');
      } else {
        navigate('/sessions');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.response?.data?.detail || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md glass rounded-3xl p-8 shadow-2xl relative overflow-hidden"
        style={{ border: '1px solid var(--color-border)' }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg" style={{ background: 'var(--gradient-primary)' }}>
            <GraduationCap size={36} color="#fff" weight="bold" />
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            Study Buddy AI
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {isRegister ? 'Create your candidate account' : 'Welcome back! Sign in to continue'}
          </p>
        </div>

        {/* Tab Selector (Login vs Register) */}
        <div className="flex rounded-xl p-1 mb-6" style={{ background: 'var(--color-bg-input)' }}>
          <button
            type="button"
            onClick={() => { setIsRegister(false); setErrorMsg(''); }}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer"
            style={{
              background: !isRegister ? 'var(--color-primary)' : 'transparent',
              color: !isRegister ? '#fff' : 'var(--color-text-secondary)',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setErrorMsg(''); }}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer"
            style={{
              background: isRegister ? 'var(--color-primary)' : 'transparent',
              color: isRegister ? '#fff' : 'var(--color-text-secondary)',
            }}
          >
            Register
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2"
                style={{ background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2"
              style={{ background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all focus:ring-2"
              style={{ background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl text-xs font-medium text-center" style={{ background: 'rgba(255, 77, 77, 0.1)', color: 'var(--color-danger)', border: '1px solid rgba(255, 77, 77, 0.2)' }}>
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 mt-4 cursor-pointer"
            style={{
              background: 'var(--gradient-primary)',
              color: '#fff',
              boxShadow: '0 4px 20px rgba(129, 255, 107, 0.41)',
            }}
          >
            {loading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Sign In'}
            <ArrowRight size={18} weight="bold" />
          </button>
        </form>

        <div className="mt-6 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {isRegister ? 'Already have an account?' : "Don't have an account yet?"}{' '}
          <button
            type="button"
            onClick={() => { setIsRegister(!isRegister); setErrorMsg(''); }}
            className="font-semibold underline hover:opacity-80 cursor-pointer"
            style={{ color: 'var(--color-accent)' }}
          >
            {isRegister ? 'Sign In' : 'Register now'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
