import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setValid(true);
    }
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) toast.error(error.message);
    else {
      toast.success('Senha redefinida com sucesso!');
      navigate('/');
    }
    setLoading(false);
  };

  if (!valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg max-w-md w-full text-center">
          <h2 className="text-lg font-semibold mb-2">Link inválido</h2>
          <p className="text-sm text-muted-foreground mb-4">Este link de recuperação é inválido ou expirou.</p>
          <Button onClick={() => navigate('/login')}>Ir para Login</Button>
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
          <h2 className="text-lg font-semibold text-center mb-6">Redefinir Senha</h2>
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <Label htmlFor="new-pass">Nova senha</Label>
              <Input id="new-pass" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="Mínimo 6 caracteres" />
            </div>
            <div>
              <Label htmlFor="confirm-pass">Confirmar senha</Label>
              <Input id="confirm-pass" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} placeholder="Repita a senha" />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={loading}>
              {loading ? 'Redefinindo...' : 'Redefinir Senha'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
