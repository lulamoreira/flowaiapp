# Plan - Project Rescheduling & Timeline Views

Implement the requested Weekly/Monthly view toggle for both the Team Timeline Widget and the Board Gantt, ensuring persistence, correct arithmetic scaling in Gantt dragging, and responsive behavior.

## User Review Required

> [!IMPORTANT]
> - The "Monthly" view will automatically scale day widths to fit the entire month in the visible area if possible, but will allow horizontal scrolling if the screen is too narrow (especially on mobile).
> - Dragging tasks in Gantt "Monthly" view will use the reduced day width for its calculation to ensure accuracy.

- No changes to Stripe, rescheduling logic, or task persistence are included in this batch.

## Proposed Changes

### 🎨 UI Architect
- Add `ToggleGroup` and `ToggleGroupItem` from `@/components/ui/toggle-group` to both components.
- Implement responsive layout adjustments for the "Monthly" view cells (e.g., hiding day names and showing only day numbers).
- Ensure horizontal scrolling is restricted to the components themselves, not the whole page.

### 🗄️ Supabase Engineer
- *No backend changes needed.*

### 🔍 Code Auditor
- Persist view preferences in `localStorage` using keys `flowai-timeline-mode` and `flowai-gantt-mode`.
- Ensure all date calculations handle leap years and varying month lengths correctly using `date-fns`.

### 🧪 Testing Agent
- Verify task bar alignment in both Weekly and Monthly views across different months.
- **Manual Verification:** Test dragging a Gantt task in Monthly view and confirm the saved dates match the visual drop point.

## Technical Details

### TeamTimelineWidget.tsx
- Add `viewMode` state ('week' | 'month').
- When `viewMode === 'month'`:
    - `timelineStart` = start of the current month (or offset month).
    - `VISIBLE_DAYS` = number of days in that specific month.
    - `DAY_WIDTH` = dynamically calculated to fit `(containerWidth - NAME_COL) / VISIBLE_DAYS` (with a minimum for readability).
    - Label shows "Month Year" (e.g., "Setembro 2026").

### BoardGantt.tsx
- Add `viewMode` state ('week' | 'month').
- When `viewMode === 'month'`:
    - `timelineStart` = start of the current month (or offset month).
    - `VISIBLE_DAYS` = number of days in that month.
    - `DAY_WIDTH` = reduced to fit the month.
    - Update `handleMouseMove` to use the current `DAY_WIDTH` for `daysDelta` calculation.

### Persistence
- Use a custom hook or simple `useEffect` to sync `viewMode` with `localStorage`.
