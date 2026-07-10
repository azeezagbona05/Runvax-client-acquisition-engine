'use client';

import { X, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Props {
  onClose: () => void;
  message?: string;
}

export default function AuthModal({ onClose, message }: Props) {
  const router = useRouter();

  const handleLogin = () => {
    router.push('/auth/signin');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm bg-gray-900 border border-white/10 rounded-t-3xl sm:rounded-2xl p-6 pb-8 sm:pb-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
            <LogIn className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg mb-1">Login required</h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              {message ?? 'Create a free account to save prospects, track your pipeline, and generate AI outreach.'}
            </p>
          </div>
          <button
            onClick={handleLogin}
            className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-purple-600 to-orange-500 text-white hover:opacity-90 transition-opacity"
          >
            Login / Sign up free
          </button>
          <button onClick={onClose} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
