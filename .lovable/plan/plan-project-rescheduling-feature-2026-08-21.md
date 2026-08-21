# Plan: Project Rescheduling Feature

Implementation of a deterministic, arithmetic project rescheduling system as specified.

## User Review Required

> [!IMPORTANT]
> - O sistema NÃO deve pular fins de semana nem feriados: o cálculo é em DIAS CORRIDOS. Uma tarefa que cai em sábado ou domingo permanece lá (ex: "Instalação (Final de semana)").
> - O recálculo é aritmético, determinístico e não utiliza lógica de dias úteis ou IA.
> - A "Undo" button will be available based on the last snapshot taken.

## Proposed Changes

### Database & Backend
- **Migration**:
    - Add `project_start` (DATE) and `project_end` (DATE) to `public.boards`.
    - Create `public.schedule_snapshots` table with RLS and policies.
- **Library**: Create `src/lib/reschedule.ts` with pure functions for:
    - Calculation of the proportional shift factor.
    - Application of the formula to task dates.
    - Detection of *new* assignee conflicts (overlaps).

### Frontend Implementation
- **UI Component**: Create `src/components/board/RescheduleDialog.tsx` to handle the input, preview table, and display the date/time of the last reschedule (if exists) next to the Undo button.
- **Board Integration**: Add the "Reagendar projeto" button to `src/pages/BoardPage.tsx` (protected by permissions).
- **Persistence Logic**: Implement batched Supabase updates, update `project_start` and `project_end` in the `boards` table, and perform a `SET_STATE` dispatch in the dialog.
- **Undo Feature**: Fetch the latest snapshot and restore task dates if requested.

### Quality Assurance
- **Unit Tests**: Add `src/lib/reschedule.test.ts` to verify the arithmetic logic and conflict detection.

## Technical Details

```text
Formula:
fator = (novoFim - novoInicio) / (fimOriginal - inicioOriginal)
novoInicio_tarefa = novoInicio_projeto + (inicioOriginal_tarefa - inicioOriginal_projeto) * fator
```

- Batches of 500 tasks for Supabase updates, including updating `boards(project_start, project_end)`.
- RLS enabled for the new snapshot table.
- Verification of `error` on every database call before proceeding.
