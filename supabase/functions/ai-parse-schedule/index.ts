export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text } = await req.json()

    if (!text) {
      return new Response(JSON.stringify({ error: 'O texto extraído do PDF é obrigatório.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY não está configurada no backend.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const prompt = `Você é um especialista em análise de documentos e cronogramas.
Sua tarefa é extrair as informações de um cronograma em PDF (cujo texto bruto foi extraído e será fornecido abaixo) e retornar um JSON estruturado.

O cronograma está em português do Brasil.
As datas podem vir em diversos formatos, como:
- "15/Ago"
- "15/08"
- "15 de agosto"
- Intervalos: "15/Ago a 24/Ago" ou "15/08 - 24/08"

Regras estritas:
1. Devolva um objeto JSON com as chaves: "title" (string) e "tasks" (array de objetos).
2. Cada objeto em "tasks" deve ter:
   - "title" (string): o nome da tarefa.
   - "startDate" (string ou null): formato "YYYY-MM-DD". Se o ano não for encontrado no texto, use "YYYY" como placeholder (ex: "YYYY-08-15").
   - "endDate" (string ou null): formato "YYYY-MM-DD". Se o ano não for encontrado, use "YYYY" como placeholder.
   - "duration" (string ou null): descrição da duração encontrada (ex: "10 dias").
3. Se o ano não estiver explícito no documento, deixe o ano como "YYYY". Não tente adivinhar.
4. Ignore cabeçalhos, rodapés e numeração de página.
5. Preserve a ordem das tarefas conforme aparecem no documento.
6. Não adicione nenhum comentário ou texto fora do JSON.

Texto extraído do PDF:
---
${text}
---`

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Lovable-API-Key': apiKey,
        'X-Lovable-AIG-SDK': 'fetch',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const raw = await response.text()
      let message = raw
      try {
        message = JSON.parse(raw)?.error?.message ?? JSON.parse(raw)?.message ?? raw
      } catch (_) { /* mantém texto bruto */ }

      if (response.status === 429) {
        message = 'Limite de requisições da IA atingido. Tente novamente em alguns instantes.'
      } else if (response.status === 402) {
        message = message || 'Créditos de IA esgotados. Adicione créditos para continuar.'
      }

      return new Response(JSON.stringify({ error: message, status: response.status }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const result = await response.json()
    const content = result.choices?.[0]?.message?.content || ''

    let cleanedContent = content.trim()
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json/, '').replace(/```$/, '').trim()
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```/, '').replace(/```$/, '').trim()
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(cleanedContent)
    } catch (_) {
      return new Response(
        JSON.stringify({ error: 'A IA não retornou um JSON válido. Tente novamente ou revise o PDF.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message || 'Erro inesperado.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
