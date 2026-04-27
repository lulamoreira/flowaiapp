## Objetivo

Simplificar o diálogo "Convidar pessoas" removendo a aba **Existente** — não faz sentido convidar quem já está no sistema. Ficam apenas **Email** e **Link**.

## Mudanças

**`src/components/invite/InviteDialog.tsx`**
- Remover a aba "Existente" (TabsTrigger + TabsContent).
- Mudar `TabsList` de `grid-cols-3` para `grid-cols-2`.
- Mudar `defaultValue` das Tabs de `"existing"` para `"email"`.
- Remover estados não usados: `searchUser`, `addedUsers`, `filteredUsers`, função `addExistingUser`.
- Remover importações não usadas: `useAppStore`, `UserPlus`.

## Resultado

```text
┌─────────────────────────────────┐
│ Convidar pessoas             ×  │
├─────────────────────────────────┤
│  [📧 Email]      [🔗 Link]      │
│  ...                            │
└─────────────────────────────────┘
```
