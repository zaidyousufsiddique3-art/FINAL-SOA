import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Loader2, Lock, Mail, ArrowRight } from 'lucide-react';
import LogoImage from '../constants/Alogo.png';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error(err);
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B0C10] flex flex-col items-center justify-center p-6 text-gray-900 dark:text-[#E5E7EB]">
      <div className="w-full max-w-md bg-white dark:bg-[#16181D] border border-gray-200 dark:border-[#2A2D33] rounded-2xl shadow-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#14F1E1] to-[#5B6CFF]"></div>

        <div className="flex flex-col items-center mb-8">
          <div className="bg-white p-4 rounded-xl mb-6 shadow-lg border border-gray-100 dark:border-gray-700">
            <img src={LogoImage} alt="Company Logo" className="h-16 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Statement Generator</h1>
          <p className="text-gray-500 dark:text-gray-500 text-sm mt-1">Sign in to access your account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 dark:text-[#A1A5B0] uppercase tracking-wide ml-1">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail size={16} className="text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-50 dark:bg-[#0B0C10] border border-gray-200 dark:border-[#2A2D33] text-gray-900 dark:text-white rounded-lg py-3 pl-10 pr-4 text-sm outline-none focus:border-[#14F1E1] focus:ring-1 focus:ring-[#14F1E1] transition-all placeholder-gray-400 dark:placeholder-gray-600"
                placeholder="Enter your email"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 dark:text-[#A1A5B0] uppercase tracking-wide ml-1">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={16} className="text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 dark:bg-[#0B0C10] border border-gray-200 dark:border-[#2A2D33] text-gray-900 dark:text-white rounded-lg py-3 pl-10 pr-4 text-sm outline-none focus:border-[#14F1E1] focus:ring-1 focus:ring-[#14F1E1] transition-all placeholder-gray-400 dark:placeholder-gray-600"
                placeholder="Enter your password"
                required
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs p-3 rounded-lg text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#14F1E1] hover:bg-[#0FF4C6] text-[#0B0C10] py-3 rounded-xl font-bold text-sm shadow-[0_0_15px_rgba(20,241,225,0.3)] hover:shadow-[0_0_25px_rgba(20,241,225,0.5)] transition-all flex items-center justify-center gap-2 transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                Sign In <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>
      <p className="mt-8 text-gray-500 dark:text-[#A1A5B0] text-xs">
        &copy; {new Date().getFullYear()} Afdhal Al Aghdhia for Trading
      </p>
    </div>
  );
};