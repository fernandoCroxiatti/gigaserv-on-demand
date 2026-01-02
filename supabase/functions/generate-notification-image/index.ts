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

REGRAS ABSOLUTAS:
1. A imagem DEVE representar o CONCEITO/TEMA da notificação, NUNCA cenas genéricas
2. PROIBIDO: fotos realistas, pessoas, rostos, bancos de imagem, cenas do mundo real
3. APENAS ilustrações flat/vetoriais com ícones e símbolos conceituais

MAPEAMENTO SEMÂNTICO OBRIGATÓRIO:
- Cadastro/recebimentos/dados → documento, checklist, formulário, engrenagem de configuração
- Corridas/serviços → mapa estilizado, rota pontilhada, veículo simplificado, pin de localização  
- Segurança/sistema → escudo, cadeado, chave, verificação/checkmark
- Avisos operacionais → sino de alerta, relógio, ícone de atenção
- Pagamentos/financeiro → moeda, carteira, cifrão estilizado
- Promoções/novidades → estrela, presente, megafone
- Manutenção/atualização → engrenagem, ferramenta, seta de atualização

ESTILO VISUAL:
- Flat design, minimalista, profissional
- Ícone grande e centralizado
- Fundo claro/neutro (branco, cinza claro, bege)
- Máximo 3-4 cores harmônicas
- Formato quadrado

Retorne APENAS o prompt em inglês, sem explicações.`
          },
          {
            role: 'user',
            content: `Analise o TEMA principal desta notificação e crie um prompt para uma ilustração conceitual que represente diretamente esse tema:

Título: "${titulo}"
${texto ? `Texto: "${texto}"` : ''}

Identifique o conceito central (ex: cadastro, segurança, corrida, pagamento, aviso) e use o ícone/símbolo apropriado.`
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
            content: `Crie uma ilustração conceitual em estilo flat e profissional para uma notificação interna do app Giga S.O.S, baseada diretamente no TEMA da notificação.

${imagePrompt}

REGRAS OBRIGATÓRIAS:
- Não use fotos reais, pessoas, rostos ou cenas do mundo real
- Não use imagens genéricas de trabalho ou escritório
- Use apenas ícones e símbolos conceituais que representem a ideia principal
- Fundo claro ou neutro, cores harmônicas alinhadas à identidade do app
- Formato quadrado, ícone grande centralizado
- A imagem deve complementar o texto, nunca ilustrar pessoas ou ações reais`
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
