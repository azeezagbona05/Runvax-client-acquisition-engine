import Link from 'next/link';
import { DEFAULT_HOME } from '@/lib/home';
import { CheckCircle, Mail } from 'lucide-react';

// New Google accounts land here (NextAuth `pages.newUser`) so they see that sign-up worked,
// instead of being dropped back on the sign-up form while already signed in.
export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl p-10 shadow-2xl text-center space-y-4">
        <CheckCircle className="w-14 h-14 mx-auto text-green-400" />
        <h1 className="text-xl font-black text-white">Your account is ready</h1>
        <p className="text-gray-400 text-sm max-w-xs mx-auto">
          Sign-up is complete and you are signed in with Google. You can use the same Google button to log in next time.
        </p>
        <p className="flex items-center justify-center gap-2 text-gray-500 text-xs">
          <Mail className="w-3.5 h-3.5" /> A welcome email is on its way. Check spam if you don&apos;t see it.
        </p>
        <Link
          href={DEFAULT_HOME}
          className="block w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
        >
          Start finding clients
        </Link>
      </div>
    </div>
  );
}
