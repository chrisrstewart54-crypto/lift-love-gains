import { useState } from 'react';
import { Dumbbell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { toast } from 'sonner';

export default function Auth() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      if (error) toast.error(error.message);
      else toast.success('Check your email to confirm your account.');
    }
    setBusy(false);
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth('google', { redirect_uri: window.location.origin });
    if (result.error) toast.error(result.error.message ?? 'Google sign-in failed');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <Dumbbell className="w-12 h-12 text-primary mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">{mode === 'signin' ? 'Welcome back' : 'Create account'}</h1>
        </div>
        <button onClick={google} className="w-full py-3.5 rounded-xl bg-card border border-border text-foreground font-medium">
          Continue with Google
        </button>
        <div className="text-center text-xs text-muted-foreground">or</div>
        <form onSubmit={submit} className="space-y-3">
          <input type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-3.5 rounded-xl bg-muted text-foreground" />
          <input type="password" required minLength={6} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-3.5 rounded-xl bg-muted text-foreground" />
          <button disabled={busy} className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold disabled:opacity-50">
            {mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
        </form>
        <button onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')} className="w-full text-sm text-muted-foreground">
          {mode === 'signin' ? "No account? Sign up" : 'Have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
