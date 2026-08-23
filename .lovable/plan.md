# Plano de Reformulação: Autenticação Restrita e Segurança de Dados

Este plano implementa um sistema de convites obrigatório, remove fluxos de cadastro abertos e corrige vulnerabilidades de RLS para garantir que usuários sem convite não tenham acesso a nenhum dado.

## 1. Fase de Segurança: Endurecimento de RLS (Hardening)

Detectamos que as tabelas `boards` e `tasks` possuem políticas `USING (true)` para usuários autenticados. Isso será corrigido imediatamente.

**Novas Políticas de Acesso:**
- **Tabela `boards`**:
    - `SELECT`: Apenas se for `admin/owner/coordinator` OU se estiver na tabela `project_members` do quadro.
    - `INSERT`: Apenas `admin/owner/coordinator`.
    - `UPDATE/DELETE`: Apenas `admin/owner/coordinator` OU o criador do quadro.
- **Tabela `tasks` (e tabelas dependentes como `task_groups`, `task_comments`, `task_custom_values`, `custom_fields`, `automation_rules`)**:
    - O acesso será condicionado à existência de acesso ao `board_id` relacionado, seguindo a lógica da tabela `boards`.
- **Tabela `profiles`**:
    - `SELECT`: Usuários podem ver seu próprio perfil. Outros perfis só podem ser vistos se compartilharem um projeto em comum ou se o visualizador for `admin/owner/coordinator`.
- **Tabela `user_roles`**:
    - `SELECT`: Apenas `admin/owner/coordinator` podem ver todos. Usuários comuns veem apenas seus próprios papéis.

## 2. Fase de Banco de Dados (Migration)

- **Tabela `invitations`**:
    - Adicionar `role app_role DEFAULT 'viewer'`.
    - Tornar `email` opcional (`NULLABLE`).
    - **Legado**: `UPDATE invitations SET role = 'viewer' WHERE status = 'pending'`. Relataremos a contagem de afetados.
    - Remover política `Anyone can read invitation by token`.
- **Funções e Gatilhos**:
    - **`validate_invitation(token UUID)`**: RPC `SECURITY DEFINER` que retorna apenas o essencial para a tela de registro (nome, email, validade).
    - **`claim_invitation(token UUID)`**: RPC `SECURITY DEFINER` que valida o convite, aplica o papel gravado em `user_roles`, vincula o e-mail (se necessário) e marca como aceito.
    - **`handle_new_user`**: Ajustar para processar `invitation_token` enviado via `raw_user_meta_data` durante o `signUp` por e-mail/senha.
- **Ajuste `profiles`**:
    - Garantir que o gatilho sempre copie o e-mail de `auth.users`.

## 3. Fase de Front-end

- **`LoginPage.tsx`**:
    - Remoção física do botão e modal de "Criar conta de teste".
    - Remoção completa do código de Magic Link e Apple login.
- **`RegisterPage.tsx`**:
    - Substituir leitura direta de `invitations` pela RPC `validate_invitation`.
    - **E-mail/Senha**: Enviar `invitation_token` em `options.data.invitation_token` no `signUp`.
    - **Google OAuth**: 
        - Persistir token no `localStorage` ('flowai-invite-token') antes do redirect.
        - Ao retornar (no `useEffect`), se autenticado e com token no storage, chamar `claim_invitation` e limpar o storage.
- **`AdminPage.tsx` e `InviteDialog.tsx`**:
    - Adicionar seletor de papel na criação do convite.
    - Substituir `mailto` por exibição do link com botão de "Copiar".
    - Mostrar lista de convites com Papel, Expiração e botão de Revogação.
- **`ProfilePage.tsx`**:
    - Exibir E-mail (read-only) e Papel atual.

## 4. Verificação e Teste Final

1. **Teste de Acesso Sem Convite**: Criar conta via console ou ferramenta externa e verificar que o usuário não tem papéis e não vê nada (boards vazios, erro de permissão em tarefas).
2. **Teste de Convite Coordinator**:
    - Admin cria convite para 'coordinator'.
    - Link aberto em aba anônima.
    - Cadastro realizado.
    - Confirmar que o usuário entra com papel de 'coordinator' e acesso administrativo.

---
*Este plano incorpora todas as correções obrigatórias e resolve as brechas de segurança identificadas.*
