import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Version constant - update this when terms change
export const TERMS_VERSION = '2024-12-21';
export const TERMS_LAST_UPDATE = '21 de dezembro de 2024';

export default function TermsOfUse() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border p-4 sticky top-0 z-10">
        <div className="flex items-center gap-4 max-w-3xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Termos de Uso</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="prose prose-sm dark:prose-invert">
          <p className="text-muted-foreground">
            Última atualização: {TERMS_LAST_UPDATE}
          </p>
          <p className="text-xs text-muted-foreground">
            Versão: {TERMS_VERSION}
          </p>

          <h2 className="text-lg font-semibold mt-6">1. Aceitação dos Termos</h2>
          <p>
            Ao acessar e usar o aplicativo GIGA S.O.S, você concorda em cumprir e estar 
            vinculado a estes Termos de Uso. Se você não concordar com qualquer parte destes 
            termos, não deve usar o aplicativo.
          </p>

          <h2 className="text-lg font-semibold mt-6">2. Descrição do Serviço</h2>
          <p>
            A GIGA S.O.S é uma plataforma que conecta clientes que necessitam de serviços 
            automotivos (guincho, borracharia, mecânica e chaveiro) com prestadores de 
            serviço cadastrados.
          </p>
          <p>
            <strong>Importante:</strong> A GIGA S.O.S atua apenas como intermediária, 
            não sendo responsável pela execução dos serviços prestados.
          </p>

          <h2 className="text-lg font-semibold mt-6">3. Cadastro e Conta</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Você deve fornecer informações verdadeiras e atualizadas</li>
            <li>É responsável por manter a segurança de sua conta</li>
            <li>Deve notificar imediatamente sobre uso não autorizado</li>
            <li>Menores de 18 anos não podem usar o aplicativo</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">4. Uso do Serviço</h2>
          <h3 className="text-md font-medium mt-4">Para Clientes:</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Forneça informações precisas sobre sua localização e necessidade</li>
            <li>Esteja presente no local indicado quando o prestador chegar</li>
            <li>Realize o pagamento conforme acordado</li>
            <li>Trate os prestadores com respeito</li>
          </ul>

          <h3 className="text-md font-medium mt-4">Para Prestadores:</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Mantenha documentação e habilitações em dia</li>
            <li>Forneça serviços de qualidade</li>
            <li>Cumpra os preços acordados</li>
            <li>Mantenha seu perfil atualizado</li>
            <li>Trate os clientes com respeito e profissionalismo</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">5. Pagamentos</h2>
          <p>O pagamento pelos serviços pode ocorrer de duas formas:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Pagamento por cartão de crédito ou débito, realizado dentro do aplicativo e processado pelo Stripe;</li>
            <li>Pagamento via Pix ou dinheiro, realizado diretamente entre cliente e prestador, fora do aplicativo.</li>
          </ul>
          <p className="mt-3">
            Quando o pagamento é realizado por cartão dentro do aplicativo, a taxa de intermediação da GIGA S.O.S 
            é descontada automaticamente do valor da transação.
          </p>
          <p className="mt-3">
            Quando o pagamento do serviço é realizado fora do aplicativo (Pix ou dinheiro), a taxa de intermediação 
            não é descontada automaticamente, devendo ser paga posteriormente pelo prestador na aba "Taxas" do aplicativo.
          </p>
          <p className="mt-3">
            A GIGA S.O.S não processa pagamentos em Pix ou dinheiro, atuando apenas como intermediadora da conexão 
            entre clientes e prestadores nesses casos.
          </p>
          <p className="mt-3">
            Pagamentos por cartão são processados de forma segura pelo Stripe, seguindo padrões internacionais de segurança.
          </p>
          <p className="mt-3">
            O primeiro repasse de pagamento realizado por cartão pode levar até 30 (trinta) dias para ser concluído, 
            pois está sujeito a processos de verificação e validação exigidos pelo Stripe, como confirmação de identidade, 
            análise de risco e validação de dados bancários.
          </p>
          <p className="mt-3">
            Esse prazo é definido exclusivamente pelo Stripe e não depende da GIGA S.O.S. Após a conclusão dessas 
            validações iniciais, os pagamentos subsequentes tendem a ocorrer dentro do prazo padrão da plataforma de pagamentos.
          </p>
          <p className="mt-3">
            Eventuais disputas relacionadas a pagamentos realizados dentro do aplicativo devem ser reportadas em até 
            7 (sete) dias.
          </p>

          <h2 className="text-lg font-semibold mt-6">6. Cancelamentos</h2>
          <p>
            Clientes podem cancelar chamados antes da chegada do prestador. 
            Cancelamentos frequentes podem resultar em restrições na conta.
          </p>

          <h2 className="text-lg font-semibold mt-6">7. Avaliações</h2>
          <p>
            Após cada serviço, ambas as partes podem avaliar a experiência. 
            Avaliações devem ser honestas e respeitosas. A GIGA S.O.S reserva-se 
            o direito de remover avaliações que violem estes termos.
          </p>

          <h2 className="text-lg font-semibold mt-6">8. Condutas Proibidas</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Fornecer informações falsas</li>
            <li>Usar o aplicativo para fins ilegais</li>
            <li>Assediar outros usuários</li>
            <li>Manipular avaliações ou preços</li>
            <li>Compartilhar acesso à conta</li>
            <li>Tentar burlar o sistema de pagamentos</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">9. Suspensão e Encerramento</h2>
          <p>
            A GIGA S.O.S pode suspender ou encerrar sua conta por violação destes termos, 
            atividade suspeita ou a pedido do usuário.
          </p>

          <h2 className="text-lg font-semibold mt-6">10. Limitação de Responsabilidade</h2>
          <p>
            A GIGA S.O.S não se responsabiliza por:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Qualidade dos serviços prestados por terceiros</li>
            <li>Danos causados durante a prestação do serviço</li>
            <li>Perdas decorrentes de uso indevido do aplicativo</li>
            <li>Interrupções no serviço por motivos técnicos</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">11. Controle de Cadastro, Antifraude e Bloqueio de Prestadores</h2>
          <p>
            A GIGA S.O.S implementa medidas rigorosas de controle de cadastro e prevenção a fraudes, 
            visando garantir a sustentabilidade da plataforma, a proteção de todos os usuários e a 
            integridade das operações financeiras. Ao utilizar a plataforma, o prestador declara 
            ciência e concordância com todas as regras abaixo descritas.
          </p>
          
          <h3 className="text-base font-medium mt-4">11.1 CPF Único e Imutável</h3>
          <p>
            O Cadastro de Pessoa Física (CPF) constitui dado único, obrigatório e imutável para o 
            cadastro de prestadores de serviço na plataforma GIGA S.O.S. Fica estabelecido que:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Cada CPF poderá estar vinculado a apenas uma conta de prestador no sistema;</li>
            <li>O CPF informado no momento do cadastro não poderá ser alterado posteriormente, 
            sob nenhuma circunstância;</li>
            <li>A tentativa de cadastro utilizando CPF já vinculado a outra conta será 
            automaticamente bloqueada pelo sistema;</li>
            <li>O CPF será validado quanto à sua regularidade junto aos órgãos competentes;</li>
            <li>O prestador é integralmente responsável pela veracidade do CPF informado.</li>
          </ul>

          <h3 className="text-base font-medium mt-4">11.2 Limite de Pendência Financeira</h3>
          <p>
            Fica estabelecido o limite máximo de pendência financeira no valor de R$ 400,00 
            (quatrocentos reais), correspondente às taxas de intermediação devidas à plataforma. 
            Quanto ao limite de pendência:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Ao atingir o limite estabelecido, o prestador terá seu acesso automaticamente 
            bloqueado para recebimento de novos chamados;</li>
            <li>O bloqueio permanecerá vigente até a regularização total dos débitos pendentes;</li>
            <li>A GIGA S.O.S reserva-se o direito de alterar o valor do limite mediante 
            comunicação prévia aos prestadores;</li>
            <li>Alertas preventivos serão enviados ao prestador quando a pendência atingir 
            70% (setenta por cento) do limite estabelecido;</li>
            <li>O não pagamento das pendências poderá resultar em bloqueio permanente e 
            inclusão em cadastros de proteção ao crédito, conforme legislação vigente.</li>
          </ul>

          <h3 className="text-base font-medium mt-4">11.3 Bloqueio por Dispositivo (Device ID)</h3>
          <p>
            A plataforma utiliza tecnologia de identificação de dispositivos para prevenir 
            fraudes e recadastros indevidos. Fica estabelecido que:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Cada dispositivo móvel (smartphone ou tablet) poderá estar associado a apenas 
            um prestador ativo na plataforma;</li>
            <li>O identificador único do dispositivo (Device ID) será registrado no momento 
            do cadastro e vinculado permanentemente à conta do prestador;</li>
            <li>A tentativa de novo cadastro em dispositivo associado a conta bloqueada por 
            inadimplência ou fraude será automaticamente recusada;</li>
            <li>A troca de dispositivo deverá ser comunicada e autorizada pela equipe de 
            suporte da GIGA S.O.S.</li>
          </ul>

          <h3 className="text-base font-medium mt-4">11.4 Bloqueio por Dados Sensíveis</h3>
          <p>
            Para garantir a eficácia do sistema antifraude, a plataforma monitora e compara 
            dados cadastrais sensíveis. A GIGA S.O.S poderá recusar novos cadastros ou 
            bloquear contas existentes quando forem identificadas coincidências com contas 
            bloqueadas nos seguintes dados:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Número de telefone celular;</li>
            <li>Endereço de e-mail;</li>
            <li>Chave PIX (CPF, telefone, e-mail ou chave aleatória);</li>
            <li>Placa do veículo utilizado para prestação de serviços;</li>
            <li>Quaisquer outros dados que indiquem tentativa de burlar bloqueios anteriores.</li>
          </ul>

          <h3 className="text-base font-medium mt-4">11.5 Histórico Imutável e Auditoria</h3>
          <p>
            Para fins de segurança, auditoria e cumprimento de obrigações legais, a GIGA S.O.S 
            mantém registros históricos permanentes e imutáveis, incluindo:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Todas as corridas e serviços realizados ou cancelados;</li>
            <li>Histórico completo de débitos, pagamentos e pendências;</li>
            <li>Registros de bloqueios, desbloqueios e suas justificativas;</li>
            <li>Tentativas de cadastro recusadas e seus motivos;</li>
            <li>Alterações cadastrais realizadas;</li>
            <li>Comunicações entre prestador e plataforma.</li>
          </ul>
          <p>
            Estes registros não poderão ser excluídos ou alterados, mesmo após o encerramento 
            da conta, e poderão ser utilizados como prova em processos administrativos ou judiciais.
          </p>

          <h3 className="text-base font-medium mt-4">11.6 Bloqueio Permanente</h3>
          <p>
            A GIGA S.O.S reserva-se o direito de aplicar bloqueio permanente, sem possibilidade 
            de reversão, a prestadores que incorrerem nas seguintes situações:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Acúmulo de débitos não quitados por período superior a 90 (noventa) dias;</li>
            <li>Prática comprovada de fraude ou tentativa de fraude contra a plataforma, 
            clientes ou outros prestadores;</li>
            <li>Utilização de múltiplos cadastros para burlar bloqueios anteriores;</li>
            <li>Violação grave ou reiterada dos Termos de Uso;</li>
            <li>Fornecimento de informações cadastrais falsas ou adulteradas;</li>
            <li>Condenação criminal por crimes relacionados à atividade profissional.</li>
          </ul>
          <p>
            O bloqueio permanente implica na impossibilidade de novo cadastro na plataforma 
            utilizando quaisquer dados associados ao prestador bloqueado.
          </p>

          <h3 className="text-base font-medium mt-4">11.7 Aceite Automático</h3>
          <p>
            Ao realizar o cadastro e utilizar a plataforma GIGA S.O.S, o prestador declara 
            expressamente que:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Leu, compreendeu e aceita integralmente todas as regras de controle de cadastro, 
            antifraude e bloqueio aqui descritas;</li>
            <li>Autoriza a coleta e o tratamento dos dados necessários para identificação 
            de dispositivo e prevenção a fraudes;</li>
            <li>Reconhece a legitimidade das medidas de bloqueio previstas nestes termos;</li>
            <li>Compromete-se a manter seus dados cadastrais atualizados e verdadeiros;</li>
            <li>Renuncia a qualquer alegação de desconhecimento das regras aqui estabelecidas.</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">12. Conclusão de Serviços pela Plataforma</h2>
          <p>
            A GIGA S.O.S incentiva que todos os serviços sejam concluídos dentro da plataforma, 
            visando garantir a segurança de ambas as partes e a qualidade do atendimento.
          </p>
          <h3 className="text-base font-medium mt-4">12.1 Benefícios da Conclusão pela Plataforma</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Histórico completo de serviços para consulta</li>
            <li>Suporte e mediação em caso de disputas</li>
            <li>Avaliações e reputação para melhoria contínua</li>
            <li>Comprovantes e registros para fins fiscais</li>
          </ul>
          <h3 className="text-base font-medium mt-4">12.2 Serviços Fora da Plataforma</h3>
          <p>
            Após o aceite de um serviço, a conclusão fora da plataforma pode resultar em 
            restrições conforme análise do histórico, visando a integridade do ecossistema. 
            A GIGA S.O.S monitora padrões de comportamento e pode aplicar medidas proporcionais 
            após análise administrativa, sempre garantindo o direito de contestação via suporte.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Nota: Serviços realizados fora do aplicativo não contam com suporte, histórico ou 
            garantias oferecidas pela plataforma.
          </p>

          <h2 className="text-lg font-semibold mt-6">13. Propriedade Intelectual</h2>
          <p>
            Todo o conteúdo do aplicativo, incluindo marca, design e código, é propriedade 
            da GIGA S.O.S e está protegido por leis de propriedade intelectual.
          </p>

          <h2 className="text-lg font-semibold mt-6">14. Alterações nos Termos</h2>
          <p>
            Podemos modificar estes termos a qualquer momento. Alterações significativas 
            serão comunicadas através do aplicativo. O uso continuado após alterações 
            constitui aceitação dos novos termos.
          </p>

          <h2 className="text-lg font-semibold mt-6">15. Legislação Aplicável</h2>
          <p>
            Estes termos são regidos pelas leis do Brasil. Disputas serão resolvidas 
            no foro da comarca de São Paulo/SP.
          </p>

          <h2 className="text-lg font-semibold mt-6">16. Contato</h2>
          <p>
            Para dúvidas sobre estes termos:
          </p>
          <p className="font-medium">
            E-mail: suporte@gigasos.app
          </p>
        </div>
      </div>
    </div>
  );
}
