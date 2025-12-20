import { Button } from "@/components/ui/button";
import { FileDown, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const StripeAuditReport = () => {
  const navigate = useNavigate();

  const handleDownloadPDF = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-white text-black p-8 print:p-4">
      {/* Header com botões - esconde na impressão */}
      <div className="flex gap-4 mb-8 print:hidden">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <Button onClick={handleDownloadPDF}>
          <FileDown className="w-4 h-4 mr-2" />
          Baixar PDF
        </Button>
      </div>

      {/* Conteúdo do Relatório */}
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="text-center border-b pb-6">
          <h1 className="text-3xl font-bold">AUDITORIA TÉCNICA STRIPE</h1>
          <h2 className="text-xl text-gray-600 mt-2">GIGA S.O.S - Extração de Código</h2>
          <p className="text-sm text-gray-500 mt-2">
            Data: {new Date().toLocaleDateString('pt-BR')} | 
            Projeto: twyzhndqxynbhgmqshuz
          </p>
        </header>

        {/* Seção 1: Backend - Criação de Pagamento PIX */}
        <section>
          <h2 className="text-2xl font-bold border-b pb-2 mb-4">1. BACKEND - FUNÇÕES DE PAGAMENTO</h2>
          
          <h3 className="text-xl font-semibold mt-6 mb-3">1.1 create-pix-checkout (Checkout Session)</h3>
          <p className="text-gray-600 mb-2">Arquivo: supabase/functions/create-pix-checkout/index.ts</p>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto whitespace-pre-wrap">
{`// Criação do Checkout Session para PIX
const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  payment_method_types: ['pix'],
  line_items: [{
    price_data: {
      currency: 'brl',
      product_data: {
        name: \`Serviço GIGA S.O.S - \${tipo_servico}\`,
        description: \`Chamado #\${chamado_id.slice(0, 8)}\`,
      },
      unit_amount: totalAmountCentavos,
    },
    quantity: 1,
  }],
  // STRIPE CONNECT - Destination Charges
  payment_intent_data: {
    application_fee_amount: applicationFeeAmount,
    transfer_data: {
      destination: providerStripeAccountId,
    },
    metadata: {
      chamado_id: chamado_id,
      cliente_id: cliente_id,
      prestador_id: prestador_id,
      tipo_servico: tipo_servico,
      payment_method: 'pix',
    },
  },
  success_url: \`\${origin}/pix-sucesso?chamado_id=\${chamado_id}\`,
  cancel_url: \`\${origin}/pix-cancelado?chamado_id=\${chamado_id}\`,
  expires_at: Math.floor(Date.now() / 1000) + (30 * 60),
}, {
  apiVersion: '2025-08-27.basil',
});`}
          </pre>

          <h3 className="text-xl font-semibold mt-6 mb-3">1.2 create-payment-intent (PaymentIntent Direto)</h3>
          <p className="text-gray-600 mb-2">Arquivo: supabase/functions/create-payment-intent/index.ts</p>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto whitespace-pre-wrap">
{`// PaymentIntent para PIX ou Cartão
const paymentIntent = await stripe.paymentIntents.create({
  amount: totalAmountCentavos,
  currency: "brl",
  payment_method_types: paymentMethod === 'pix' ? ['pix'] : ['card'],
  // Opções específicas para PIX
  ...(paymentMethod === 'pix' && {
    payment_method_options: {
      pix: {
        expires_after_seconds: 900, // 15 minutos
      },
    },
  }),
  // STRIPE CONNECT - Destination Charges
  application_fee_amount: applicationFeeAmount,
  transfer_data: {
    destination: providerData.stripe_account_id,
  },
  metadata: {
    chamado_id,
    cliente_id,
    prestador_id,
    tipo_servico,
    payment_method: paymentMethod,
  },
});`}
          </pre>

          <h3 className="text-xl font-semibold mt-6 mb-3">1.3 pay-with-saved-card (Cartão Salvo)</h3>
          <p className="text-gray-600 mb-2">Arquivo: supabase/functions/pay-with-saved-card/index.ts</p>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto whitespace-pre-wrap">
{`// PaymentIntent com cartão salvo
const paymentIntent = await stripe.paymentIntents.create({
  amount: totalAmountCentavos,
  currency: "brl",
  customer: stripeCustomerId,
  payment_method: payment_method_id,
  off_session: false,
  confirm: true,
  return_url: \`\${origin}/\`,
  // STRIPE CONNECT - Destination Charges
  application_fee_amount: applicationFeeAmount,
  transfer_data: {
    destination: providerData.stripe_account_id,
  },
  metadata: {
    chamado_id,
    cliente_id,
    prestador_id,
    tipo_servico,
    payment_method: 'saved_card',
  },
});`}
          </pre>
        </section>

        {/* Seção 2: Webhooks */}
        <section className="break-before-page">
          <h2 className="text-2xl font-bold border-b pb-2 mb-4">2. WEBHOOKS</h2>
          <p className="text-gray-600 mb-2">Arquivo: supabase/functions/stripe-webhook/index.ts</p>

          <h3 className="text-xl font-semibold mt-6 mb-3">2.1 Verificação de Assinatura</h3>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto whitespace-pre-wrap">
{`// Verificação OBRIGATÓRIA da assinatura do webhook
const signature = req.headers.get("stripe-signature");
if (!signature) {
  return new Response("No signature", { status: 400 });
}

let event: Stripe.Event;
try {
  event = stripe.webhooks.constructEvent(
    body,
    signature,
    Deno.env.get("STRIPE_WEBHOOK_SECRET")!
  );
} catch (err) {
  return new Response(\`Webhook signature verification failed: \${err.message}\`, 
    { status: 400 });
}`}
          </pre>

          <h3 className="text-xl font-semibold mt-6 mb-3">2.2 Eventos Processados</h3>
          <div className="bg-gray-100 p-4 rounded">
            <ul className="list-disc list-inside space-y-2">
              <li><strong>checkout.session.completed</strong> - PIX via Checkout</li>
              <li><strong>payment_intent.succeeded</strong> - Pagamento confirmado</li>
              <li><strong>payment_intent.payment_failed</strong> - Pagamento falhou</li>
              <li><strong>payment_intent.canceled</strong> - Pagamento cancelado</li>
              <li><strong>payment_intent.processing</strong> - Em processamento</li>
              <li><strong>account.updated</strong> - Conta conectada atualizada</li>
              <li><strong>payout.*</strong> - Eventos de saque</li>
              <li><strong>transfer.created</strong> - Transferência criada</li>
            </ul>
          </div>

          <h3 className="text-xl font-semibold mt-6 mb-3">2.3 Processamento payment_intent.succeeded</h3>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto whitespace-pre-wrap">
{`case "payment_intent.succeeded": {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const chamadoId = paymentIntent.metadata?.chamado_id;

  if (chamadoId) {
    const { error: updateError } = await supabaseAdmin
      .from("chamados")
      .update({
        payment_status: "paid_stripe",
        payment_completed_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntent.id,
        status: "in_service",
      })
      .eq("id", chamadoId);
  }
  break;
}`}
          </pre>

          <h3 className="text-xl font-semibold mt-6 mb-3">2.4 Processamento payment_intent.payment_failed</h3>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto whitespace-pre-wrap">
{`case "payment_intent.payment_failed": {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const chamadoId = paymentIntent.metadata?.chamado_id;

  if (chamadoId) {
    await supabaseAdmin
      .from("chamados")
      .update({
        payment_status: "failed",
        stripe_payment_intent_id: paymentIntent.id,
      })
      .eq("id", chamadoId);
  }
  break;
}`}
          </pre>
        </section>

        {/* Seção 3: Frontend */}
        <section className="break-before-page">
          <h2 className="text-2xl font-bold border-b pb-2 mb-4">3. FRONTEND</h2>
          <p className="text-gray-600 mb-2">Arquivo: src/components/Client/ClientAwaitingPaymentView.tsx</p>

          <h3 className="text-xl font-semibold mt-6 mb-3">3.1 Chamada para Criar PIX</h3>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto whitespace-pre-wrap">
{`const handlePixPayment = async () => {
  setPixFlowState('generating');
  
  const { data, error } = await supabase.functions.invoke('create-pix-checkout', {
    body: {
      chamado_id: chamado.id,
      amount: chamado.valor,
      cliente_id: user.id,
      prestador_id: chamado.prestador_id,
      tipo_servico: chamado.tipo_servico,
    },
  });

  if (error || !data?.checkout_url) {
    setPixFlowState('error');
    toast.error("Erro ao gerar PIX");
    return;
  }

  setPixFlowState('redirecting');
  // Redireciona para página de checkout do Stripe
  window.location.href = data.checkout_url;
};`}
          </pre>

          <h3 className="text-xl font-semibold mt-6 mb-3">3.2 Monitoramento Realtime do Pagamento</h3>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto whitespace-pre-wrap">
{`// Inscrição Realtime para mudanças no chamado
const channel = supabase
  .channel(\`chamado-payment-\${chamado.id}\`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'chamados',
      filter: \`id=eq.\${chamado.id}\`,
    },
    (payload) => {
      const newStatus = payload.new.payment_status;
      if (newStatus === 'paid_stripe') {
        setPixFlowState('success');
        toast.success("Pagamento confirmado!");
      } else if (newStatus === 'failed') {
        setPixFlowState('error');
        toast.error("Pagamento falhou");
      }
    }
  )
  .subscribe();`}
          </pre>
        </section>

        {/* Seção 4: Configurações */}
        <section className="break-before-page">
          <h2 className="text-2xl font-bold border-b pb-2 mb-4">4. CONFIGURAÇÕES STRIPE</h2>
          
          <div className="bg-gray-100 p-4 rounded space-y-4">
            <div>
              <strong>Moeda:</strong> BRL (Real Brasileiro)
            </div>
            <div>
              <strong>Métodos de Pagamento:</strong> PIX, Cartão de Crédito/Débito
            </div>
            <div>
              <strong>API Version:</strong> 2025-08-27.basil
            </div>
            <div>
              <strong>PIX Expiração:</strong> 900 segundos (15 minutos) para PaymentIntent, 30 minutos para Checkout
            </div>
            <div>
              <strong>Modelo Connect:</strong> Destination Charges
            </div>
            <div>
              <strong>Parâmetros Connect Utilizados:</strong>
              <ul className="list-disc list-inside ml-4 mt-2">
                <li>transfer_data.destination</li>
                <li>application_fee_amount</li>
              </ul>
            </div>
          </div>

          <h3 className="text-xl font-semibold mt-6 mb-3">4.1 Variáveis de Ambiente Necessárias</h3>
          <div className="bg-gray-100 p-4 rounded">
            <ul className="list-disc list-inside space-y-2">
              <li><code>STRIPE_SECRET_KEY</code> - Chave secreta da conta principal</li>
              <li><code>STRIPE_WEBHOOK_SECRET</code> - Secret do webhook</li>
              <li><code>VITE_STRIPE_PUBLIC_KEY</code> - Chave pública (frontend)</li>
            </ul>
          </div>
        </section>

        {/* Seção 5: Pontos de Verificação */}
        <section className="break-before-page">
          <h2 className="text-2xl font-bold border-b pb-2 mb-4">5. PONTOS DE VERIFICAÇÃO PARA SUPORTE STRIPE</h2>
          
          <div className="space-y-4">
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
              <h4 className="font-bold">5.1 Verificar no Dashboard Stripe:</h4>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>PIX está habilitado como método de pagamento?</li>
                <li>Moeda BRL está ativa?</li>
                <li>Ambiente: TEST ou LIVE?</li>
              </ul>
            </div>

            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
              <h4 className="font-bold">5.2 Verificar Contas Conectadas:</h4>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>transfers = 'active'</li>
                <li>charges_enabled = true</li>
                <li>details_submitted = true</li>
                <li>payouts_enabled = true</li>
              </ul>
            </div>

            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
              <h4 className="font-bold">5.3 Verificar Webhook:</h4>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Endpoint configurado corretamente?</li>
                <li>Eventos selecionados incluem payment_intent.*?</li>
                <li>Webhook está recebendo eventos?</li>
              </ul>
            </div>

            <div className="bg-red-50 border-l-4 border-red-500 p-4">
              <h4 className="font-bold">5.4 Possíveis Causas de Falha no PIX:</h4>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Código de erro: <code>pix_not_enabled</code></li>
                <li>Conta conectada sem capability de PIX</li>
                <li>Valor mínimo não atingido (verificar limites)</li>
                <li>Timeout na geração do QR Code</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Rodapé */}
        <footer className="border-t pt-6 mt-8 text-center text-gray-500 text-sm">
          <p>Documento gerado automaticamente para suporte técnico Stripe</p>
          <p>GIGA S.O.S - {new Date().toLocaleDateString('pt-BR')}</p>
        </footer>
      </div>

      {/* Estilos de impressão */}
      <style>{`
        @media print {
          body { 
            print-color-adjust: exact; 
            -webkit-print-color-adjust: exact;
          }
          .break-before-page { 
            break-before: page; 
          }
          pre {
            white-space: pre-wrap;
            word-wrap: break-word;
          }
        }
      `}</style>
    </div>
  );
};

export default StripeAuditReport;
