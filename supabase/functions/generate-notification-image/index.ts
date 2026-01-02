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
            content: `Você cria prompts para ilustrações de notificações de um app de guincho (GIGA S.O.S).

REGRAS CRÍTICAS para a ilustração:
- Estilo: flat, simples, profissional, minimalista
- SEM pessoas reais
- SEM rostos
- SEM textos na imagem
- Poucas cores, paleta harmônica
- Fundo claro ou neutro
- Ilustrações conceituais (ex: carro, guincho, localização, alerta, chave, pneu)
- Formato quadrado, ícone grande centralizado

Retorne APENAS o prompt em inglês para gerar a imagem, sem explicações.`
          },
          {
            role: 'user',
            content: `Crie um prompt para ilustrar: "${titulo}". ${texto ? `Contexto: ${texto}` : ''}`
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
      'Flat minimalist icon of a tow truck, simple colors, clean design, light background';

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
            content: `Generate a simple, flat, minimalist illustration: ${imagePrompt}. Square format, centered icon, light neutral background, no text, no faces, no real people. Professional app notification style.`
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
      // Return a placeholder if image generation failed
      imageUrl = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=256&h=256&fit=crop';
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
        // Provide fallback image
        imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=256&h=256&fit=crop'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
