import { useState } from 'react';
import { signIn, supabase } from '../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try { await signIn(email, password); }
    catch (err) { setError(err.message || 'Invalid credentials'); }
    finally { setLoading(false); }
  }

  async function handleReset() {
    if (!email) { setError('Enter your email address first.'); return; }
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setResetSent(true);
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'repeating-linear-gradient(45deg,#f97316 0,#f97316 1px,transparent 0,transparent 50%)', backgroundSize: '20px 20px' }} />
      </div>
      <div className="relative w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 rounded-xl mb-4 shadow-lg shadow-orange-500/30">
            <span className="text-white font-black text-xl">SSI</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Steel Bid Pipeline</h1>
          <p className="text-gray-500 text-sm mt-1">Southern Spear Ironworks</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-6">Sign in to your account</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                placeholder="you@southernspearironworks.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
                placeholder="••••••••" />
            </div>
            {error && <div className="bg-red-900/30 border border-red-700 rounded-lg px-3.5 py-2.5 text-sm text-red-400">{error}</div>}
            {resetSent && <div className="bg-green-900/30 border border-green-700 rounded-lg px-3.5 py-2.5 text-sm text-green-400">Reset link sent — check your email.</div>}
            <button type="submit" disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors shadow-lg shadow-orange-500/20">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
          <button onClick={handleReset} className="w-full text-center text-xs text-gray-600 hover:text-orange-400 mt-4 transition-colors">
            Forgot password? Send reset link
          </button>
          <p className="text-center text-xs text-gray-700 mt-3">Don't have an account? Contact a Manager.</p>
        </div>
      </div>
    </div>
  );
}
