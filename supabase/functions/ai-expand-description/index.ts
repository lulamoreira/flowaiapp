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
    const { title, description } = await req.json()

    if (!title) {
      return new Response(JSON.stringify({ error: 'O título da tarefa é obrigatório.' }), {
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

    const prompt = `Você é um gerente de projetos experiente. Dada a tarefa abaixo, expanda a descrição com critérios de aceite claros e passos sugeridos para execução. Responda em português brasileiro, de forma concisa e profissional.

Título da tarefa: ${title}
Descrição atual: ${description || '(vazia)'}

Forneça a descrição expandida diretamente, sem prefixos ou explicações.`

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
        max_tokens: 1000,
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
    const expanded = result.choices?.[0]?.message?.content?.trim() || ''

    if (!expanded) {
      return new Response(JSON.stringify({ error: 'A IA não retornou nenhum conteúdo.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ expanded }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message || 'Erro inesperado.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
