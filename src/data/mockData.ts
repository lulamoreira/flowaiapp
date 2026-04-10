import { Board, TaskGroup, Task, User, AutomationRule } from '@/types';

export const mockUsers: User[] = [];

export const mockBoards: Board[] = [
  { id: 'b1', title: 'Projeto Website', description: 'Redesign do site corporativo', color: '#0073ea', updatedAt: '2026-04-07' },
  { id: 'b2', title: 'App Mobile', description: 'Desenvolvimento do aplicativo iOS/Android', color: '#00c875', updatedAt: '2026-04-06' },
  { id: 'b3', title: 'Campanha Marketing', description: 'Lançamento Q2 2026', color: '#fdab3d', updatedAt: '2026-04-05' },
];

export const mockGroups: TaskGroup[] = [
  { id: 'g1', title: 'A Fazer', color: '#0073ea', boardId: 'b1' },
  { id: 'g2', title: 'Em Progresso', color: '#fdab3d', boardId: 'b1' },
  { id: 'g3', title: 'Finalizados', color: '#00c875', boardId: 'b1' },
  { id: 'g4', title: 'Backlog', color: '#a25ddc', boardId: 'b2' },
  { id: 'g5', title: 'Sprint Atual', color: '#0073ea', boardId: 'b2' },
  { id: 'g6', title: 'Concluídos', color: '#00c875', boardId: 'b2' },
  { id: 'g7', title: 'Planejamento', color: '#0073ea', boardId: 'b3' },
  { id: 'g8', title: 'Execução', color: '#fdab3d', boardId: 'b3' },
];

export const mockTasks: Task[] = [
  { id: 't1', title: 'Definir wireframes', description: 'Criar wireframes para todas as páginas principais', status: 'done', priority: 'high', assignee: 'u1', dueDate: '2026-04-10', groupId: 'g3', boardId: 'b1', subtasks: [{ id: 's1', title: 'Home', completed: true }, { id: 's2', title: 'Sobre', completed: true }], attachments: [{ id: 'a1', name: 'wireframe-v1.fig', size: '2.4 MB', addedAt: '2026-04-01' }], createdAt: '2026-03-20', completedAt: '2026-04-05' },
  { id: 't2', title: 'Desenvolver landing page', description: 'Implementar a nova landing page com animações', status: 'working', priority: 'high', assignee: 'u2', dueDate: '2026-04-15', groupId: 'g2', boardId: 'b1', subtasks: [{ id: 's3', title: 'Hero section', completed: true }, { id: 's4', title: 'Features', completed: false }], attachments: [], createdAt: '2026-03-25' },
  { id: 't3', title: 'Revisar conteúdo SEO', description: 'Otimizar textos para mecanismos de busca', status: 'not_started', priority: 'medium', assignee: 'u3', dueDate: '2026-04-20', groupId: 'g1', boardId: 'b1', subtasks: [], attachments: [], createdAt: '2026-03-28' },
  { id: 't4', title: 'Configurar analytics', description: 'Integrar Google Analytics e eventos', status: 'stuck', priority: 'medium', assignee: 'u1', dueDate: '2026-04-12', groupId: 'g2', boardId: 'b1', subtasks: [], attachments: [], createdAt: '2026-03-30' },
  { id: 't5', title: 'Testes de responsividade', description: 'Testar em todos os dispositivos', status: 'not_started', priority: 'low', assignee: 'u4', dueDate: '2026-04-25', groupId: 'g1', boardId: 'b1', subtasks: [], attachments: [], createdAt: '2026-04-01' },
  { id: 't6', title: 'Deploy em produção', description: 'Publicar versão final', status: 'waiting', priority: 'critical', assignee: 'u2', dueDate: '2026-04-30', groupId: 'g1', boardId: 'b1', subtasks: [], attachments: [], createdAt: '2026-04-02' },
  { id: 't7', title: 'Setup projeto React Native', description: 'Inicializar projeto e dependências', status: 'done', priority: 'high', assignee: 'u2', dueDate: '2026-04-05', groupId: 'g6', boardId: 'b2', subtasks: [], attachments: [], createdAt: '2026-03-15', completedAt: '2026-04-03' },
  { id: 't8', title: 'Tela de login', description: 'Implementar autenticação', status: 'working', priority: 'high', assignee: 'u4', dueDate: '2026-04-18', groupId: 'g5', boardId: 'b2', subtasks: [{ id: 's5', title: 'UI', completed: true }, { id: 's6', title: 'API', completed: false }], attachments: [], createdAt: '2026-03-20' },
  { id: 't9', title: 'Push notifications', description: 'Configurar notificações push', status: 'not_started', priority: 'medium', assignee: 'u5', dueDate: '2026-04-28', groupId: 'g4', boardId: 'b2', subtasks: [], attachments: [], createdAt: '2026-03-25' },
  { id: 't10', title: 'Definir público-alvo', description: 'Pesquisa de mercado e personas', status: 'done', priority: 'high', assignee: 'u3', dueDate: '2026-04-08', groupId: 'g7', boardId: 'b3', subtasks: [], attachments: [], createdAt: '2026-03-10', completedAt: '2026-04-06' },
  { id: 't11', title: 'Criar conteúdo redes sociais', description: 'Posts para Instagram, LinkedIn e Twitter', status: 'working', priority: 'medium', assignee: 'u5', dueDate: '2026-04-22', groupId: 'g8', boardId: 'b3', subtasks: [], attachments: [], createdAt: '2026-03-20' },
  { id: 't12', title: 'Email marketing', description: 'Sequência de emails para lançamento', status: 'not_started', priority: 'low', assignee: 'u1', dueDate: '2026-04-25', groupId: 'g7', boardId: 'b3', subtasks: [], attachments: [], createdAt: '2026-03-28' },
];

export const mockAutomations: AutomationRule[] = [
  { id: 'auto1', boardId: 'b1', triggerType: 'status_change', triggerValue: 'done', actionType: 'move_group', actionValue: 'g3', enabled: true, label: 'Quando status mudar para Concluído, mover para Finalizados' },
];
