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
    const { titulo, texto } = await req.json();

    if (!titulo) {
      return new Response(
        JSON.stringify({ error: 'Título é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    console.log('Generating notification image for:', titulo);

    // First, generate a description for the image using text model
    const descriptionResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: `Você cria prompts para ilustrações conceituais de notificações do app GIGA S.O.S (guincho e assistência veicular).

PROCESSO OBRIGATÓRIO EM 3 PASSOS:
1. IDENTIFICAR o tema principal da notificação
2. CONVERTER o tema em UM conceito visual simples
3. FALLBACK: Se o tema for abstrato ou pouco claro, SEMPRE usar um símbolo neutro de sistema

MAPEAMENTO SEMÂNTICO (usar quando tema for identificável):
- Cadastro/recebimentos/dados/conta → documento com checkmark, formulário, perfil de usuário
- Corridas/serviços/atendimento → mapa com pin, rota pontilhada, veículo estilizado
- Segurança/sistema/verificação → escudo com checkmark, cadeado fechado, chave
- Avisos/alertas/atenção → sino, triângulo de alerta, círculo com exclamação
- Pagamentos/financeiro/valores → moeda/cifrão estilizado, carteira, gráfico simples
- Promoções/novidades/ofertas → estrela brilhante, presente com laço, badge de desconto
- Manutenção/atualização/melhorias → engrenagens, seta circular de atualização

FALLBACK OBRIGATÓRIO (usar para temas abstratos/genéricos/pouco claros):
Se não conseguir identificar tema claro, use OBRIGATORIAMENTE um destes:
- Documento com checkmark (símbolo universal de confirmação)
- Engrenagem simples (símbolo de sistema/configuração)
- Sino de notificação (símbolo de aviso)
- Círculo com checkmark (símbolo de sucesso/confirmação)

REGRAS ABSOLUTAS:
- PROIBIDO: fotos realistas, pessoas, rostos, mãos, cenas do mundo real
- PROIBIDO: imagens genéricas de trabalho/escritório
- PROIBIDO: texto dentro da imagem
- OBRIGATÓRIO: flat design, minimalista, ícone grande centralizado
- OBRIGATÓRIO: fundo claro neutro (branco ou cinza muito claro)
- OBRIGATÓRIO: máximo 3 cores harmônicas (azul, verde ou laranja como destaque)

Retorne APENAS o prompt em inglês, sem explicações. O prompt DEVE gerar uma imagem válida.`
          },
          {
            role: 'user',
            content: `Analise esta notificação e crie um prompt para ilustração:

Título: "${titulo}"
${texto ? `Texto: "${texto}"` : ''}

INSTRUÇÕES:
1. Identifique o tema central
2. Se o tema for claro, use o ícone correspondente do mapeamento
3. Se o tema for abstrato ou confuso, use o fallback (documento com checkmark ou engrenagem)
4. O prompt DEVE sempre gerar uma ilustração válida, NUNCA falhar`
          }
        ],
        temperature: 0.7,
        max_tokens: 150,
      }),
    });

    if (!descriptionResponse.ok) {
      throw new Error('Erro ao gerar descrição da imagem');
    }

    const descData = await descriptionResponse.json();
      const imagePrompt = descData.choices?.[0]?.message?.content?.trim() || 
      'Flat minimalist conceptual icon representing notification alert, simple geometric shapes, light neutral background';

    console.log('Image prompt:', imagePrompt);

    // Generate image using the image model
    const imageResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [
          {
            role: 'user',
            content: `Crie uma ilustração conceitual em estilo flat e profissional para uma notificação interna do app Giga S.O.S.

${imagePrompt}

INSTRUÇÕES OBRIGATÓRIAS:
- Baseie a imagem no CONCEITO do tema
- Se o tema for abstrato, use um símbolo neutro de sistema (documento, checklist, engrenagem ou confirmação)
- Não use fotos reais, pessoas, rostos ou texto
- Use fundo claro ou neutro e cores alinhadas à identidade visual do app (azul, verde ou laranja como destaque)
- Ícone grande e centralizado, formato quadrado
- A imagem DEVE sempre ser gerada com sucesso`
          }
        ],
        max_tokens: 1000,
      }),
    });

    if (!imageResponse.ok) {
      const error = await imageResponse.text();
      console.error('Image generation error:', error);
      throw new Error('Erro ao gerar imagem');
    }

    const imageData = await imageResponse.json();
    
    // Extract image URL from response
    let imageUrl = null;
    const content = imageData.choices?.[0]?.message?.content;
    
    if (content) {
      // Check if it's a data URL or regular URL
      if (content.startsWith('data:') || content.startsWith('http')) {
        imageUrl = content;
      } else if (typeof content === 'object' && content.url) {
        imageUrl = content.url;
      }
    }

    // Check for image in other response formats
    if (!imageUrl && imageData.data?.[0]?.url) {
      imageUrl = imageData.data[0].url;
    }

    if (!imageUrl) {
      console.log('Image generation response:', JSON.stringify(imageData).slice(0, 500));
      // Return null - admin should retry or skip image
      console.warn('Could not extract image URL from response');
      imageUrl = null;
    }

    console.log('Generated image URL:', imageUrl?.slice(0, 100));

    return new Response(
      JSON.stringify({ imageUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error generating notification image:', error);
    const message = error instanceof Error ? error.message : 'Erro ao gerar imagem';
    return new Response(
      JSON.stringify({ 
        error: message,
        // No fallback - admin should retry
        imageUrl: null
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
