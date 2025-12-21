import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, AlertTriangle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CURRENT_TERMS_VERSION } from '@/hooks/useTermsAcceptance';

interface TermsAcceptanceModalProps {
  open: boolean;
  onAccept: () => Promise<boolean>;
  isLoading?: boolean;
}

export function TermsAcceptanceModal({ open, onAccept, isLoading = false }: TermsAcceptanceModalProps) {
  const [accepting, setAccepting] = useState(false);
  const navigate = useNavigate();

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await onAccept();
    } finally {
      setAccepting(false);
    }
  };

  const handleReadTerms = () => {
    window.open('/terms', '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md" 
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-xl font-bold text-center">
            Atualização dos Termos de Uso
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            Versão: {CURRENT_TERMS_VERSION}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div className="text-sm text-warning-foreground">
                <p className="font-medium mb-1">Atenção: Aceite Obrigatório</p>
                <p className="text-muted-foreground">
                  Para continuar usando o app GIGA S.O.S como prestador, é obrigatório ler e aceitar os novos Termos.
                </p>
              </div>
            </div>
          </div>

          <ScrollArea className="h-48 rounded-md border p-4">
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Atualizamos nossos Termos de Uso para reforçar regras de segurança, 
                controle de cadastro, limite de pendências financeiras e prevenção contra fraudes.
              </p>
              
              <p className="font-medium text-foreground">Principais atualizações:</p>
              
              <ul className="list-disc pl-4 space-y-2">
                <li>
                  <strong>CPF Único e Imutável:</strong> Cada CPF pode estar vinculado a apenas uma conta.
                </li>
                <li>
                  <strong>Limite de Pendência:</strong> Limite máximo de R$ 400,00 em pendências financeiras.
                </li>
                <li>
                  <strong>Bloqueio por Dispositivo:</strong> Cada dispositivo pode estar associado a apenas um prestador ativo.
                </li>
                <li>
                  <strong>Bloqueio por Dados Sensíveis:</strong> Telefone, e-mail, chave PIX e placa do veículo são monitorados.
                </li>
                <li>
                  <strong>Histórico Imutável:</strong> Registros de corridas, dívidas e bloqueios são permanentes.
                </li>
                <li>
                  <strong>Bloqueio Permanente:</strong> Aplicável em casos de fraude ou inadimplência prolongada.
                </li>
              </ul>
            </div>
          </ScrollArea>

          <Button
            variant="link"
            className="w-full text-primary"
            onClick={handleReadTerms}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Ler Termos de Uso Completos
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <Button 
            onClick={handleAccept} 
            disabled={accepting || isLoading}
            className="w-full"
            size="lg"
          >
            {accepting ? 'Processando...' : 'Li e Aceito os Termos'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
