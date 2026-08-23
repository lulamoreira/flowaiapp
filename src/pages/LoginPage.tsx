import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { lovable } from '@/integrations/lovable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Mail, Lock, Wand2 } from 'lucide-react';

export default function LoginPage() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [magicEmail, setMagicEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [showSignup, setShowSignup] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        data: { full_name: signupName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) toast.error(error.message);
    else toast.success('Conta criada com sucesso!');
    setLoading(false);
  };
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error(error.message);
    setLoading(false);
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: magicEmail,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) toast.error(error.message);
    else toast.success('Link mágico enviado! Verifique seu email.');
    setLoading(false);
  };

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result?.error) toast.error(String(result.error));
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success('Email de recuperação enviado!');
    setLoading(false);
    setResetMode(false);
  };

  if (user) return <Navigate to="/" replace />;

  if (resetMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6c6ff5] to-[#ab68ff] flex items-center justify-center text-sm font-bold text-white">F</div>
              <span className="text-xl font-bold text-foreground">FlowAI</span>
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Recuperar Senha</h2>
            <p className="text-sm text-muted-foreground mb-6">Enviaremos um link para redefinir sua senha.</p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <Label htmlFor="reset-email">Email</Label>
                <Input id="reset-email" type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required placeholder="seu@email.com" />
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={loading}>
                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setResetMode(false)}>
                Voltar ao login
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-[400px]">
        <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-xl">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6c6ff5] to-[#ab68ff] flex items-center justify-center text-sm font-bold text-white">F</div>
            <span className="text-2xl font-bold text-foreground">FlowAI</span>
          </div>

          <h2 className="text-lg font-semibold text-foreground text-center mb-1">Bem-vindo de volta</h2>
          <p className="text-sm text-muted-foreground text-center mb-6">Faça login para continuar</p>

          {/* Social Login */}
          <div className="space-y-3 mb-6">
            <Button variant="outline" className="w-full gap-2 h-11" onClick={() => handleSocialLogin('google')}>
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continuar com Google
            </Button>
            <Button variant="outline" className="w-full gap-2 h-11" onClick={() => handleSocialLogin('apple')}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-1.55 4.3-3.74 4.25z"/></svg>
              Continuar com Apple
            </Button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">ou</span></div>
          </div>

          <Tabs defaultValue="email" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="email" className="text-xs gap-1"><Lock className="h-3 w-3" /> Email e Senha</TabsTrigger>
              <TabsTrigger value="magic" className="text-xs gap-1"><Wand2 className="h-3 w-3" /> Magic Link</TabsTrigger>
            </TabsList>

            <TabsContent value="email">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" />
                </div>
                <div>
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
                </div>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={loading}>
                  {loading ? 'Entrando...' : 'Entrar'}
                </Button>
                <button type="button" className="w-full text-sm text-primary hover:underline" onClick={() => setResetMode(true)}>
                  Esqueceu sua senha?
                </button>
              </form>
            </TabsContent>

            <TabsContent value="magic">
              <form onSubmit={handleMagicLink} className="space-y-4">
                <div>
                  <Label htmlFor="magic-email">Email</Label>
                  <Input id="magic-email" type="email" value={magicEmail} onChange={e => setMagicEmail(e.target.value)} required placeholder="seu@email.com" />
                </div>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 gap-2" disabled={loading}>
                  <Mail className="h-4 w-4" />
                  {loading ? 'Enviando...' : 'Enviar Magic Link'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="border-t border-border mt-6 pt-4">
            <p className="text-xs text-muted-foreground text-center mb-3">Não tem conta?</p>
            <Button variant="outline" className="w-full" onClick={() => setShowSignup(true)}>
              Criar conta de teste
            </Button>
          </div>
        </div>
      </div>
      {showSignup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-card border border-border rounded-2xl p-8 shadow-lg w-full max-w-md">
            <h2 className="text-lg font-semibold text-foreground mb-4">Criar conta de teste</h2>
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <Label htmlFor="signup-name">Nome completo</Label>
                <Input id="signup-name" value={signupName} onChange={e => setSignupName(e.target.value)} required placeholder="Seu nome" />
              </div>
              <div>
                <Label htmlFor="signup-email">Email</Label>
                <Input id="signup-email" type="email" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} required placeholder="seu@email.com" />
              </div>
              <div>
                <Label htmlFor="signup-password">Senha</Label>
                <Input id="signup-password" type="password" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} required placeholder="Mínimo 6 caracteres" minLength={6} />
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={loading}>
                {loading ? 'Criando...' : 'Criar conta'}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setShowSignup(false)}>
                Voltar ao login
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
