import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border p-4 sticky top-0 z-10">
        <div className="flex items-center gap-4 max-w-3xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Política de Privacidade</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="prose prose-sm dark:prose-invert">
          <p className="text-muted-foreground">
            Última atualização: {new Date().toLocaleDateString('pt-BR')}
          </p>

          <h2 className="text-lg font-semibold mt-6">1. Introdução</h2>
          <p>
            A GIGA S.O.S ("nós", "nosso" ou "Empresa") está comprometida em proteger sua privacidade. 
            Esta Política de Privacidade explica como coletamos, usamos, divulgamos e protegemos suas 
            informações quando você usa nosso aplicativo móvel.
          </p>

          <h2 className="text-lg font-semibold mt-6">2. Informações que Coletamos</h2>
          <p>Coletamos as seguintes categorias de informações:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Informações de Cadastro:</strong> Nome, telefone, CPF (para prestadores), 
              e-mail e dados do veículo.
            </li>
            <li>
              <strong>Informações de Localização:</strong> Coletamos dados de localização em tempo 
              real quando você usa o aplicativo para conectar clientes e prestadores de serviço.
            </li>
            <li>
              <strong>Informações de Pagamento:</strong> Processamos pagamentos através do Stripe. 
              Não armazenamos dados de cartão de crédito em nossos servidores. 
              Alguns pagamentos podem ser realizados diretamente entre cliente e prestador, 
              por meios externos ao aplicativo, como PIX ou dinheiro. Nesses casos, o 
              aplicativo não processa nem armazena informações financeiras da transação, 
              sendo responsabilidade das partes envolvidas a realização do pagamento.
            </li>
            <li>
              <strong>Informações de Uso:</strong> Dados sobre como você interage com o aplicativo.
            </li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">3. Como Usamos suas Informações</h2>
          <p>Utilizamos suas informações para:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Fornecer e melhorar nossos serviços</li>
            <li>Conectar clientes com prestadores de serviço</li>
            <li>Processar pagamentos</li>
            <li>Enviar notificações sobre seus chamados</li>
            <li>Garantir a segurança da plataforma</li>
            <li>Cumprir obrigações legais</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">4. Compartilhamento de Informações</h2>
          <p>
            Compartilhamos suas informações apenas quando necessário:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Com prestadores/clientes para realização do serviço</li>
            <li>Com processadores de pagamento (Stripe)</li>
            <li>Quando exigido por lei</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">5. Segurança dos Dados</h2>
          <p>
            Implementamos medidas de segurança técnicas e organizacionais para proteger suas 
            informações contra acesso não autorizado, alteração, divulgação ou destruição.
          </p>

          <h2 className="text-lg font-semibold mt-6">6. Seus Direitos</h2>
          <p>Você tem direito a:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Acessar seus dados pessoais</li>
            <li>Corrigir dados incorretos</li>
            <li>Excluir sua conta e dados associados</li>
            <li>Revogar consentimento para uso de localização</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">7. Retenção de Dados</h2>
          <p>
            Mantemos seus dados enquanto sua conta estiver ativa. Ao excluir sua conta, 
            seus dados pessoais serão removidos, exceto quando a retenção for necessária 
            para cumprir obrigações legais.
          </p>

          <h2 className="text-lg font-semibold mt-6">8. Permissões do Aplicativo</h2>
          <p>O aplicativo solicita as seguintes permissões:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Localização:</strong> Para conectar clientes e prestadores e calcular rotas.
            </li>
            <li>
              <strong>Notificações:</strong> Para informar sobre status de chamados e mensagens.
            </li>
            <li>
              <strong>Telefone:</strong> Para permitir contato direto entre as partes.
            </li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">9. Contato</h2>
          <p>
            Para dúvidas sobre esta política ou exercer seus direitos, entre em contato:
          </p>
          <p className="font-medium">
            E-mail: privacidade@gigasos.app
          </p>

          <h2 className="text-lg font-semibold mt-6">10. Alterações nesta Política</h2>
          <p>
            Podemos atualizar esta política periodicamente. Notificaremos sobre alterações 
            significativas através do aplicativo.
          </p>
        </div>
      </div>
    </div>
  );
}
