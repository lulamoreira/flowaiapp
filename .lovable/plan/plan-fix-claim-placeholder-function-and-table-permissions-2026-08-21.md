# Plan: Fix claim_placeholder function and table permissions

We need to restore the `claim_placeholder` function to its correct logic (based on the stable version from migration 152034) and fix security regressions in table permissions introduced in migration 153455.

## Database Changes

1.  **Revoke Excessive Permissions**:
    *   Revoke `ALL` from `authenticated` role on `public.user_roles` and `public.placeholder_members`.
    *   Restore minimal permissions: `SELECT` on `user_roles`; `SELECT`, `INSERT`, `UPDATE`, `DELETE` on `placeholder_members`.

2.  **Fix `claim_placeholder` Function**:
    *   Drop the current broken version.
    *   Recreate it with:
        *   Correct parameter names (`p_placeholder_id`, `p_target_user_id`).
        *   Proper validation of placeholder, real user, and already-claimed status.
        *   Correct notification suppression: `set_config('app.suppress_task_notifications', 'on', true)`.
        *   Correct `claimed_by` assignment: set to the **real user ID**, not the administrator's ID.
        *   Correct subtask migration: iterate through `subtasks` JSONB array to update assignee and count actual subtask migrations.
        *   Fix `automation_rules` update: use the `action_value` column instead of the non-existent `config` column.
        *   Fix `notifications` insert: remove non-existent `type` column.
        *   Return `jsonb` with `tasks_migrated` and `subtasks_migrated`.
    *   Grant `EXECUTE` on the function to `authenticated`.

## Technical Details

*   The function will use `SECURITY DEFINER` to bypass RLS for internal updates while maintaining a check on the caller's role (`admin`, `coordinator`, or `owner`).
*   The `automation_rules` table stores the assignee ID in the `action_value` column for relevant action types.
*   The `notifications` table structure is: `user_id`, `title`, `message`, `link`, `read`, `created_at`.

## Verification Plan

1.  **Automated Check (SQL)**:
    *   Verify column existence before running.
2.  **Manual Verification (UI)**:
    *   Create a placeholder member in the Admin panel.
    *   Assign a task and a subtask (within the task details) to this placeholder.
    *   Use the "Substituir por usuário real" button to convert it to a test user account.
    *   **Success criteria**:
        *   UI reports the correct number of migrated tasks and subtasks.
        *   The test user receives a single notification.
        *   The `placeholder_members` record shows the test user's ID in `claimed_by`.
        *   The test user inherits the `intended_role` if they didn't have it.
