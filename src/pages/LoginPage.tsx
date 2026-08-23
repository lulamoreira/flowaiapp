import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { lovable } from '@/integrations/lovable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Lock, Info } from 'lucide-react';

export default function LoginPage() {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [showPreviewWarning, setShowPreviewWarning] = useState(false);

  useEffect(() => {
    const isFramed = window.parent && window.parent !== window;
    const isPreview = window.location.hostname.includes('lovable.app') || 
                      window.location.hostname.includes('gptengineer.run');
    
    if (isFramed && isPreview) {
      setShowPreviewWarning(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error(error.message);
    setLoading(false);
  };

  const handleSocialLogin = async (provider: 'google') => {
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4 py-12">
      {showPreviewWarning && (
        <div className="w-full max-w-[400px] mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3 animate-in slide-in-from-top-4 duration-500">
          <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            Você está no preview do editor. Se o login não persistir aqui, abra o app em uma aba separada.
          </p>
        </div>
      )}
      <div className="w-full max-w-[400px]">
        <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-xl">
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6c6ff5] to-[#ab68ff] flex items-center justify-center text-sm font-bold text-white">F</div>
            <span className="text-2xl font-bold text-foreground">FlowAI</span>
          </div>

          {user && (
            <div className="mb-6 p-4 bg-muted/50 border border-primary/20 rounded-lg space-y-3 animate-in fade-in zoom-in duration-300">
              <p className="text-sm text-center text-muted-foreground">
                Você já possui uma sessão ativa como:<br/>
                <strong className="text-foreground">{user.email}</strong>
              </p>
              <div className="flex flex-col gap-2">
                <Button className="w-full bg-primary" onClick={() => window.location.href = '/'}>
                  Continuar como {user.email?.split('@')[0]}
                </Button>
                <Button variant="outline" className="w-full" onClick={() => window.location.href = '/logout'}>
                  Entrar com outra conta
                </Button>
              </div>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-wider"><span className="bg-card px-2 text-muted-foreground">Ou use o formulário abaixo</span></div>
              </div>
            </div>
          )}

          <h2 className="text-lg font-semibold text-foreground text-center mb-1">Bem-vindo de volta</h2>
          <p className="text-sm text-muted-foreground text-center mb-6">Faça login para continuar</p>

          {/* Social Login */}
          <div className="space-y-3 mb-6">
            <Button variant="outline" className="w-full gap-2 h-11" onClick={() => handleSocialLogin('google')}>
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continuar com Google
            </Button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">ou</span></div>
          </div>

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

          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-xs text-center text-muted-foreground">
              O acesso ao sistema é restrito a convidados.<br/>
              Se você recebeu um convite, use o link enviado pelo seu administrador.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
