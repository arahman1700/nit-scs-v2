import React, { useState } from 'react';
import { Eye, EyeOff, LogIn, Loader2, ArrowLeft, Mail, KeyRound, CheckCircle2 } from 'lucide-react';
import { NesmaLogo } from '@/components/NesmaLogo';
import { IdaratechLogo } from '@/components/IdaratechLogo';
import { UserRole } from '@nit-scs-v2/shared/types';
import { useLogin, useForgotPassword, useResetPassword } from '@/api/hooks';

interface LoginPageProps {
  onLogin: (role: UserRole) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'code' | 'done'>('email');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotError, setForgotError] = useState('');

  const loginMutation = useLogin();
  const forgotMutation = useForgotPassword();
  const resetMutation = useResetPassword();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    loginMutation.mutate(
      { email, password },
      {
        onSuccess: result => {
          const user = result.data.user;
          onLogin(user.role);
        },
        onError: (err: unknown) => {
          const axiosErr = err as { response?: { data?: { message?: string } } };
          setError(axiosErr.response?.data?.message || 'Invalid credentials. Please try again.');
        },
      },
    );
  };

  const handleForgotSubmitEmail = () => {
    setForgotError('');
    if (!resetEmail) {
      setForgotError('Please enter your email address');
      return;
    }
    forgotMutation.mutate(resetEmail, {
      onSuccess: () => setForgotStep('code'),
      onError: () => setForgotStep('code'), // Always advance (don't reveal user existence)
    });
  };

  const handleResetSubmit = () => {
    setForgotError('');
    if (!resetCode || resetCode.length !== 6) {
      setForgotError('Please enter the 6-digit code');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setForgotError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotError('Passwords do not match');
      return;
    }
    resetMutation.mutate(
      { email: resetEmail, code: resetCode, newPassword },
      {
        onSuccess: () => setForgotStep('done'),
        onError: (err: unknown) => {
          const axiosErr = err as { response?: { data?: { message?: string } } };
          setForgotError(axiosErr.response?.data?.message || 'Reset failed. Please try again.');
        },
      },
    );
  };

  const closeForgotPassword = () => {
    setShowForgotPassword(false);
    setForgotStep('email');
    setResetEmail('');
    setResetCode('');
    setNewPassword('');
    setConfirmPassword('');
    setForgotError('');
  };

  const t = {
    welcome: 'Welcome Back',
    subtitle: 'Supply Chain Management System - Nesma Infrastructure & Technology',
    email: 'Email Address',
    password: 'Password',
    login: 'Sign In',
    forgot: 'Forgot Password?',
    demo: 'Demo Accounts',
    copyright: '© 2026 Nesma Infrastructure & Technology. All rights reserved.',
  };

  const demoAccounts = [
    { label: 'Admin', email: 'admin@nit.sa', role: 'Admin' },
    { label: 'Warehouse', email: 'ahmed@nit.sa', role: 'Warehouse' },
    { label: 'Transport', email: 'mohammed@nit.sa', role: 'Transport' },
    { label: 'Engineer', email: 'khalid@nit.sa', role: 'Engineer' },
  ];

  return (
    <div className="min-h-screen flex" dir="ltr">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#051020] via-[#0E2841] to-[#0a1628]">
        {/* Animated Background Elements */}
        <div className="absolute top-20 left-20 w-72 h-72 bg-nesma-primary/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-nesma-secondary/5 rounded-full blur-[150px]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-conic from-nesma-primary/5 via-transparent to-nesma-secondary/5 rounded-full blur-[100px]"></div>

        {/* Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        ></div>

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div>
            <NesmaLogo className="h-10 w-auto filter drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" />
          </div>

          <div className="space-y-8">
            <div>
              <h1 className="text-5xl font-bold text-white leading-tight mb-4">
                Supply Chain
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-nesma-secondary to-white">
                  Management System
                </span>
              </h1>
              <p className="text-gray-400 text-lg leading-relaxed max-w-md">
                Comprehensive management for warehouses, materials, transport and equipment across 30+ sites in Saudi
                Arabia
              </p>
            </div>
          </div>

          <p className="text-gray-600 text-xs">{t.copyright}</p>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-nesma-dark">
        <div className="w-full max-w-md">
          {/* Spacer */}
          <div className="mb-8"></div>

          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <NesmaLogo className="h-8 w-auto mx-auto mb-4" />
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-bold text-white mb-2">{t.welcome}</h2>
            <p className="text-gray-400 text-sm">{t.subtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{t.email}</label>
              <input
                type="email"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  setError('');
                }}
                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-nesma-secondary focus:ring-1 focus:ring-nesma-secondary/30 outline-none transition-all"
                placeholder="name@nit.com"
                dir="ltr"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">{t.password}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-nesma-secondary focus:ring-1 focus:ring-nesma-secondary/30 outline-none transition-all pr-12"
                  placeholder="••••••••"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm animate-fade-in">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full py-3.5 bg-gradient-to-r from-nesma-primary to-nesma-accent text-white font-bold rounded-xl flex items-center justify-center gap-3 hover:shadow-[0_0_30px_rgba(46,49,146,0.5)] transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              {loginMutation.isPending ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={20} />}
              {t.login}
            </button>

            {/* Forgot Password */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-gray-400 hover:text-nesma-secondary transition-colors"
              >
                {t.forgot}
              </button>
            </div>
          </form>

          {/* Demo Accounts — only in development or when VITE_DEMO_MODE is enabled */}
          {(import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true') && (
            <div className="mt-10 pt-8 border-t border-white/10">
              <p className="text-xs text-gray-500 mb-4 font-medium uppercase tracking-wider">{t.demo}</p>
              <div className="grid grid-cols-2 gap-2">
                {demoAccounts.map(account => (
                  <button
                    key={account.email}
                    onClick={() => {
                      setEmail(account.email);
                      setPassword('Admin@2026!');
                      setError('');
                    }}
                    className="text-left px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-nesma-secondary/30 rounded-lg transition-all group"
                  >
                    <span className="text-xs font-medium text-gray-300 group-hover:text-white block">
                      {account.label}
                    </span>
                    <span className="text-[10px] text-gray-500">{account.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Powered by Idaratech */}
          <div className="mt-8 pt-6 border-t border-white/5 flex flex-col items-center gap-2 group">
            <span className="text-[10px] text-gray-500 tracking-[0.2em] uppercase idaratech-spark">Powered by</span>
            <div className="relative">
              <div className="absolute inset-0 -m-6 rounded-2xl bg-gradient-to-r from-nesma-primary/5 via-nesma-secondary/10 to-nesma-primary/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <IdaratechLogo className="w-56 relative z-10 idaratech-glow" />
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={closeForgotPassword}
          />

          {/* Modal */}
          <div className="relative w-full max-w-md glass-panel border border-white/10 rounded-2xl shadow-2xl p-8 animate-fade-in">
            {/* Close / Back */}
            <button
              type="button"
              onClick={closeForgotPassword}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors text-sm"
            >
              Close
            </button>

            {forgotStep === 'email' && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-nesma-primary/20 mb-4">
                    <Mail size={24} className="text-nesma-secondary" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Forgot Password</h3>
                  <p className="text-gray-400 text-sm mt-2">Enter your email address and we'll send you a reset code</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={e => {
                      setResetEmail(e.target.value);
                      setForgotError('');
                    }}
                    className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-nesma-secondary focus:ring-1 focus:ring-nesma-secondary/30 outline-none transition-all"
                    placeholder="name@nit.com"
                    dir="ltr"
                    autoFocus
                  />
                </div>

                {forgotError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                    {forgotError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleForgotSubmitEmail}
                  disabled={forgotMutation.isPending}
                  className="w-full py-3.5 bg-gradient-to-r from-nesma-primary to-nesma-accent text-white font-bold rounded-xl flex items-center justify-center gap-3 hover:shadow-[0_0_30px_rgba(46,49,146,0.5)] transition-all disabled:opacity-50"
                >
                  {forgotMutation.isPending ? <Loader2 size={20} className="animate-spin" /> : <Mail size={20} />}
                  Send Reset Code
                </button>

                <button
                  type="button"
                  onClick={closeForgotPassword}
                  className="w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  <ArrowLeft size={16} />
                  Back to Login
                </button>
              </div>
            )}

            {forgotStep === 'code' && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-nesma-primary/20 mb-4">
                    <KeyRound size={24} className="text-nesma-secondary" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Enter Reset Code</h3>
                  <p className="text-gray-400 text-sm mt-2">Check your email for a 6-digit code</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">6-Digit Code</label>
                  <input
                    type="text"
                    value={resetCode}
                    onChange={e => {
                      setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                      setForgotError('');
                    }}
                    className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white text-center text-2xl tracking-[0.5em] font-mono placeholder-gray-500 focus:border-nesma-secondary focus:ring-1 focus:ring-nesma-secondary/30 outline-none transition-all"
                    placeholder="000000"
                    dir="ltr"
                    maxLength={6}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => {
                      setNewPassword(e.target.value);
                      setForgotError('');
                    }}
                    className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-nesma-secondary focus:ring-1 focus:ring-nesma-secondary/30 outline-none transition-all"
                    placeholder="Min. 6 characters"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => {
                      setConfirmPassword(e.target.value);
                      setForgotError('');
                    }}
                    className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-nesma-secondary focus:ring-1 focus:ring-nesma-secondary/30 outline-none transition-all"
                    placeholder="Confirm new password"
                    dir="ltr"
                  />
                </div>

                {forgotError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                    {forgotError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleResetSubmit}
                  disabled={resetMutation.isPending}
                  className="w-full py-3.5 bg-gradient-to-r from-nesma-primary to-nesma-accent text-white font-bold rounded-xl flex items-center justify-center gap-3 hover:shadow-[0_0_30px_rgba(46,49,146,0.5)] transition-all disabled:opacity-50"
                >
                  {resetMutation.isPending ? <Loader2 size={20} className="animate-spin" /> : <KeyRound size={20} />}
                  Reset Password
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setForgotStep('email');
                    setForgotError('');
                  }}
                  className="w-full flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
              </div>
            )}

            {forgotStep === 'done' && (
              <div className="space-y-6 text-center">
                <div>
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500/20 mb-4">
                    <CheckCircle2 size={24} className="text-green-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Password Reset!</h3>
                  <p className="text-gray-400 text-sm mt-2">
                    Your password has been successfully reset. You can now sign in with your new password.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeForgotPassword}
                  className="w-full py-3.5 bg-gradient-to-r from-nesma-primary to-nesma-accent text-white font-bold rounded-xl flex items-center justify-center gap-3 hover:shadow-[0_0_30px_rgba(46,49,146,0.5)] transition-all"
                >
                  <LogIn size={20} />
                  Back to Login
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
