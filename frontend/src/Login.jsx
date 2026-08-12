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
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3600';

  useEffect(() => {
    const adminData = localStorage.getItem('admin');
    if (adminData) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    // Check for Microsoft 365 OAuth callback parameters in search query
    const params = new URLSearchParams(window.location.search);
    const m365Success = params.get('m365_success');
    const m365Error = params.get('m365_error');

    if (m365Success) {
      try {
        const decodedData = JSON.parse(atob(m365Success));
        localStorage.setItem('admin', JSON.stringify(decodedData));
        
        // Clean URL params
        window.history.replaceState({}, document.title, window.location.pathname);

        Swal.fire({
          icon: 'success',
          title: 'Welcome Back!',
          text: `Logged in as ${decodedData.adminname}`,
          timer: 1500,
          showConfirmButton: false,
          customClass: {
            popup: 'swal2-minimalist',
          },
        });

        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      } catch (err) {
        console.error('Failed to parse Microsoft login payload:', err);
        Swal.fire({
          icon: 'error',
          title: 'Authentication Error',
          text: 'Invalid response payload from login provider.',
          timer: 2000,
          showConfirmButton: false,
          customClass: {
            popup: 'swal2-minimalist',
          },
        });
      }
    } else if (m365Error) {
      // Clean URL params
      window.history.replaceState({}, document.title, window.location.pathname);

      Swal.fire({
        icon: 'error',
        title: 'Login Failed',
        text: m365Error,
        timer: 3000,
        showConfirmButton: false,
        customClass: {
          popup: 'swal2-minimalist',
        },
      });
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
        <div className="w-1/2 p-7 flex flex-col justify-center bg-white">
          <div className="mb-4">
            <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">
              Sign In
            </h2>
            <p className="text-slate-400 text-[11px] mt-1">
              Access the Budget Document Logging System
            </p>
          </div>

          <div className="space-y-3.5">
            <div className="relative">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1 ml-0.5">
                Email Address
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 placeholder:text-slate-400 text-xs focus:border-[#0b4c95] focus:outline-none focus:ring-4 focus:ring-sky-500/10 transition-all duration-200"
              />
            </div>

            <div className="relative">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1 ml-0.5">
                Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 placeholder:text-slate-400 text-xs focus:border-[#0b4c95] focus:outline-none focus:ring-4 focus:ring-sky-500/10 transition-all duration-200"
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

            <div className="pt-1">
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className={`cursor-pointer w-full h-9 bg-gradient-to-r from-[#0b4c95] to-[#073467] hover:from-[#0a4587] hover:to-[#062c58] text-white font-bold rounded-lg shadow-lg shadow-sky-900/15 hover:shadow-sky-900/25 transition-all duration-200 text-xs flex items-center justify-center ${
                  isLoading ? 'opacity-75 cursor-not-allowed' : ''
                }`}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-3.5 w-3.5 text-white"
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

            <div className="flex items-center my-1">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-2 text-slate-400 text-[9px] font-extrabold uppercase tracking-wider">or</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => window.location.href = `${API_URL}/api/auth/microsoft`}
                className="cursor-pointer w-full h-9 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg border border-slate-200 shadow-sm transition-all duration-200 text-xs flex items-center justify-center gap-2"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#f35022" d="M0 0h11v11H0z" />
                  <path fill="#80bb01" d="M12 0h11v11H12z" />
                  <path fill="#00a1f1" d="M0 12h11v11H0z" />
                  <path fill="#ffb900" d="M12 12h11v11H12z" />
                </svg>
                Continue with Microsoft 365
              </button>
            </div>
            <p className="text-[9px] text-center text-slate-400 font-semibold mt-3 leading-relaxed">
              Developed by DOST Ilocos Region - ITSM Unit<br />v2.1
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
