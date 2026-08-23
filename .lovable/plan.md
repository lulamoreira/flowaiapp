# Plano de Reformulação da Autenticação e Gestão de Usuários

Este plano visa tornar o sistema de autenticação do FlowAI restrito a convites, seguro contra vazamento de dados e com fluxos de permissão robustos e centralizados no banco de dados.

## 1. Alterações no Banco de Dados (Migrations)

Criaremos uma migration para:
- **Tabela `invitations`**:
    - Adicionar coluna `role` (tipo `app_role`, default 'viewer') para armazenar o papel pretendido.
    - Alterar a coluna `email` para ser opcional (`NULLABLE`), permitindo convites por link genérico onde o usuário informa o e-mail no cadastro.
    - Remover a política `Anyone can read invitation by token` (que hoje permite `USING (true)`).
- **Funções `SECURITY DEFINER`**:
    - `validate_invitation(token UUID)`: Retorna apenas `{is_valid: boolean, invited_name: text, email: text, role: app_role}`. Usada pela tela de registro sem expor outros tokens.
    - `process_invitation_acceptance()`: Chamada via gatilho após o cadastro. Valida o token, cria a entrada em `user_roles` com o papel do convite e marca o convite como aceito.
- **Tabela `profiles`**:
    - Adicionar coluna `email` (caso não exista, ou garantir que seja preenchida).
    - Atualizar o gatilho `handle_new_user` para copiar o e-mail do `auth.users` para `public.profiles`.
    - Script de correção para preencher e-mails em perfis órfãos existentes.

## 2. Mudanças no Front-end

### Autenticação (`src/pages/LoginPage.tsx`)
- Remover botão "Criar conta de teste".
- Remover opções de Magic Link e Apple login.
- Manter apenas E-mail/Senha e Google.

### Cadastro (`src/pages/RegisterPage.tsx`)
- Parar de ler `role` da URL. O papel será aplicado pelo backend via `process_invitation_acceptance`.
- Usar a nova função RPC `validate_invitation` para carregar dados do convite.
- Remover tentativa de escrita manual em `user_roles`.

### Gestão de Convites (`src/pages/AdminPage.tsx` e `InviteDialog.tsx`)
- **InviteDialog**: Adicionar seletor de papel (`role`) ao criar convite.
- Remover o fluxo de `mailto` automático.
- Exibir o link gerado com botão "Copiar Link".
- **AdminPage**: Lista de convites atualizada com coluna "Papel" e status, permitindo revogação (exclusão).

### Perfil (`src/pages/ProfilePage.tsx`)
- Adicionar campo de E-mail (read-only).
- Exibir o papel atual de forma clara.
- Garantir que campos de Nome e Data de Nascimento funcionem corretamente.

## 3. Fluxo do Convite

1. **Admin/Owner**: Acessa "Convidar", escolhe o papel (ex: 'user') e gera um link.
2. **Sistema**: Cria linha em `invitations` com `token` único e `role` escolhido.
3. **Convidado**: Acessa o link `.../register?token=XYZ`.
4. **RegisterPage**: Chama `validate_invitation(XYZ)`. Se válido, mostra o formulário.
5. **Convidado**: Finaliza o cadastro (E-mail/Senha ou Google).
6. **Backend (Trigger)**: Detecta o novo usuário, localiza o convite pelo token (ou e-mail vinculado), insere o papel em `user_roles` e marca o convite como aceito.
7. **Convidado**: Entra no sistema já com o papel correto, sem intervenção manual no front-end.

## 4. Arquivos Afetados
- `supabase/migrations/[data]_security_rehaul.sql` (Nova migration)
- `src/pages/LoginPage.tsx` (Limpeza de métodos de login)
- `src/pages/RegisterPage.tsx` (Nova validação e remoção de lógica de papel via URL)
- `src/pages/AdminPage.tsx` (Gestão de convites e papéis)
- `src/pages/ProfilePage.tsx` (Campos adicionais)
- `src/components/invite/InviteDialog.tsx` (Seleção de papel e link copying)
- `src/hooks/useAuth.tsx` (Pequenos ajustes de tipos, se necessário)

---
*Este plano preserva a resiliência do `fetchProfile`, o fluxo de `/logout`, a proteção do último admin e os membros provisórios.*
