# Fix Task Detail Modal Issues

This plan addresses three critical issues in the `TaskDetailModal` component: broken date displays, disappearing dates after editing, and UI lag when typing.

## User-facing changes

- **Reliable Date Display**: Task dates (planned/actual start and end) will correctly show their values, regardless of how they were saved (e.g., from PDF import, rescheduling, or manual entry).
- **Persistent Edits**: Dates will no longer disappear from the fields immediately after being typed.
- **Smooth Typing**: Typing in the title and description fields will be lag-free, as changes will be saved to the database only after you finish typing.

## Technical details

### 1. Date Formatting Utility
Implement two helper functions to handle conversion between database `timestamptz` (or partial date strings) and the HTML `datetime-local` input format (`YYYY-MM-DDTHH:mm`).
- `toInputFormat(dateStr: string | null)`: Uses `date-fns` to parse various formats (ISO with offset, without offset, or just YYYY-MM-DD) and returns the required input format.
- `fromInputFormat(inputStr: string)`: Converts input values to ISO strings for storage.

### 2. Local State with Debounce
To fix the typing lag and "re-appearing/disappearing" date issues caused by realtime echoes:
- Introduce local state hooks for `title`, `description`, and the four date fields.
- Use a `useEffect` to sync local state with the task from the store when the task ID changes.
- Implement a debounce mechanism (approx. 800ms) and a `onBlur` handler to trigger the `dispatch({ type: 'UPDATE_TASK', ... })` only when necessary.

### 3. Implementation Plan
- **Modify `TaskDetailModal.tsx`**:
    - Add `useEffect` to initialize/sync local state.
    - Add local state variables for all 6 fields.
    - Update the JSX to use local state values and `onChange`/`onBlur` handlers.
    - Replace direct `update()` calls with a debounced update function.
- **Verification**:
    - Test with tasks from PDF imports.
    - Verify persistence after edit and page reload.
    - Verify typing performance.
