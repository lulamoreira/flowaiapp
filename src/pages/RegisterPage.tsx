import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const prefilledName = searchParams.get('name') || '';
  const prefilledRole = searchParams.get('role') || 'viewer';
  const [invitation, setInvitation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fullName, setFullName] = useState(prefilledName);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Token de convite inválido.');
      setLoading(false);
      return;
    }

    const fetchInvitation = async () => {
      const { data, error: fetchError } = await supabase
        .from('invitations')
        .select('*')
        .eq('token', token)
        .single();

      if (fetchError || !data) {
        setError('Convite não encontrado.');
      } else if (data.status !== 'pending') {
        setError('Este convite já foi utilizado.');
      } else if (new Date(data.expires_at) < new Date()) {
        setError('Este convite expirou.');
      } else {
        setInvitation(data);
        if (data.email) setEmail(data.email);
        if (data.invited_name && !prefilledName) setFullName(data.invited_name);
      }
      setLoading(false);
    };

    fetchInvitation();
  }, [token]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation) return;
    const finalEmail = (invitation.email || email).trim().toLowerCase();
    if (!finalEmail) {
      toast.error('Informe seu email');
      return;
    }
    setSubmitting(true);

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: finalEmail,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });

    if (signUpError) {
      toast.error(signUpError.message);
      setSubmitting(false);
      return;
    }

    // Update profile with extra data
    if (authData.user) {
      await supabase.from('profiles').update({
        full_name: fullName,
        date_of_birth: dateOfBirth || null,
      }).eq('user_id', authData.user.id);

      // Apply the role from the invite URL (default viewer is set by trigger)
      if (prefilledRole && prefilledRole !== 'viewer') {
        await supabase.from('user_roles').update({
          role: prefilledRole as any,
        }).eq('user_id', authData.user.id);
      }

    }

    // Mark invitation as accepted via SECURITY DEFINER RPC.
    // This works even if the user has no active session yet (email confirmation enabled).
    // The DB trigger `notify_invitation_accepted` will create the notification for the inviter.
    const { error: acceptError } = await supabase.rpc('accept_invitation_by_token', {
      _token: token!,
      _accepted_user_id: authData.user?.id ?? null,
    });
    if (acceptError) {
      console.error('Failed to mark invitation as accepted:', acceptError);
    }

    toast.success('Cadastro realizado com sucesso!');
    navigate('/');
    setSubmitting(false);
  };

  const handleSocialRegister = async (provider: 'google' | 'apple') => {
    if (!invitation) return;
    localStorage.setItem('flowai-invite-token', token || '');
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: `${window.location.origin}/register?token=${token}`,
    });
    if (result?.error) toast.error(String(result.error));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg max-w-md w-full text-center">
          <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-br from-[#6c6ff5] to-[#ab68ff] flex items-center justify-center text-sm font-bold text-white mb-4">F</div>
          <h2 className="text-lg font-semibold text-foreground mb-2">Convite Inválido</h2>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => navigate('/login')} variant="outline">Ir para Login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg">
          <div className="flex items-center gap-2 mb-6 justify-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6c6ff5] to-[#ab68ff] flex items-center justify-center text-sm font-bold text-white">F</div>
            <span className="text-2xl font-bold text-foreground">FlowAI</span>
          </div>

          <h2 className="text-lg font-semibold text-foreground text-center mb-1">Complete seu cadastro</h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Você foi convidado para o FlowAI
          </p>

          {/* Social */}
          <div className="space-y-3 mb-6">
            <Button variant="outline" className="w-full gap-2 h-11" onClick={() => handleSocialRegister('google')}>
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Cadastrar com Google
            </Button>
            <Button variant="outline" className="w-full gap-2 h-11" onClick={() => handleSocialRegister('apple')}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-1.55 4.3-3.74 4.25z"/></svg>
              Cadastrar com Apple
            </Button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">ou preencha manualmente</span></div>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <Label htmlFor="full-name">Nome completo *</Label>
              <Input id="full-name" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="Seu nome completo" />
            </div>
            <div>
              <Label htmlFor="dob">Data de nascimento *</Label>
              <Input id="dob" type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="reg-email">Email *</Label>
              <Input
                id="reg-email"
                type="email"
                value={invitation?.email || email}
                onChange={e => setEmail(e.target.value)}
                disabled={!!invitation?.email}
                className={invitation?.email ? 'bg-muted' : ''}
                required
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <Label htmlFor="reg-password">Senha *</Label>
              <Input id="reg-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Mínimo 6 caracteres" minLength={6} />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={submitting}>
              {submitting ? 'Cadastrando...' : 'Concluir Cadastro'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
