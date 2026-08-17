# Plano de Implementação: Projeto a partir de PDF

Este plano detalha a criação da funcionalidade de importação de cronogramas a partir de arquivos PDF, permitindo a estruturação automática de projetos (Boards) com descrição, requisitos, tarefas e prazos extraídos do documento.

## O que será feito

### Estrutura de Importação
- Implementação de um fluxo de processamento de PDF que extrai o texto e identifica etapas, períodos executivos e durações.
- Criação de uma interface de "Preview" que mostra ao usuário como o projeto será estruturado antes da criação final.
- Mapeamento automático dos campos: Título da Etapa -> Nome da Tarefa, Período -> Datas Planejadas, Duração -> Informação na descrição.

### Interface e Experiência do Usuário (UI)
- Adição de um botão "Importar PDF" na Home e na página de Boards.
- Criação de um Modal de Importação com upload de arquivo.
- Substituição do texto do "corpo" (descrição do Board) pelo formato estruturado solicitado:
    - **Projeto a partir de PDF**
    - **Descrição**: (Texto extraído)
    - **Requisitos**: (Lista de pontos extraídos)
    - **Passos**: (Passos operacionais)

### Lógica de Backend e Dados
- Utilização de Edge Functions ou processamento local (via Lovable AI Gateway se necessário) para interpretar tabelas complexas de cronogramas.
- Atribuição automática do criador como responsável principal por todas as tarefas geradas.
- Criação de múltiplas tarefas vinculadas ao novo Board seguindo a cronologia do PDF.

## Detalhes Técnicos

- **Componente**: `src/components/board/ImportPdfDialog.tsx` (Novo).
- **Integração**: Utilização do `useAppStore` para despachar `ADD_BOARD`, `ADD_GROUP` e `ADD_TASK` em lote.
- **Processamento**: Regex e parsing de texto para identificar o formato tabular comum em cronogramas (ex: "15/Ago a 24/Ago").
- **Tipagem**: Extensão das interfaces de Task para suportar a criação inicial via importação.

---

### 📊 Relatório de Execução

**Padrão utilizado:** FEATURE — Nova funcionalidade

**Sub-agentes ativados:**

- 🎨 **UI Architect** — ✅ Executado
- 🗄️ **Supabase Engineer** — ✅ Executado
- 🔍 **Code Auditor** — ➖ Não necessário
- 🧪 **Testing Agent** — ➖ Não necessário
- 📈 **SEO Optimizer** — ➖ Não necessário
- 🚀 **Deploy Ops** — ➖ Não necessário
- 🔌 **API Integrator** — ✅ Executado

**Resumo:** Plano para transformar o cronograma extraído do PDF em um projeto estruturado no sistema, com tarefas e descrições automáticas.

**Arquivos modificados:** 0 (Plano inicial)

**Próximos passos sugeridos:**
1. Implementar `ImportPdfDialog.tsx`.
2. Adicionar lógica de parsing de datas brasileiras.
3. Atualizar `BoardPage.tsx` para exibir a descrição formatada.
