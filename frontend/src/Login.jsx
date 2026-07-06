import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import './index.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const formRef = useRef(null);
  const navigate = useNavigate();
  const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3600';
  const API_URL = rawApiUrl.endsWith('/api') ? rawApiUrl.slice(0, -4) : rawApiUrl;

  useEffect(() => {
    const adminData = localStorage.getItem('admin');
    if (adminData) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    // Entrance animation
    if (formRef.current) {
      formRef.current.style.opacity = 0;
      formRef.current.style.transform = 'translateY(20px)';
      formRef.current.style.transition =
        'opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1), transform 1.2s cubic-bezier(0.16, 1, 0.3, 1)';

      setTimeout(() => {
        if (formRef.current) {
          formRef.current.style.opacity = 1;
          formRef.current.style.transform = 'translateY(0)';
        }
      }, 50);
    }
  }, []);

  const handleSubmit = async () => {
    try {
      if (!email || !password) {
        Swal.fire({
          icon: 'warning',
          title: 'Missing Fields',
          text: 'Please enter both email and password',
          timer: 1800,
          showConfirmButton: false,
          customClass: {
            popup: 'swal2-minimalist',
          },
        });
        return;
      }

      setIsLoading(true);

      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        Swal.fire({
          icon: 'error',
          title: 'Login Failed',
          text: data.error || 'Login failed',
          timer: 2000,
          showConfirmButton: false,
          customClass: {
            popup: 'swal2-minimalist',
          },
        });
        setIsLoading(false);
        return;
      }

      localStorage.setItem('admin', JSON.stringify(data));
      navigate('/dashboard');
    } catch (err) {
      setIsLoading(false);
      Swal.fire({
        icon: 'error',
        title: 'Network Error',
        text: 'Please try again.',
        timer: 2000,
        showConfirmButton: false,
        customClass: {
          popup: 'swal2-minimalist',
        },
      });
    }
  };

  // Keyboard event handler for Enter key
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Enter' && !isLoading) {
        event.preventDefault();
        handleSubmit();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, handleSubmit]);

  return (
    <div className="min-h-screen flex items-center justify-center py-10 px-4 bg-slate-50 relative overflow-hidden">
      {/* Decorative Blur Spheres */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-sky-200/40 blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[35vw] h-[35vw] rounded-full bg-pink-100/40 blur-3xl pointer-events-none"></div>

      <div
        ref={formRef}
        className="flex w-full max-w-3xl h-[460px] bg-white border border-slate-100 shadow-2xl rounded-3xl overflow-hidden opacity-0 z-10"
      >
        {/* Left Side */}
        <div className="w-1/2 bg-gradient-to-br from-[#0b4c95] to-[#073467] flex flex-col items-center justify-center p-8 relative overflow-hidden">
          {/* Subtle decorative background circles */}
          <div className="absolute w-64 h-64 rounded-full bg-white/5 -top-20 -left-20 pointer-events-none"></div>
          <div className="absolute w-48 h-48 rounded-full bg-white/5 -bottom-10 -right-10 pointer-events-none"></div>

          <div className="flex flex-col items-center space-y-5 z-10">
            <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-xl">
              <img
                src="/logoWithLabel.png"
                alt="Logo"
                className="w-28 h-28 object-contain"
              />
            </div>
            <div className="space-y-1 text-center">
              <h1 className="text-white text-base font-extrabold tracking-wider">
                DOST E-LOGBOOK
              </h1>
              <p className="text-sky-200/80 text-[10px] uppercase font-bold tracking-widest">
                Budget Document Logging System
              </p>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="w-1/2 p-10 flex flex-col justify-center bg-white">
          <div className="mb-8">
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              Sign In
            </h2>
            <p className="text-slate-400 text-xs mt-1.5">
              Access the Budget Document Logging System
            </p>
          </div>

          <div className="space-y-5">
            <div className="relative">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                Email Address
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full h-11 px-4 rounded-xl border border-slate-200 placeholder:text-slate-400 text-sm focus:border-[#0b4c95] focus:outline-none focus:ring-4 focus:ring-sky-500/10 transition-all duration-200"
              />
            </div>

            <div className="relative">
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full h-11 px-4 rounded-xl border border-slate-200 placeholder:text-slate-400 text-sm focus:border-[#0b4c95] focus:outline-none focus:ring-4 focus:ring-sky-500/10 transition-all duration-200"
              />
            </div>

            <div className="flex items-center ml-1">
              <input
                type="checkbox"
                id="show-password"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="mr-2 rounded border-slate-300 text-[#0b4c95] focus:ring-[#0b4c95] w-3.5 h-3.5 cursor-pointer"
              />
              <label
                htmlFor="show-password"
                className="text-xs font-semibold text-slate-500 select-none cursor-pointer"
              >
                Show Password
              </label>
            </div>

            <div className="pt-2">
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className={`cursor-pointer w-full h-11 bg-gradient-to-r from-[#0b4c95] to-[#073467] hover:from-[#0a4587] hover:to-[#062c58] text-white font-bold rounded-xl shadow-lg shadow-sky-900/15 hover:shadow-sky-900/25 transition-all duration-200 text-sm flex items-center justify-center ${
                  isLoading ? 'opacity-75 cursor-not-allowed' : ''
                }`}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Signing in...</span>
                  </div>
                ) : (
                  'Sign In'
                )}
              </button>
            </div>
            <p className="text-[10px] text-center text-slate-400 font-semibold mt-4 leading-relaxed">
              Developed by DOST Ilocos Region - ITSM Unit<br />v2.1
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
