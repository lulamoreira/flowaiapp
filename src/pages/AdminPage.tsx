import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Users, Mail, History, Shield, UserPlus, Settings, Trash2, Pencil, Activity, Search, CalendarIcon, X, UserCheck, CheckCircle2, RefreshCcw } from 'lucide-react';
import { DeleteConfirmDialog } from '@/components/ui/DeleteConfirmDialog';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';

type AppRole = Database['public']['Enums']['app_role'];
type InvitationStatus = Database['public']['Enums']['invitation_status'];

interface UserWithRole {
  user_id: string;
  full_name: string;
  status: string;
  created_at: string;
  roles: AppRole[];
  email?: string;
}

interface Invitation {
  id: string;
  email: string;
  status: InvitationStatus;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  invited_by: string;
}

interface CustomFunction {
  id: string;
  name: string;
  description: string | null;
  permissions: { module: string; can_edit: boolean; can_delete: boolean }[];
}

interface ActivityEntry {
  id: string;
  user_id: string | null;
  action: string;
  details: any;
  created_at: string;
}

interface PlaceholderMember {
  id: string;
  full_name: string;
  email: string | null;
  intended_role: AppRole;
  created_at: string;
  claimed_by: string | null;
  claimed_at: string | null;
}

interface DeletionLogEntry {
  id: string;
  table_name: string;
  original_id: string;
  data: any;
  deleted_at: string;
  deleted_by: string | null;
  board_id: string | null;
  confirm_details?: any | null;
}

const SYSTEM_MODULES = ['boards', 'tasks', 'reports', 'users', 'invitations', 'automations'];

export default function AdminPage() {
  const { user, isAdmin, isOwner, isCoordinator, isAdminOrCoordinator } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [customFunctions, setCustomFunctions] = useState<CustomFunction[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [placeholders, setPlaceholders] = useState<PlaceholderMember[]>([]);
  const [deletionLog, setDeletionLog] = useState<DeletionLogEntry[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // Placeholder dialog
  const [placeholderDialogOpen, setPlaceholderDialogOpen] = useState(false);
  const [editingPlaceholder, setEditingPlaceholder] = useState<PlaceholderMember | null>(null);
  const [phName, setPhName] = useState('');
  const [phEmail, setPhEmail] = useState('');
  const [phRole, setPhRole] = useState<AppRole>('viewer');
  const [phSaving, setPhSaving] = useState(false);

  // Claim dialog
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [selectedPlaceholder, setSelectedPlaceholder] = useState<PlaceholderMember | null>(null);
  const [targetUserId, setTargetUserId] = useState('');
  const [claimSummary, setClaimSummary] = useState<{ tasks: number; subtasks: number } | null>(null);
  const [claiming, setClaiming] = useState(false);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<AppRole>('viewer');
  const [inviteSending, setInviteSending] = useState(false);

  // Role dialog
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole>('viewer');

  // Function dialog
  const [funcDialogOpen, setFuncDialogOpen] = useState(false);
  const [editingFunc, setEditingFunc] = useState<CustomFunction | null>(null);
  const [funcName, setFuncName] = useState('');
  const [funcDesc, setFuncDesc] = useState('');
  const [funcPerms, setFuncPerms] = useState<Record<string, { can_edit: boolean; can_delete: boolean }>>({});

  // Assign function dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignFuncId, setAssignFuncId] = useState('');

  // Activity log filters
  const [logSearch, setLogSearch] = useState('');
  const [logUserFilter, setLogUserFilter] = useState('all');
  const [logDateFrom, setLogDateFrom] = useState<Date | undefined>(undefined);
  const [logDateTo, setLogDateTo] = useState<Date | undefined>(undefined);
  const [logPage, setLogPage] = useState(1);
  const LOG_PER_PAGE = 20;

  const filteredActivityLog = useMemo(() => {
    return activityLog.filter(log => {
      if (logSearch) {
        const q = logSearch.toLowerCase();
        const logUser = users.find(u => u.user_id === log.user_id);
        const details = log.details ? (typeof log.details === 'string' ? log.details : JSON.stringify(log.details)) : '';
        if (!log.action.toLowerCase().includes(q) && !details.toLowerCase().includes(q) && !(logUser?.full_name || '').toLowerCase().includes(q)) return false;
      }
      if (logUserFilter !== 'all' && log.user_id !== logUserFilter) return false;
      if (logDateFrom) {
        const logDate = new Date(log.created_at);
        if (logDate < startOfDay(logDateFrom)) return false;
      }
      if (logDateTo) {
        const logDate = new Date(log.created_at);
        if (logDate > endOfDay(logDateTo)) return false;
      }
      return true;
    });
  }, [activityLog, logSearch, logUserFilter, logDateFrom, logDateTo, users]);

  // Reset page when filters change
  useEffect(() => { setLogPage(1); }, [logSearch, logUserFilter, logDateFrom, logDateTo]);

  const logTotalPages = Math.max(1, Math.ceil(filteredActivityLog.length / LOG_PER_PAGE));
  const paginatedActivityLog = useMemo(() => {
    const start = (logPage - 1) * LOG_PER_PAGE;
    return filteredActivityLog.slice(start, start + LOG_PER_PAGE);
  }, [filteredActivityLog, logPage]);

  useEffect(() => {
    if (!loading) return;
    fetchAll();
  }, []);

  // Re-fetch activity log when role becomes available
  useEffect(() => {
    if (isAdminOrCoordinator && activityLog.length === 0) {
      supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(200)
        .then(({ data }) => { if (data) setActivityLog(data); });
    }
  }, [isAdminOrCoordinator]);

  const fetchAll = useCallback(async () => {
    // Fetch profiles
    const { data: profiles } = await supabase.from('profiles').select('*');

    // Fetch roles
    const { data: roles } = await supabase.from('user_roles').select('*');

    // Merge
    const usersWithRoles: UserWithRole[] = (profiles || []).map(p => ({
      user_id: p.user_id,
      full_name: p.full_name,
      status: p.status,
      created_at: p.created_at,
      roles: (roles || []).filter(r => r.user_id === p.user_id).map(r => r.role),
    }));
    setUsers(usersWithRoles);

    // Fetch invitations
    const { data: invs } = await supabase.from('invitations').select('*').order('created_at', { ascending: false });
    setInvitations(invs || []);

    // Fetch custom functions with permissions
    const { data: funcs } = await supabase.from('custom_functions').select('*');
    const { data: perms } = await supabase.from('function_permissions').select('*');
    const funcsWithPerms: CustomFunction[] = (funcs || []).map(f => ({
      ...f,
      permissions: (perms || []).filter(p => p.function_id === f.id).map(p => ({
        module: p.module,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
      })),
    }));
    setCustomFunctions(funcsWithPerms);

    // Fetch placeholders
    const { data: phData } = await supabase.from('placeholder_members').select('*').order('created_at', { ascending: false });
    setPlaceholders(phData || []);

    // Fetch activity log (admin and coordinator)
    if (isAdminOrCoordinator) {
      const { data: logs } = await supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(200);
      setActivityLog(logs || []);
      
      const { data: delLogs } = await supabase.from('deletion_log').select('*').order('deleted_at', { ascending: false });
      setDeletionLog(delLogs || []);

      const { data: backupData } = await supabase.from('backup_snapshots').select('*').order('created_at', { ascending: false });
      setBackups(backupData || []);
    }

    setLoading(false);
  }, [isAdminOrCoordinator]);

  // 🔴 Realtime: refresh whenever any admin-relevant table changes (debounced).
  // Safe for forms — only triggers data refetch, never touches input state.
  useRealtimeRefresh(
    [
      'invitations',
      'profiles',
      'user_roles',
      'custom_functions',
      'function_permissions',
      'user_custom_functions',
      'activity_log',
      'placeholder_members',
      'deletion_log',
    ],
    fetchAll,
    { channelName: 'admin-page-rt' }
  );

  const handleSendInvite = async () => {
    if (!inviteEmail.trim() || !user) return;
    setInviteSending(true);

    const { data, error } = await supabase.from('invitations').insert({
      invited_by: user.id,
      email: inviteEmail.trim(),
    }).select().single();

    if (error) {
      toast.error('Erro ao criar convite: ' + error.message);
    } else if (data) {
      const registerUrl = `${window.location.origin}/register?token=${data.token}&name=${encodeURIComponent(inviteName)}&role=${inviteRole}`;
      const subject = encodeURIComponent('Convite para o FlowAI');
      const body = encodeURIComponent(`Olá${inviteName ? ' ' + inviteName : ''}!\n\nVocê foi convidado para participar do FlowAI.\n\nClique no link para se cadastrar:\n${registerUrl}\n\nVocê pode acessar com Google, Apple ou criar uma senha.\n\nEste convite expira em 72 horas.\n\nAguardamos você!`);
      window.open(`mailto:${inviteEmail}?subject=${subject}&body=${body}`);
      toast.success('Convite criado! O email será aberto para envio.');
      setInviteEmail('');
      setInviteName('');
      setInviteRole('viewer');
      setInviteOpen(false);
      fetchAll();
    }
    setInviteSending(false);
  };

  const handleChangeRole = async () => {
    if (!selectedUser || !user) return;
    
    // Protection b: Prevent removing the last admin/owner
    if (selectedUser.roles.some(r => r === 'admin' || r === 'owner')) {
      const otherAdmins = users.filter(u => 
        u.user_id !== selectedUser.user_id && 
        u.roles.some(r => r === 'admin' || r === 'owner')
      );
      if (otherAdmins.length === 0 && selectedRole !== 'admin' && selectedRole !== 'owner') {
        toast.error('Operação bloqueada: o sistema não pode ficar sem nenhum administrador ou dono.');
        return;
      }
    }

    // Protection c: Warning when demoting self
    if (selectedUser.user_id === user.id && (selectedRole === 'viewer' || selectedRole === 'user')) {
      if (!confirm('AVISO: Você está prestes a remover seus próprios privilégios administrativos. Você perderá o acesso a esta página imediatamente. Confirmar?')) {
        return;
      }
    }

    // Protection a: Preserve 'owner' role and don't delete everything indiscriminately
    // We only want to swap the "operational" role (admin, coordinator, user, viewer)
    const operationalRoles: AppRole[] = ['admin', 'coordinator', 'user', 'viewer'];
    
    // Get roles to keep (like 'owner' or others outside the operational set)
    const rolesToKeep = selectedUser.roles.filter(r => !operationalRoles.includes(r));
    
    // New set of roles
    const newRoles = Array.from(new Set([...rolesToKeep, selectedRole]));

    // Transactional update: delete old operational roles and insert the new one
    // But since Supabase client doesn't do transactions easily here, we do:
    const { error: deleteError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', selectedUser.user_id)
      .in('role', operationalRoles);

    if (deleteError) {
      toast.error('Erro ao limpar papéis anteriores: ' + deleteError.message);
      return;
    }

    const { error: insertError } = await supabase
      .from('user_roles')
      .insert({
        user_id: selectedUser.user_id,
        role: selectedRole,
      });

    if (insertError) {
      toast.error('Erro ao atribuir novo papel: ' + insertError.message);
    } else {
      toast.success(`Papel de ${selectedUser.full_name} alterado para ${selectedRole}`);
      setRoleDialogOpen(false);
      fetchAll();
    }
  };

  const openFuncDialog = (func?: CustomFunction) => {
    if (func) {
      setEditingFunc(func);
      setFuncName(func.name);
      setFuncDesc(func.description || '');
      const perms: Record<string, { can_edit: boolean; can_delete: boolean }> = {};
      func.permissions.forEach(p => { perms[p.module] = { can_edit: p.can_edit, can_delete: p.can_delete }; });
      setFuncPerms(perms);
    } else {
      setEditingFunc(null);
      setFuncName('');
      setFuncDesc('');
      setFuncPerms({});
    }
    setFuncDialogOpen(true);
  };

  const handleSaveFunction = async () => {
    if (!funcName.trim() || !user) return;

    if (editingFunc) {
      await supabase.from('custom_functions').update({ name: funcName, description: funcDesc }).eq('id', editingFunc.id);
      await supabase.from('function_permissions').delete().eq('function_id', editingFunc.id);
      const permsToInsert = Object.entries(funcPerms).map(([module, p]) => ({
        function_id: editingFunc.id,
        module,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
      }));
      if (permsToInsert.length > 0) await supabase.from('function_permissions').insert(permsToInsert);
      toast.success('Função atualizada!');
    } else {
      const { data: newFunc } = await supabase.from('custom_functions').insert({
        name: funcName,
        description: funcDesc,
        created_by: user.id,
      }).select().single();

      if (newFunc) {
        const permsToInsert = Object.entries(funcPerms).map(([module, p]) => ({
          function_id: newFunc.id,
          module,
          can_edit: p.can_edit,
          can_delete: p.can_delete,
        }));
        if (permsToInsert.length > 0) await supabase.from('function_permissions').insert(permsToInsert);
      }
      toast.success('Função criada!');
    }
    setFuncDialogOpen(false);
    fetchAll();
  };

  const handleDeleteFunction = async (id: string) => {
    if (!confirm('Excluir esta função?')) return;
    await supabase.from('custom_functions').delete().eq('id', id);
    toast.success('Função excluída');
    fetchAll();
  };

  const handleDeleteInvitation = async (inv: Invitation) => {
    if (inv.status !== 'pending') {
      toast.error('Apenas convites pendentes podem ser excluídos.');
      return;
    }
    const label = inv.email || (inv as any).invited_name || 'este convite';
    if (!confirm(`Excluir o convite de ${label}? O link deixará de funcionar.`)) return;
    const { error } = await supabase.from('invitations').delete().eq('id', inv.id);
    if (error) {
      toast.error('Erro ao excluir convite: ' + error.message);
      return;
    }
    toast.success('Convite excluído. O link não funciona mais.');
    fetchAll();
  };

  const handleAssignFunction = async () => {
    if (!assignUserId || !assignFuncId || !user) return;
    
    // Upsert (delete old, insert new)
    const { error: deleteError } = await supabase.from('user_custom_functions').delete().eq('user_id', assignUserId);
    if (deleteError) {
      toast.error('Erro ao remover função anterior: ' + deleteError.message);
      return;
    }

    const { error } = await supabase.from('user_custom_functions').insert({
      user_id: assignUserId,
      function_id: assignFuncId,
      assigned_by: user.id,
    });
    if (error) {
      toast.error('Erro ao atribuir função: ' + error.message);
    } else {
      toast.success('Função atribuída!');
      setAssignOpen(false);
      fetchAll();
    }
  };

  const handleSavePlaceholder = async () => {
    if (!phName.trim() || !user) return;
    setPhSaving(true);

    try {
      if (editingPlaceholder) {
        const { error } = await supabase.from('placeholder_members').update({
          full_name: phName.trim(),
          email: phEmail.trim() || null,
          intended_role: phRole,
        }).eq('id', editingPlaceholder.id);
        if (error) throw error;
        toast.success('Membro provisório atualizado!');
      } else {
        const { error } = await supabase.from('placeholder_members').insert({
          full_name: phName.trim(),
          email: phEmail.trim() || null,
          intended_role: phRole,
          created_by: user.id,
        });
        if (error) throw error;
        toast.success('Membro provisório criado!');
      }
      setPlaceholderDialogOpen(false);
      fetchAll();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setPhSaving(false);
    }
  };

  const handleDeletePlaceholder = async (ph: PlaceholderMember) => {
    // Count tasks assigned to this placeholder
    const { count, error: countError } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('assignee', ph.id);
    
    if (countError) {
      toast.error('Erro ao verificar tarefas: ' + countError.message);
      return;
    }

    const message = count && count > 0 
      ? `Este membro possui ${count} tarefas atribuídas. Se você excluir, estas tarefas ficarão sem responsável. Continuar?`
      : `Deseja excluir o membro provisório ${ph.full_name}?`;

    if (!confirm(message)) return;

    // Explicitly delete project memberships since FK CASCADE was removed
    const { error: membersError } = await supabase.from('project_members' as any).delete().eq('user_id', ph.id);
    if (membersError) {
      toast.error('Erro ao remover participações em projetos: ' + membersError.message);
      return;
    }
    
    const { error } = await supabase.from('placeholder_members').delete().eq('id', ph.id);
    if (error) {
      toast.error('Erro ao excluir membro provisório: ' + error.message);
    } else {
      toast.success('Membro provisório excluído.');
      fetchAll();
    }
  };

  const handleClaimPlaceholder = async () => {
    if (!selectedPlaceholder || !targetUserId) return;
    setClaiming(true);

    try {
      const { data, error } = await supabase.rpc('claim_placeholder', {
        p_placeholder_id: selectedPlaceholder.id,
        p_target_user_id: targetUserId,
      });

      if (error) throw error;

      const result = data as { tasks_migrated: number };
      toast.success(`Sucesso! ${result.tasks_migrated} tarefas migradas.`);
      setClaimDialogOpen(false);
      fetchAll();
    } catch (err: any) {
      toast.error('Erro na conversão: ' + err.message);
    } finally {
      setClaiming(false);
    }
  };

  const handleRestoreItem = async (log: DeletionLogEntry) => {
    setRestoringId(log.id);
    try {
      const { table_name, data } = log;
      
      // Basic check for tasks: if groupId or boardId no longer exist, it might fail
      // In a more robust system, we'd handle orphan restoration
      const { error: restoreError } = await supabase.from(table_name as any).insert(data);
      
      if (restoreError) throw restoreError;
      
      const { error: deleteLogError } = await supabase.from('deletion_log').delete().eq('id', log.id);
      if (deleteLogError) console.error("Could not delete deletion log entry", deleteLogError);
      
      toast.success("Item restaurado com sucesso!");
      fetchAll();
    } catch (err: any) {
      console.error("Erro ao restaurar item:", err);
      toast.error("Erro ao restaurar: " + err.message);
    } finally {
      setRestoringId(null);
    }
  };

  const openPlaceholderDialog = (ph?: PlaceholderMember) => {
    if (ph) {
      setEditingPlaceholder(ph);
      setPhName(ph.full_name);
      setPhEmail(ph.email || '');
      setPhRole(ph.intended_role);
    } else {
      setEditingPlaceholder(null);
      setPhName('');
      setPhEmail('');
      setPhRole('viewer');
    }
    setPlaceholderDialogOpen(true);
  };

  const openClaimDialog = async (ph: PlaceholderMember) => {
    setSelectedPlaceholder(ph);
    setTargetUserId('');
    setClaimSummary(null);
    
    // Fetch summary
    const { count: taskCount } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('assignee', ph.id);
    
    // Subtasks count is harder to get via simple query if stored in JSONB, 
    // but for the UI summary we can just say "tarefas e subtarefas serão migradas".
    setClaimSummary({ tasks: taskCount || 0, subtasks: 0 });
    setClaimDialogOpen(true);
  };

  const roleLabel = (role: AppRole) => {
    switch (role) {
      case 'owner': return 'Dono';
      case 'admin': return 'Admin';
      case 'coordinator': return 'Coordenador';
      case 'user': return 'Usuário';
      case 'viewer': return 'Visualizador';
    }
  };

  const roleBadgeColor = (role: AppRole) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'coordinator': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'user': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'viewer': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    }
  };

  const statusBadge = (s: InvitationStatus) => {
    switch (s) {
      case 'pending': return <Badge variant="outline" className="text-orange-600 border-orange-300">Pendente</Badge>;
      case 'accepted': return <Badge variant="outline" className="text-green-600 border-green-300">Aceito</Badge>;
      case 'expired': return <Badge variant="outline" className="text-muted-foreground">Expirado</Badge>;
    }
  };

  if (!isAdminOrCoordinator) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <Header title="Administração" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Header title={isAdmin || isOwner ? 'Painel Admin' : 'Painel do Coordenador'} />
      <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="users" className="gap-1"><Users className="h-3.5 w-3.5" /> Usuários</TabsTrigger>
            <TabsTrigger value="invites" className="gap-1"><Mail className="h-3.5 w-3.5" /> Convites</TabsTrigger>
            <TabsTrigger value="functions" className="gap-1"><Settings className="h-3.5 w-3.5" /> Funções</TabsTrigger>
            <TabsTrigger value="placeholders" className="gap-1"><Users className="h-3.5 w-3.5" /> Provisórios</TabsTrigger>
            <TabsTrigger value="trash" className="gap-1"><Trash2 className="h-3.5 w-3.5" /> Lixeira</TabsTrigger>
            {(isAdmin || isOwner) && <TabsTrigger value="backups" className="gap-1"><History className="h-3.5 w-3.5" /> Backups</TabsTrigger>}
            {isAdminOrCoordinator && <TabsTrigger value="activity" className="gap-1"><Activity className="h-3.5 w-3.5" /> Log</TabsTrigger>}
          </TabsList>

          {/* USERS TAB */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                Quero ter o poder de apagar/editar os usuários
              </h3>
              <div className="flex items-center gap-2">
                {selectedUser && (
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="gap-1"
                    onClick={async () => {
                      if (!user || !selectedUser) return;
                      
                      // Proteção: não pode excluir a si mesmo
                      if (selectedUser.user_id === user.id) {
                        toast.error('Você não pode excluir sua própria conta.');
                        return;
                      }

                      // Proteção: não pode deixar o sistema sem admin/owner
                      if (selectedUser.roles.some(r => r === 'admin' || r === 'owner')) {
                        const otherAdmins = users.filter(u => 
                          u.user_id !== selectedUser.user_id && 
                          u.roles.some(r => r === 'admin' || r === 'owner')
                        );
                        if (otherAdmins.length === 0) {
                          toast.error('Operação bloqueada: o sistema não pode ficar sem nenhum administrador ou dono.');
                          return;
                        }
                      }

                      // Análise de impacto
                      const { data: userTasks } = await supabase
                        .from('tasks')
                        .select('id, title, board_id, boards(title)')
                        .eq('assignee', selectedUser.user_id);

                      const taskCount = userTasks?.length || 0;
                      const affectedBoards = Array.from(new Set((userTasks || []).map(t => (t.boards as any)?.title).filter(Boolean)));
                      
                      let description = `Tem certeza que deseja remover o perfil de ${selectedUser.full_name}? A conta de login continuará existindo, mas o perfil e os papéis serão excluídos. Nada é removido de auth.users.`;
                      
                      if (taskCount > 0) {
                        description += `\n\nEste usuário é responsável por ${taskCount} tarefa(s) nos quadros: ${affectedBoards.join(', ')}. Ao confirmar, essas tarefas ficarão sem responsável.`;
                      }

                      if (!confirm(description)) return;

                      try {
                        // 1. Log na lixeira
                        const { data: userRoles } = await supabase.from('user_roles').select('*').eq('user_id', selectedUser.user_id);
                        const { data: projectMembers } = await supabase.from('project_members').select('*').eq('user_id', selectedUser.user_id);
                        
                        const logData = {
                          profile: selectedUser,
                          roles: userRoles || [],
                          project_members: projectMembers || [],
                          tasks: userTasks || []
                        };

                        const { error: logErr } = await (supabase.from('deletion_log') as any).insert({
                          table_name: 'profiles',
                          original_id: selectedUser.user_id,
                          data: logData,
                          deleted_by: user.id
                        });
                        if (logErr) throw logErr;

                        // 2. Limpar tarefas
                        const { error: taskError } = await supabase
                          .from('tasks')
                          .update({ assignee: null })
                          .eq('assignee', selectedUser.user_id);
                        if (taskError) throw taskError;

                        // 3. Remover papéis e participações
                        const { error: rolesError } = await supabase.from('user_roles').delete().eq('user_id', selectedUser.user_id);
                        if (rolesError) throw rolesError;

                        const { error: membersError } = await supabase.from('project_members').delete().eq('user_id', selectedUser.user_id);
                        if (membersError) throw membersError;

                        const { error: funcError } = await supabase.from('user_custom_functions').delete().eq('user_id', selectedUser.user_id);
                        if (funcError) throw funcError;

                        // 4. Deletar perfil
                        const { error: profileError } = await supabase.from('profiles').delete().eq('user_id', selectedUser.user_id);
                        if (profileError) throw profileError;

                        toast.success('Perfil removido com sucesso!');
                        setSelectedUser(null);
                        fetchAll();
                      } catch (err: any) {
                        toast.error('Erro ao remover perfil: ' + err.message);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Remover Selecionado
                  </Button>
                )}
                <Button className="gap-1 bg-primary" onClick={() => setInviteOpen(true)}>
                  <UserPlus className="h-4 w-4" /> Convidar
                </Button>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Nome</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Papel</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Cadastro</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr 
                      key={u.user_id} 
                      className={cn(
                        "border-b border-border last:border-0 hover:bg-muted/30 cursor-pointer",
                        selectedUser?.user_id === u.user_id && "bg-primary/5 border-primary/20"
                      )}
                      onClick={() => setSelectedUser(u)}
                    >
                      <td className="p-3 font-medium text-foreground">{u.full_name || 'Sem nome'}</td>
                      <td className="p-3">
                        {u.roles.map(r => (
                          <span key={r} className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mr-1 ${roleBadgeColor(r)}`}>
                            {roleLabel(r)}
                          </span>
                        ))}
                      </td>
                      <td className="p-3">
                        <span className={`text-xs font-medium ${u.status === 'active' ? 'text-green-600' : 'text-orange-500'}`}>
                          {u.status === 'active' ? 'Ativo' : 'Pendente'}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString('pt-BR')}</td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1"
                          onClick={() => {
                            setSelectedUser(u);
                            setSelectedRole(u.roles[0] || 'viewer');
                            setRoleDialogOpen(true);
                          }}
                        >
                          <Shield className="h-3 w-3" /> Papel
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1"
                          onClick={() => {
                            setAssignUserId(u.user_id);
                            setAssignOpen(true);
                          }}
                        >
                          <Settings className="h-3 w-3" /> Função
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum usuário encontrado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* INVITES TAB */}
          <TabsContent value="invites" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Histórico de Convites</h3>
              <Button className="gap-1 bg-primary" onClick={() => setInviteOpen(true)}>
                <UserPlus className="h-4 w-4" /> Novo Convite
              </Button>
            </div>
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Enviado em</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Expira em</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map(inv => (
                    <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-medium text-foreground">
                        {inv.email || (inv as any).invited_name || '—'}
                        {!inv.email && (inv as any).invited_name && (
                          <span className="ml-2 text-[10px] text-muted-foreground font-normal">(via link)</span>
                        )}
                      </td>
                      <td className="p-3">{statusBadge(inv.status)}</td>
                      <td className="p-3 text-muted-foreground">{new Date(inv.created_at).toLocaleDateString('pt-BR')}</td>
                      <td className="p-3 text-muted-foreground">{new Date(inv.expires_at).toLocaleDateString('pt-BR')}</td>
                      <td className="p-3 text-right">
                        {inv.status === 'pending' ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            title="Excluir convite (invalida o link)"
                            onClick={() => handleDeleteInvitation(inv)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {invitations.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum convite enviado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* FUNCTIONS TAB */}
          <TabsContent value="functions" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Funções Customizadas</h3>
              <Button className="gap-1 bg-primary" onClick={() => openFuncDialog()}>
                <Settings className="h-4 w-4" /> Nova Função
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customFunctions.map(f => (
                <div key={f.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-foreground">{f.name}</h4>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openFuncDialog(f)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteFunction(f.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{f.description || 'Sem descrição'}</p>
                  <div className="space-y-1">
                    {f.permissions.map(p => (
                      <div key={p.module} className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-foreground capitalize">{p.module}</span>
                        {p.can_edit && <Badge variant="outline" className="text-[10px] h-4">Editar</Badge>}
                        {p.can_delete && <Badge variant="outline" className="text-[10px] h-4">Apagar</Badge>}
                      </div>
                    ))}
                    {f.permissions.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma permissão</span>}
                  </div>
                </div>
              ))}
              {customFunctions.length === 0 && (
                <p className="text-muted-foreground col-span-2 text-center py-8">Nenhuma função customizada criada</p>
              )}
            </div>
          </TabsContent>

          {/* ACTIVITY TAB (Admin & Coordinator) */}
          {isAdminOrCoordinator && (
              <TabsContent value="activity" className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Log de Atividades</h3>

              {/* Filters */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-[280px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar ação ou detalhe..."
                    value={logSearch}
                    onChange={e => setLogSearch(e.target.value)}
                    className="pl-9 h-9 bg-muted/50 border-0 text-sm"
                  />
                </div>
                <Select value={logUserFilter} onValueChange={setLogUserFilter}>
                  <SelectTrigger className="w-[160px] h-9 text-xs">
                    <SelectValue placeholder="Usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos usuários</SelectItem>
                    {users.map(u => (
                      <SelectItem key={u.user_id} value={u.user_id}>{u.full_name || 'Sem nome'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("h-9 text-xs gap-1.5 w-[150px] justify-start", !logDateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {logDateFrom ? format(logDateFrom, 'dd/MM/yyyy') : 'Data início'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={logDateFrom} onSelect={setLogDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} locale={ptBR} />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("h-9 text-xs gap-1.5 w-[150px] justify-start", !logDateTo && "text-muted-foreground")}>
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {logDateTo ? format(logDateTo, 'dd/MM/yyyy') : 'Data fim'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={logDateTo} onSelect={setLogDateTo} initialFocus className={cn("p-3 pointer-events-auto")} locale={ptBR} />
                  </PopoverContent>
                </Popover>
                {(logSearch || logUserFilter !== 'all' || logDateFrom || logDateTo) && (
                  <Button variant="ghost" size="sm" className="h-9 text-xs gap-1" onClick={() => { setLogSearch(''); setLogUserFilter('all'); setLogDateFrom(undefined); setLogDateTo(undefined); }}>
                    <X className="h-3.5 w-3.5" /> Limpar
                  </Button>
                )}
              </div>

              <div className="text-xs text-muted-foreground">{filteredActivityLog.length} registro(s)</div>

              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left p-3 font-medium text-muted-foreground w-[160px]">Data</th>
                      <th className="text-left p-3 font-medium text-muted-foreground w-[140px]">Usuário</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Ação</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedActivityLog.map(log => {
                      const logUser = users.find(u => u.user_id === log.user_id);
                      return (
                        <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString('pt-BR')}
                          </td>
                          <td className="p-3 text-foreground text-xs font-medium">
                            {logUser?.full_name || 'Sistema'}
                          </td>
                          <td className="p-3 font-medium text-foreground text-xs">{log.action}</td>
                          <td className="p-3 text-muted-foreground text-xs max-w-[300px] truncate">
                            {log.details ? (typeof log.details === 'string' ? log.details : JSON.stringify(log.details)) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                    {paginatedActivityLog.length === 0 && (
                      <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhuma atividade encontrada</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {logTotalPages > 1 && (
                <div className="flex items-center justify-between pt-3">
                  <p className="text-xs text-muted-foreground">
                    Página {logPage} de {logTotalPages}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-8 text-xs" disabled={logPage <= 1} onClick={() => setLogPage(p => p - 1)}>
                      Anterior
                    </Button>
                    {Array.from({ length: Math.min(logTotalPages, 5) }, (_, i) => {
                      let page: number;
                      if (logTotalPages <= 5) {
                        page = i + 1;
                      } else if (logPage <= 3) {
                        page = i + 1;
                      } else if (logPage >= logTotalPages - 2) {
                        page = logTotalPages - 4 + i;
                      } else {
                        page = logPage - 2 + i;
                      }
                      return (
                        <Button
                          key={page}
                          variant={page === logPage ? 'default' : 'outline'}
                          size="sm"
                          className="h-8 w-8 text-xs p-0"
                          onClick={() => setLogPage(page)}
                        >
                          {page}
                        </Button>
                      );
                    })}
                    <Button variant="outline" size="sm" className="h-8 text-xs" disabled={logPage >= logTotalPages} onClick={() => setLogPage(p => p + 1)}>
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          )}

          {/* TRASH TAB */}
          <TabsContent value="trash" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Lixeira</h3>
                <p className="text-sm text-muted-foreground">Itens excluídos recentemente. Permanecem aqui por 24 horas.</p>
              </div>
            </div>
            
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Tipo</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Identificação</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Excluído por</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Data Exclusão</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {deletionLog.map(log => {
                    const deletedByUser = users.find(u => u.user_id === log.deleted_by);
                    let label = "Desconhecido";
                    let type = "Desconhecido";
                    
                    if (log.confirm_details) {
                      type = log.confirm_details.type || "Item";
                      label = log.confirm_details.title || log.original_id;
                    } else if (log.table_name === 'tasks') {
                      type = "Tarefa";
                      label = log.data?.title || log.original_id;
                    } else if (log.table_name === 'task_groups') {
                      type = "Grupo";
                      label = log.data?.title || log.original_id;
                    } else if (log.table_name === 'boards') {
                      type = "Quadro";
                      label = log.data?.title || log.original_id;
                    }

                    return (
                      <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                        <td className="p-3">
                          <Badge variant="outline" className="capitalize">{type}</Badge>
                        </td>
                        <td className="p-3 font-medium text-foreground truncate max-w-[200px]">{label}</td>
                        <td className="p-3 text-muted-foreground">{deletedByUser?.full_name || 'Sistema'}</td>
                        <td className="p-3 text-muted-foreground">
                          {new Date(log.deleted_at).toLocaleString('pt-BR')}
                        </td>
                        <td className="p-3 text-right">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 gap-1 text-primary hover:text-primary hover:bg-primary/5"
                            onClick={() => handleRestoreItem(log)}
                            disabled={restoringId === log.id}
                          >
                            <RefreshCcw className={cn("h-3.5 w-3.5", restoringId === log.id && "animate-spin")} />
                            Restaurar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {deletionLog.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">A lixeira está vazia</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
          {/* BACKUPS TAB */}
          <TabsContent value="backups" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Sistema de Backups</h3>
                <p className="text-sm text-muted-foreground">Snapshots automáticos (9h e 18h Brasília) e manuais.</p>
              </div>
              <Button 
                className="gap-1 bg-primary" 
                onClick={async () => {
                  const { data, error } = await supabase.rpc('create_backup', { _source: 'manual' });
                  if (error) toast.error(error.message);
                  else {
                    toast.success('Backup manual criado com sucesso!');
                    fetchAll();
                  }
                }}
              >
                <RefreshCcw className="h-4 w-4" /> Fazer backup agora
              </Button>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Data/Hora (Brasília)</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Origem</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Resumo</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {/* We need a state for backups or fetch them here. 
                      Since fetchAll fetches deletionLog, I should update fetchAll to fetch backups too.
                  */}
                  {(window as any).backups?.map((b: any) => (
                    <tr key={b.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-medium text-foreground">
                        {format(parseISO(b.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </td>
                      <td className="p-3 capitalize">{b.trigger_source}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {Object.entries(b.counts || {}).map(([t, c]) => `${t}: ${c}`).join(' | ')}
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-xs"
                          onClick={() => {
                            const blob = new Blob([JSON.stringify(b.payload, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `backup-${b.created_at}.json`;
                            a.click();
                          }}
                        >
                          Baixar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-xs"
                          onClick={async () => {
                            if (!confirm('Restaurar apenas o que está faltando? Nada será apagado.')) return;
                            const { data, error } = await supabase.rpc('restore_backup', { _snapshot_id: b.id, _mode: 'missing_only' });
                            if (error) toast.error(error.message);
                            else toast.success('Restauração concluída: ' + JSON.stringify(data));
                          }}
                        >
                          Restaurar Faltante
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          className="h-7 text-xs"
                          onClick={async () => {
                            const confirmText = prompt('Esta operação substituirá TODOS os dados atuais. Digite RESTAURAR para confirmar:');
                            if (confirmText !== 'RESTAURAR') return;
                            const { data, error } = await supabase.rpc('restore_backup', { _snapshot_id: b.id, _mode: 'full_replace' });
                            if (error) toast.error(error.message);
                            else toast.success('Restauração completa concluída!');
                          }}
                        >
                          Restaurar Tudo
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {(!(window as any).backups || (window as any).backups.length === 0) && (
                    <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Carregando backups ou nenhum encontrado...</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* PLACEHOLDERS TAB */}
          <TabsContent value="placeholders" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Membros Provisórios</h3>
                <p className="text-sm text-muted-foreground">Pessoas cadastradas para atribuição de tarefas antes de criarem conta.</p>
              </div>
              <Button className="gap-1 bg-primary" onClick={() => openPlaceholderDialog()}>
                <UserPlus className="h-4 w-4" /> Novo Provisório
              </Button>
            </div>
            
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Nome</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Email Pretendido</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Papel Sugerido</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {placeholders.map(ph => (
                    <tr key={ph.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-medium text-foreground">{ph.full_name}</td>
                      <td className="p-3 text-muted-foreground">{ph.email || '—'}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${roleBadgeColor(ph.intended_role)}`}>
                          {roleLabel(ph.intended_role)}
                        </span>
                      </td>
                      <td className="p-3">
                        {ph.claimed_at ? (
                          <Badge variant="outline" className="text-green-600 border-green-300">Convertido</Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-600 border-orange-300">Provisório</Badge>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {!ph.claimed_at && (
                          <>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={() => openClaimDialog(ph)} title="Converter em usuário real">
                              <UserCheck className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openPlaceholderDialog(ph)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDeletePlaceholder(ph)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {placeholders.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum membro provisório cadastrado</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Cadastrar / Convidar Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Email *</Label>
              <Input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div>
              <Label>Nome completo</Label>
              <Input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Nome do usuário" />
            </div>
            <div>
              <Label>Papel</Label>
              <Select value={inviteRole} onValueChange={v => setInviteRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Dono</SelectItem>
                  {isAdmin && <SelectItem value="admin">Admin</SelectItem>}
                  <SelectItem value="coordinator">Coordenador</SelectItem>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="viewer">Visualizador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              O convite será criado e um email será aberto para envio. O usuário poderá acessar com Google/Apple ou criar uma senha.
            </p>
            <Button onClick={handleSendInvite} className="w-full bg-primary" disabled={inviteSending || !inviteEmail.trim()}>
              <Mail className="h-4 w-4 mr-2" />
              {inviteSending ? 'Enviando...' : 'Enviar Convite'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Role Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Alterar Papel</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Usuário: <strong className="text-foreground">{selectedUser?.full_name}</strong></p>
            <Select value={selectedRole} onValueChange={v => setSelectedRole(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Dono</SelectItem>
                {isAdmin && <SelectItem value="admin">Admin</SelectItem>}
                <SelectItem value="coordinator">Coordenador</SelectItem>
                <SelectItem value="user">Usuário</SelectItem>
                <SelectItem value="viewer">Visualizador</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleChangeRole} className="w-full bg-primary">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Function Editor Dialog */}
      <Dialog open={funcDialogOpen} onOpenChange={setFuncDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingFunc ? 'Editar Função' : 'Nova Função'}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nome</Label>
              <Input value={funcName} onChange={e => setFuncName(e.target.value)} placeholder="Ex: Editor de Projetos" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={funcDesc} onChange={e => setFuncDesc(e.target.value)} placeholder="Descrição da função" />
            </div>
            <div>
              <Label className="mb-2 block">Permissões por Módulo</Label>
              <div className="space-y-2">
                {SYSTEM_MODULES.map(mod => (
                  <div key={mod} className="flex items-center gap-4 p-2 rounded bg-muted/50">
                    <span className="text-sm font-medium capitalize flex-1">{mod}</span>
                    <label className="flex items-center gap-1.5 text-xs">
                      <Checkbox
                        checked={funcPerms[mod]?.can_edit || false}
                        onCheckedChange={c => setFuncPerms(prev => ({ ...prev, [mod]: { ...prev[mod], can_edit: !!c, can_delete: prev[mod]?.can_delete || false } }))}
                      />
                      Editar
                    </label>
                    <label className="flex items-center gap-1.5 text-xs">
                      <Checkbox
                        checked={funcPerms[mod]?.can_delete || false}
                        onCheckedChange={c => setFuncPerms(prev => ({ ...prev, [mod]: { ...prev[mod], can_delete: !!c, can_edit: prev[mod]?.can_edit || false } }))}
                      />
                      Apagar
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <Button onClick={handleSaveFunction} className="w-full bg-primary" disabled={!funcName.trim()}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Function Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Atribuir Função</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Select value={assignFuncId} onValueChange={setAssignFuncId}>
              <SelectTrigger><SelectValue placeholder="Selecione uma função" /></SelectTrigger>
              <SelectContent>
                {customFunctions.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAssignFunction} className="w-full bg-primary" disabled={!assignFuncId}>Atribuir</Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Placeholder Dialog */}
      <Dialog open={placeholderDialogOpen} onOpenChange={setPlaceholderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPlaceholder ? 'Editar Membro Provisório' : 'Novo Membro Provisório'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nome Completo *</Label>
              <Input value={phName} onChange={e => setPhName(e.target.value)} placeholder="Ex: João Silva" />
            </div>
            <div>
              <Label>Email (Opcional)</Label>
              <Input type="email" value={phEmail} onChange={e => setPhEmail(e.target.value)} placeholder="email@exemplo.com" />
              <p className="text-[10px] text-muted-foreground mt-1">
                Usado apenas para referência. Não cria conta.
              </p>
            </div>
            <div>
              <Label>Papel Pretendido</Label>
              <Select value={phRole} onValueChange={v => setPhRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Dono</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="coordinator">Coordenador</SelectItem>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="viewer">Visualizador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSavePlaceholder} className="w-full bg-primary" disabled={phSaving || !phName.trim()}>
              {phSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Claim Dialog */}
      <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Converter em Usuário Real</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="p-3 bg-muted/50 rounded-lg border border-border space-y-2">
              <p className="text-sm font-medium">Membro Provisório: <span className="text-primary">{selectedPlaceholder?.full_name}</span></p>
              {claimSummary && (
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {claimSummary.tasks} tarefas</span>
                  <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Subtarefas e automações</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Selecione o Usuário Real</Label>
              <Select value={targetUserId} onValueChange={setTargetUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um usuário registrado..." />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter(u => u.status === 'active') // Only registered users
                    .map(u => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.full_name} ({u.email || 'sem email'})
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Ao converter, TODAS as tarefas atribuídas ao membro provisório serão transferidas para este usuário. O membro provisório será removido.
              </p>
            </div>

            <Button 
              onClick={handleClaimPlaceholder} 
              className="w-full bg-primary" 
              disabled={claiming || !targetUserId}
            >
              {claiming ? 'Convertendo...' : 'Confirmar Conversão'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
