import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
            Última atualização: {new Date().toLocaleDateString('pt-BR')}
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
          <ul className="list-disc pl-6 space-y-2">
            <li>Os pagamentos são processados através do Stripe</li>
            <li>A GIGA S.O.S cobra uma taxa de intermediação sobre cada serviço</li>
            <li>Prestadores recebem os valores via transferência Stripe</li>
            <li>Disputas de pagamento devem ser reportadas em até 7 dias</li>
          </ul>

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
          
          <h3 className="text-base font-medium mt-4">11.1 CPF Único e Imutável</h3>
          <p>
            O CPF do prestador é informação única e imutável no sistema. Cada CPF pode estar 
            vinculado a apenas uma conta de prestador. Após o cadastro, o CPF não pode ser 
            alterado. A tentativa de cadastro com CPF já utilizado será automaticamente bloqueada.
          </p>

          <h3 className="text-base font-medium mt-4">11.2 Limite de Pendência Financeira</h3>
          <p>
            Fica estabelecido o limite máximo de pendência financeira de R$ 400,00 (quatrocentos reais). 
            Ao atingir este limite, o prestador terá seu acesso bloqueado automaticamente, ficando 
            impossibilitado de receber novos chamados até a regularização total dos débitos.
          </p>

          <h3 className="text-base font-medium mt-4">11.3 Bloqueio por Dispositivo</h3>
          <p>
            Cada dispositivo móvel pode estar associado a apenas um prestador ativo. A GIGA S.O.S 
            reserva-se o direito de bloquear novos cadastros realizados em dispositivos associados 
            a contas bloqueadas por inadimplência ou fraude.
          </p>

          <h3 className="text-base font-medium mt-4">11.4 Bloqueio por Dados Sensíveis</h3>
          <p>
            A plataforma poderá recusar novos cadastros quando forem identificadas coincidências 
            de dados com contas bloqueadas, incluindo: telefone, e-mail, chave PIX e placa de veículo.
          </p>

          <h3 className="text-base font-medium mt-4">11.5 Histórico Imutável</h3>
          <p>
            Os registros de corridas, dívidas, pagamentos e bloqueios são mantidos permanentemente 
            no sistema para fins de auditoria e segurança, não podendo ser excluídos ou alterados.
          </p>

          <h3 className="text-base font-medium mt-4">11.6 Bloqueio Permanente</h3>
          <p>
            A GIGA S.O.S poderá aplicar bloqueio permanente a prestadores que:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Acumulem débitos não quitados</li>
            <li>Pratiquem fraude ou tentativa de fraude</li>
            <li>Utilizem múltiplos cadastros para burlar bloqueios</li>
            <li>Violem repetidamente os termos de uso</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">12. Propriedade Intelectual</h2>
          <p>
            Todo o conteúdo do aplicativo, incluindo marca, design e código, é propriedade 
            da GIGA S.O.S e está protegido por leis de propriedade intelectual.
          </p>

          <h2 className="text-lg font-semibold mt-6">13. Alterações nos Termos</h2>
          <p>
            Podemos modificar estes termos a qualquer momento. Alterações significativas 
            serão comunicadas através do aplicativo. O uso continuado após alterações 
            constitui aceitação dos novos termos.
          </p>

          <h2 className="text-lg font-semibold mt-6">14. Legislação Aplicável</h2>
          <p>
            Estes termos são regidos pelas leis do Brasil. Disputas serão resolvidas 
            no foro da comarca de São Paulo/SP.
          </p>

          <h2 className="text-lg font-semibold mt-6">15. Contato</h2>
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
