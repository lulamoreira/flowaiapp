

# FlowAI — Monday.com Clone

## Summary
Build a full-featured project management app called FlowAI, visually inspired by Monday.com, with boards, task groups, charts, automations, reports, and invite functionality. All data is client-side (localStorage/state) since no backend is connected.

## Architecture

```text
src/
├── App.tsx                    (routes)
├── index.css                  (Monday-style theme)
├── types/                     (TypeScript interfaces)
│   └── index.ts               (Board, Group, Task, User, Automation, etc.)
├── data/
│   └── mockData.ts            (sample boards, tasks, users)
├── store/
│   └── useAppStore.ts         (zustand or React context for global state)
├── pages/
│   ├── Index.tsx              (Home / workspace overview)
│   ├── BoardPage.tsx          (Board detail — table + charts)
│   ├── ReportsPage.tsx        (Reports with productivity charts)
│   └── NotFound.tsx
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx        (Monday-style left nav)
│   │   └── Header.tsx         (Top bar with search, user, invite)
│   ├── board/
│   │   ├── BoardTable.tsx     (Task table with colored groups)
│   │   ├── GroupHeader.tsx     (Collapsible colored group row)
│   │   ├── TaskRow.tsx        (Single task row — status/priority chips)
│   │   ├── StatusBadge.tsx    (Colored status pills)
│   │   ├── PriorityBadge.tsx  (Priority indicators)
│   │   ├── SearchFilterBar.tsx(Search + dropdown filters)
│   │   └── BoardCharts.tsx    (Recharts: bar + pie)
│   ├── task/
│   │   └── TaskDetailModal.tsx(Dialog with description, subtasks, attachments)
│   ├── invite/
│   │   └── InviteDialog.tsx   (Two tabs: add existing user / email invite via mailto:)
│   ├── automation/
│   │   └── AutomationPanel.tsx(Rule builder: trigger + action)
│   └── reports/
│       └── ReportCharts.tsx   (Tasks completed per user/period)
```

## Visual Design (Monday-style)

- **Theme**: Update CSS variables — white background, indigo/purple primary (`--primary: 246 80% 60%`), soft gray sidebar
- **Sidebar**: Dark navy sidebar with workspace icon, board list, colored dots per board
- **Table**: Monday-style grouped rows with colored left borders, status/priority pills with vivid colors (green/orange/red/blue), inline editing feel
- **Typography**: Clean sans-serif, compact rows

## Features

### 1. Workspace & Boards (Home page)
- Grid of board cards with last-updated info
- Click to enter board detail

### 2. Board Detail Page
- **Search bar** at top — filters tasks by name in real-time
- **Filter dropdowns**: status, priority, assignee, due date range
- **Grouped table** with collapsible groups, colored headers
- **Charts section** (toggle): Recharts bar chart (completion by group) + pie chart (priority distribution)

### 3. Task Detail Modal
- Opens on task row click using Radix Dialog
- Fields: title, description (textarea), status, priority, assignee, due date
- Subtasks list with add/check/remove
- Attachments section (file name list — simulated, no real upload)

### 4. Invite System
- Button in header opens dialog with two tabs:
  - **Add existing**: searchable dropdown of mock users
  - **Email invite**: input email + button that opens `mailto:?subject=Convite para entrada no sistema&body=...`

### 5. Automation Panel
- Accessible from board page
- List of rules with trigger/action pattern
- Add rule form: select trigger ("When status changes to X") + action ("Move to group Y" / "Change priority to Z")
- Rules stored in state, displayed as cards

### 6. Reports Page
- Bar chart: tasks completed per user
- Line/area chart: tasks completed over time (weekly)
- Filters: date range, board selector

## Technical Details

- **State**: React Context with useReducer (no extra dependency needed — zustand not installed)
- **Charts**: Recharts (already in package.json)
- **Icons**: Lucide React (already installed)
- **Routing**: React Router with routes: `/`, `/board/:id`, `/reports`
- **Data persistence**: localStorage for demo persistence across refreshes
- **No backend needed** — all mock data

## New Dependencies
- None required (Recharts, Lucide, date-fns, Radix components all already installed)

## Implementation Order
1. Types and mock data
2. Global state context with localStorage persistence
3. Layout (sidebar + header)
4. Home page with board cards
5. Board detail page with grouped table
6. Search and filter bar
7. Task detail modal
8. Board charts (bar + pie)
9. Invite dialog
10. Automation panel
11. Reports page
12. Final styling polish to match Monday.com aesthetic

