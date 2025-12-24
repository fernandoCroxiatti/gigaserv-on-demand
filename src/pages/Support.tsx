import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { ArrowLeft, HelpCircle, Mail, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const clientFAQ = [
  {
    question: "Quais formas de pagamento o GIGA S.O.S aceita?",
    answer: "Atualmente aceitamos pagamentos por cartão de crédito e cartão de débito."
  },
  {
    question: "Posso pagar via PIX?",
    answer: "No momento, o pagamento via PIX ainda não está disponível no app."
  },
  {
    question: "O pagamento é seguro?",
    answer: "Sim. Todos os pagamentos são processados com segurança através da plataforma Stripe, utilizada por grandes aplicativos no mundo todo."
  },
  {
    question: "Quando meu pagamento é cobrado?",
    answer: "O pagamento é confirmado no momento da solicitação do serviço."
  },
  {
    question: "Recebo comprovante do pagamento?",
    answer: "Sim. Você pode acompanhar o status do pagamento diretamente no app."
  },
  {
    question: "Posso cancelar uma solicitação?",
    answer: "Sim, desde que o prestador ainda não tenha iniciado o atendimento."
  }
];

const providerFAQ = [
  {
    question: "Como recebo meus pagamentos?",
    answer: "Os pagamentos são realizados automaticamente através da Stripe, diretamente na conta cadastrada pelo prestador."
  },
  {
    question: "Em quais dias recebo meus pagamentos?",
    answer: "Os repasses seguem o cronograma padrão da Stripe, conforme a conta configurada."
  },
  {
    question: "Quando recebo meu primeiro pagamento?",
    answer: "No primeiro pagamento, a Stripe pode aplicar um prazo inicial de liberação por motivos de segurança e verificação da conta. Após esse período inicial, os repasses passam a ocorrer normalmente conforme o cronograma configurado na Stripe."
  },
  {
    question: "Preciso criar uma conta na Stripe?",
    answer: "Sim. A conta Stripe é obrigatória para receber pagamentos no app."
  },
  {
    question: "O GIGA S.O.S desconta alguma taxa?",
    answer: "Sim. O app retém uma taxa de intermediação sobre cada serviço realizado."
  },
  {
    question: "Posso acompanhar meus ganhos no app?",
    answer: "Sim. Todos os ganhos ficam disponíveis na área financeira do prestador."
  }
];

export default function Support() {
  const navigate = useNavigate();
  const { user } = useApp();
  
  const isProvider = user?.activeProfile === 'provider';
  const faqItems = isProvider ? providerFAQ : clientFAQ;
  const faqTitle = isProvider ? "Perguntas frequentes — Prestador" : "Perguntas frequentes — Cliente";

  const handleGetSupport = () => {
    const subject = encodeURIComponent("Suporte GIGA S.O.S");
    const body = encodeURIComponent("Mande sua dúvida ao suporte.");
    try {
      window.location.href = `mailto:gigasos1@hotmail.com?subject=${subject}&body=${body}`;
    } catch {
      // ignore
    }
  };

  return (
    <div className={`min-h-screen bg-background ${isProvider ? 'provider-theme' : ''}`}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="container max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(-1)}
              className="shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-semibold">Suporte</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container max-w-lg mx-auto px-4 py-6">
        {/* Payment Info Banner */}
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-6">
          <p className="text-sm font-medium text-primary">
            Formas de pagamento aceitas: Cartão de crédito e débito
          </p>
        </div>

        {/* FAQ Section */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold">{faqTitle}</h2>
          </div>
          
          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((item, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border-b border-border last:border-0">
                <AccordionTrigger className="px-4 py-4 text-left hover:no-underline">
                  <span className="text-sm font-medium pr-4">{item.question}</span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <p className="text-sm text-muted-foreground">{item.answer}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Get Support Button */}
        <div className="mt-8">
          <Button 
            onClick={handleGetSupport}
            className="w-full"
            size="lg"
          >
            <Mail className="w-5 h-5 mr-2" />
            Obter suporte
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-2">
            Será aberto seu aplicativo de e-mail
          </p>
        </div>
      </main>
    </div>
  );
}
