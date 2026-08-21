# Urgent Fixes: SQL Regressions, Task Card Bugs, and Cleanup

The project requires immediate fixes for a critical SQL regression introduced in the last migration, persistent bugs in the task detail card, and cleanup of temporary files.

## Technical Details

### 1. SQL Regression: Trigger and RPC Security
The `notify_task_assigned` function was updated without `SECURITY DEFINER`, causing it to fail when non-admin users update tasks (due to lack of access to `auth.users`).
- **Fix**: Re-create `public.notify_task_assigned` with `SECURITY DEFINER` and `SET search_path = public`.
- **Improvement**: In `claim_placeholder`, suppress triggers during mass task updates by disabling the trigger for the session or adding a check. Since we are in an RPC, we can use `SET LOCAL session_replication_role = 'replica';` to disable triggers locally for the transaction.
- **Cleanup**: Remove dead `automation_rules` update logic in `claim_placeholder` and fix the filter.

### 2. Task Detail Modal: Date and Performance Bugs
- **Date Formatting**: Implement robust date parsing/formatting using `date-fns` that handles all database variations (TZ, no-TZ, date-only) and correctly maps to `datetime-local` input format (`yyyy-MM-dd'T'HH:mm`).
- **Persistence**: Ensure local state doesn't get wiped by realtime updates while the modal is open.
- **Performance**: Debounce `title` and `description` updates to prevent excessive database writes and realtime echoes.

### 3. Repository Cleanup
- Remove `get_functions.py` and `migration.sql`.

## Implementation Plan

### Database Fixes
1. Create a migration to:
    - Re-declare `notify_task_assigned` with `SECURITY DEFINER`.
    - Update `claim_placeholder` to use `SET LOCAL session_replication_role = 'replica';` to suppress mass notifications.
    - Remove the `automation_rules` section in `claim_placeholder` or update it to valid types if applicable.

### Frontend Fixes (`src/components/task/TaskDetailModal.tsx`)
1. Refine `toInputFormat` and implement `fromInputFormat` using `date-fns`.
2. Ensure all 4 date fields use these helpers.
3. Validate that `useEffect` only syncs local state on `task.id` change.
4. Verify `debouncedUpdate` and `onBlur` logic for all text fields.

### Verification
1. Test task assignment as a non-admin user.
2. Verify dates in task detail card (especially imported tasks).
3. Confirm no lag when typing.
