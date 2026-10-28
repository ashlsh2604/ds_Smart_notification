import { useState, useEffect, useRef } from 'react';
import {
  Smartphone,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lock,
  User,
  GraduationCap,
  Sparkles,
  Layers,
  ChevronDown
} from 'lucide-react';
import { UserSession } from '../types';

interface LoginPageProps {
  onLoginSuccess: (session: UserSession) => void;
  defaultEmail?: string;
}

const COUNTRY_CODES = [
  { code: '+1', country: 'US / Canada', flag: '🇺🇸' },
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
];

export default function LoginPage({
  onLoginSuccess,
  defaultEmail = 'gamer4life2602@gmail.com'
}: LoginPageProps) {
  // Tabs: 'phone' | 'google' | 'student'
  const [activeTab, setActiveTab] = useState<'phone' | 'google' | 'student'>('phone');

  // Phone + OTP State
  const [countryCode, setCountryCode] = useState('+1');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [otpStage, setOtpStage] = useState<'input_phone' | 'input_otp'>('input_phone');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [lastSentOtp, setLastSentOtp] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Google Account State
  const [googleEmail, setGoogleEmail] = useState(defaultEmail);
  const [googleName, setGoogleName] = useState('Gamer 4 Life');
  const [showCustomGoogleInput, setShowCustomGoogleInput] = useState(false);

  // Student / Legacy Login State
  const [studentUsername, setStudentUsername] = useState('student');
  const [studentPassword, setStudentPassword] = useState('password123');
  const [isStudentSignup, setIsStudentSignup] = useState(false);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Resend Countdown Timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Reset errors when tab changes
  const switchTab = (tab: 'phone' | 'google' | 'student') => {
    setActiveTab(tab);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // ---------------------------------------------------------------------------
  // PHONE + OTP FLOW
  // ---------------------------------------------------------------------------
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanNum = phoneNumber.replace(/\D/g, '');
    if (cleanNum.length < 6) {
      setErrorMessage('Please enter a valid phone number (at least 6 digits).');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber.trim(), countryCode }),
      });
      const data = await res.json();

      if (res.ok && data.status === 'ok') {
        setOtpStage('input_otp');
        setLastSentOtp(data.otp);
        setResendCooldown(30);
        setSuccessMessage(`SMS code sent to ${data.phone}. Use the 6-digit code to verify.`);
        // Focus first OTP input
        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 150);
      } else {
        setErrorMessage(data.message || 'Failed to send verification SMS.');
      }
    } catch {
      setErrorMessage('Could not connect to the authentication server.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpDigitChange = (index: number, value: string) => {
    // Handle paste event where multiple digits come in
    if (value.length > 1) {
      const pastedDigits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newDigits = [...otpDigits];
      pastedDigits.forEach((digit, i) => {
        if (i < 6) newDigits[i] = digit;
      });
      setOtpDigits(newDigits);
      const nextFocus = Math.min(pastedDigits.length, 5);
      otpInputRefs.current[nextFocus]?.focus();
      return;
    }

    const clean = value.replace(/\D/g, '');
    const newDigits = [...otpDigits];
    newDigits[index] = clean;
    setOtpDigits(newDigits);

    // Auto advance to next box
    if (clean && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleAutoFillOtp = () => {
    const code = lastSentOtp || '123456';
    const split = code.split('').slice(0, 6);
    setOtpDigits(split);
    setSuccessMessage(`Auto-filled verification code: ${code}`);
    setTimeout(() => {
      otpInputRefs.current[5]?.focus();
    }, 50);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const fullCode = otpDigits.join('');
    if (fullCode.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const fullPhone = phoneNumber.startsWith('+') ? phoneNumber : `${countryCode} ${phoneNumber.trim()}`;
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: fullPhone,
          otp: fullCode,
          name: displayName.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (res.ok && data.status === 'ok' && data.user) {
        setSuccessMessage('Phone number verified! Redirecting to dashboard...');
        setTimeout(() => {
          onLoginSuccess(data.user);
        }, 300);
      } else {
        setErrorMessage(data.message || 'Invalid verification code. Please try again.');
      }
    } catch {
      setErrorMessage('Unable to verify OTP with server.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // GOOGLE SIGN-IN FLOW
  // ---------------------------------------------------------------------------
  const handleGoogleSignIn = async (emailToUse?: string, nameToUse?: string) => {
    const targetEmail = (emailToUse || googleEmail || defaultEmail).trim();
    const targetName = (nameToUse || googleName || targetEmail.split('@')[0]).trim();

    if (!targetEmail || !targetEmail.includes('@')) {
      setErrorMessage('Please enter a valid Google Account email.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          name: targetName,
          picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(targetName)}&backgroundColor=2563eb,3b82f6,60a5fa`,
        }),
      });
      const data = await res.json();

      if (res.ok && data.status === 'ok' && data.user) {
        setSuccessMessage(`Authenticated with Google Account: ${targetEmail}`);
        setTimeout(() => {
          onLoginSuccess(data.user);
        }, 300);
      } else {
        setErrorMessage(data.message || 'Failed to authenticate with Google Account.');
      }
    } catch {
      setErrorMessage('Unable to connect to Google authentication service.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // STUDENT ID & PASSWORD (LEGACY COLLEGE PROJECT DEMO)
  // ---------------------------------------------------------------------------
  const handleStudentAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!studentUsername.trim() || !studentPassword.trim()) {
      setErrorMessage('Please enter both student username and password.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = isStudentSignup ? '/api/signup' : '/api/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: studentUsername.trim(),
          password: studentPassword.trim(),
        }),
      });
      const data = await res.json();

      if (res.ok && data.status === 'ok') {
        if (isStudentSignup) {
          setSuccessMessage('Student account created! You can now log in.');
          setIsStudentSignup(false);
        } else {
          const userSession: UserSession = {
            id: `student_${studentUsername.trim()}`,
            name: studentUsername.trim(),
            authMethod: 'password',
            role: 'Student Engineer',
            avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${studentUsername.trim()}`,
          };
          setSuccessMessage('Student login successful! Loading dashboard...');
          setTimeout(() => {
            onLoginSuccess(userSession);
          }, 300);
        }
      } else {
        setErrorMessage(data.message || 'Invalid username or password.');
      }
    } catch {
      setErrorMessage('Unable to connect to server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
        {/* Brand / Project Header */}
        <div className="bg-gradient-to-b from-blue-50/80 via-white to-white p-6 sm:p-8 pb-4 text-center border-b border-slate-100">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-[11px] font-mono font-semibold text-blue-700 mb-3">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span>Data Structures Mini-Project</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Notification Management System
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Priority Queue (Binary Max-Heap in C), Circular FIFO Queue & Singly Linked List History
          </p>

          {/* Navigation Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-slate-100/90 p-1 rounded-xl mt-6 border border-slate-200/80">
            <button
              type="button"
              onClick={() => switchTab('phone')}
              className={`py-2 px-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'phone'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Phone + OTP</span>
            </button>

            <button
              type="button"
              onClick={() => switchTab('google')}
              className={`py-2 px-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'google'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {/* Google 4-color G icon */}
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Google</span>
            </button>

            <button
              type="button"
              onClick={() => switchTab('student')}
              className={`py-2 px-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'student'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Student ID</span>
            </button>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6 sm:p-8 pt-5">
          {/* Status Message Banners */}
          {errorMessage && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 1: PHONE NUMBER & OTP AUTHENTICATION */}
          {/* =================================================================== */}
          {activeTab === 'phone' && (
            <div>
              {otpStage === 'input_phone' ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Your Name / Handle (Optional)
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g. Alex Student"
                        className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Phone Number *
                    </label>
                    <div className="flex gap-2">
                      {/* Country Code Selector */}
                      <div className="relative shrink-0 w-28">
                        <select
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          className="w-full pl-2.5 pr-6 py-2 text-xs bg-white border border-slate-300 rounded-lg appearance-none focus:outline-none focus:border-blue-600 font-mono font-medium"
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.flag} {c.code}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>

                      {/* Phone Input */}
                      <div className="relative flex-1">
                        <Smartphone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="tel"
                          required
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="e.g. 555 019 2834"
                          className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-mono"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      A 6-digit verification code will be sent to your mobile phone.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !phoneNumber.trim()}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-semibold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <span>Send Verification Code (OTP)</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Instant demo verification enabled. You will receive an immediate test code.</span>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="text-center pb-1">
                    <div className="inline-flex p-2.5 bg-blue-50 text-blue-600 rounded-full mb-2">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">Enter Verification Code</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Sent to <strong className="text-slate-800">{countryCode} {phoneNumber}</strong>
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpStage('input_phone');
                        setOtpDigits(['', '', '', '', '', '']);
                        setErrorMessage(null);
                      }}
                      className="text-[11px] text-blue-600 hover:underline mt-1 font-medium"
                    >
                      Change phone number
                    </button>
                  </div>

                  {/* 6 Digit Input Boxes */}
                  <div className="flex justify-center gap-2 my-2">
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          otpInputRefs.current[idx] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={digit}
                        onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        className="w-10 h-12 text-center text-lg font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition-all text-slate-900"
                      />
                    ))}
                  </div>

                  {/* Demo Rapid Test Code Auto-Fill Banner */}
                  <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="text-amber-900 text-[11px]">
                        Demo SMS Code: <strong>{lastSentOtp || '123456'}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAutoFillOtp}
                      className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold rounded-md transition-colors"
                    >
                      Auto-Fill Code
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otpDigits.join('').length !== 6}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-semibold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Verify & Sign In</span>
                      </>
                    )}
                  </button>

                  {/* Resend Timer */}
                  <div className="text-center pt-1 text-xs text-slate-500">
                    {resendCooldown > 0 ? (
                      <span>Resend SMS code in <strong className="font-mono text-slate-800">{resendCooldown}s</strong></span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendOtp()}
                        className="text-blue-600 hover:underline font-semibold"
                      >
                        Resend verification code
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 2: GOOGLE ACCOUNT SIGN-IN */}
          {/* =================================================================== */}
          {activeTab === 'google' && (
            <div className="space-y-4">
              <div className="text-center pb-1">
                <div className="w-12 h-12 mx-auto rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center shadow-xs mb-2">
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-slate-900">Sign in with Google Account</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Connect your verified Google profile to access the notification dashboard.
                </p>
              </div>

              {/* Primary Fast Google Account Card (Pre-configured for gamer4life2602@gmail.com) */}
              <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl hover:border-blue-400 transition-all">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={`https://api.dicebear.com/7.x/initials/svg?seed=gamer4life2602&backgroundColor=2563eb`}
                      alt="Google User"
                      className="w-10 h-10 rounded-full border-2 border-white shadow-xs"
                    />
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {defaultEmail === 'gamer4life2602@gmail.com' ? 'Gamer 4 Life' : defaultEmail.split('@')[0]}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 truncate">
                      {defaultEmail}
                    </div>
                    <span className="inline-block mt-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      ✓ Active Google Account
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleGoogleSignIn(defaultEmail, 'Gamer 4 Life')}
                    disabled={loading}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs shrink-0 flex items-center gap-1.5"
                  >
                    {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <span>Sign In</span>}
                  </button>
                </div>
              </div>

              {/* Custom Google Account Input (Optional Toggle) */}
              {showCustomGoogleInput ? (
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">Enter Google Account</span>
                    <button
                      type="button"
                      onClick={() => setShowCustomGoogleInput(false)}
                      className="text-[11px] text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                  <div>
                    <input
                      type="email"
                      value={googleEmail}
                      onChange={(e) => setGoogleEmail(e.target.value)}
                      placeholder="e.g. yourname@gmail.com"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleGoogleSignIn(googleEmail, googleEmail.split('@')[0])}
                    disabled={loading || !googleEmail.includes('@')}
                    className="w-full py-2 bg-slate-900 hover:bg-black text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <span>Sign In with this Google Account</span>
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setShowCustomGoogleInput(true)}
                    className="text-xs text-blue-600 hover:underline font-medium inline-flex items-center gap-1"
                  >
                    <span>Or sign in with another Google Account</span>
                  </button>
                </div>
              )}

              {/* Security info box */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 space-y-1">
                <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Google Authentication Guarantee</span>
                </div>
                <p>
                  Signing in with Google binds your notification records to your Google user ID. You can sign out at any time from the dashboard navigation bar.
                </p>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 3: STUDENT ID / PASSWORD (COLLEGE PROJECT CLASSIC) */}
          {/* =================================================================== */}
          {activeTab === 'student' && (
            <form onSubmit={handleStudentAuth} className="space-y-4">
              <div className="text-center pb-1">
                <h3 className="text-sm font-bold text-slate-900">
                  {isStudentSignup ? 'Create Student Account' : 'Student Engineer Login'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Classic credential login for college evaluation and test benches.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Username *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={studentUsername}
                    onChange={(e) => setStudentUsername(e.target.value)}
                    placeholder="e.g. student"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-semibold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>{isStudentSignup ? 'Sign Up New Account' : 'Log In with Student ID'}</span>
                )}
              </button>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>
                  Default demo:{' '}
                  <strong className="font-mono text-slate-700">student / password123</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsStudentSignup(!isStudentSignup);
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="text-blue-600 hover:underline font-semibold"
                >
                  {isStudentSignup ? 'Switch to Login' : 'Need new account?'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>Backend: Pure C Max-Heap</span>
          <span>Zero external DB · File persistence</span>
        </div>
      </div>
    </div>
  );
}
