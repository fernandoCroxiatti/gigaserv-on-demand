import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    console.log('Generating notification text for prompt:', prompt);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente especializado em criar notificações para um aplicativo de guincho e assistência automotiva chamado GIGA S.O.S.

REGRAS OBRIGATÓRIAS:
- Linguagem: português do Brasil
- Tom: profissional, claro e amigável
- Nunca usar termos técnicos excessivos
- Nunca prometer funcionalidades inexistentes
- Títulos devem ser curtos (máximo 1 linha, até 60 caracteres)
- Textos devem ser objetivos (2 a 4 linhas, até 200 caracteres)

CONCEITO DE IMAGEM (image_concept):
Você DEVE escolher UM conceito simples para a ilustração baseado no tema.
Conceitos disponíveis (escolha APENAS um):
- "checklist" - para cadastro, verificação, documentos
- "documento" - para termos, contratos, comprovantes
- "engrenagem" - para configurações, sistema, manutenção
- "alerta" - para avisos, alertas, urgências
- "confirmacao" - para sucesso, aprovação, conclusão
- "mapa" - para corridas, rotas, localização
- "pagamento" - para financeiro, recebimentos, PIX
- "seguranca" - para proteção, privacidade, cadeado
- "novidade" - para atualizações, novidades gerais
- "suporte" - para ajuda, atendimento, contato

Você deve retornar APENAS um JSON válido no formato:
{"titulo": "...", "texto": "...", "image_concept": "..."}

Não adicione nenhum texto fora do JSON.`
          },
          {
            role: 'user',
            content: `Crie uma notificação sobre: ${prompt}`
          }
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('AI API error:', error);
      throw new Error('Erro na API de IA');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    console.log('AI response:', content);

    // Parse the JSON response
    let result;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Fallback: use the prompt as basis
      result = {
        titulo: prompt.slice(0, 60),
        texto: `Novidade no GIGA S.O.S! ${prompt.slice(0, 150)}`,
        image_concept: 'novidade',
      };
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error generating notification text:', error);
    const message = error instanceof Error ? error.message : 'Erro ao gerar texto';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
