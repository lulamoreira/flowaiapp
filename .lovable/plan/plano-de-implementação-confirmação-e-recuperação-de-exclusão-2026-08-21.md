# Plano de Implementação: Confirmação e Recuperação de Exclusão de Dados

Este plano descreve a implementação de um sistema robusto para evitar a perda acidental de dados, incluindo confirmações detalhadas e uma "Lixeira" com recuperação de 24 horas.

## 1. Fundação do Banco de Dados (Supabase/PostgreSQL)

*   **Tabela `public.deletion_log`**: Criar uma tabela para armazenar dados excluídos temporariamente.
    *   `id` UUID (PK).
    *   `table_name` TEXT (ex: 'tasks', 'boards', 'groups').
    *   `original_id` UUID.
    *   `data` JSONB (o conteúdo completo da linha antes da exclusão).
    *   `deleted_at` TIMESTAMPTZ (DEFAULT now()).
    *   `deleted_by` UUID (FK para auth.users).
*   **RLS**: Apenas administradores e o dono do registro podem ver/restaurar seus itens.
*   **Limpeza Automática**: Criar uma função e trigger (ou instruir o uso de um cron job via Edge Function) para remover registros com mais de 24 horas.

## 2. Componente de UI: `DeleteConfirmDialog`

*   Criar um componente reutilizável baseado em `AlertDialog` do Shadcn.
*   **Props**:
    *   `title`: Título do diálogo.
    *   `description`: Descrição detalhada do que será apagado.
    *   `itemDetails`: Objeto com informações como "Nome", "ID", "Data".
    *   `onConfirm`: Callback para executar a exclusão.
*   **Segurança**: O botão "Excluir" só é habilitado após o usuário ler os detalhes (opcional: exigir digitar uma palavra de confirmação para itens críticos como Boards).

## 3. Lógica de "Exclusão Segura" (Soft-ish Delete)

*   Modificar as ações no `useAppStore.tsx` e Edge Functions.
*   Antes de deletar permanentemente da tabela principal, inserir o registro na `deletion_log`.
*   Para facilitar a restauração rápida sem triggers complexos, o frontend lidará com a chamada de restauração.

## 4. Interface de Lixeira (Trash/History)

*   Criar uma nova aba ou seção no `AdminPage.tsx` chamada "Lixeira".
*   Listar itens deletados nas últimas 24 horas.
*   Botão "Restaurar": Move o JSON de volta para a tabela original e remove da `deletion_log`.

## 5. Detalhes Técnicos

*   **Tabelas impactadas**: `tasks`, `boards`, `task_groups`.
*   **Segurança**: Garantir `GRANT` e `RLS` corretos na nova tabela.
*   **Tratamento de Erros**: Validar integridade referencial ao restaurar (ex: se o board pai ainda existe).

## 6. Verificação

*   Excluir uma tarefa -> Confirmar no diálogo -> Verificar se aparece na Lixeira.
*   Restaurar a tarefa -> Verificar se volta ao Board original com todos os dados (subtarefas, etc).
*   Testar expiração de 24 horas via query SQL.
