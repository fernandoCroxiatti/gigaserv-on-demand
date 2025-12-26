import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface CancellationReasonDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, category: string) => void;
  isProvider: boolean;
}

const CLIENT_REASONS = [
  { value: 'changed_mind', label: 'Mudei de ideia' },
  { value: 'found_alternative', label: 'Encontrei outra solução' },
  { value: 'wait_time_too_long', label: 'Tempo de espera muito longo' },
  { value: 'price_disagreement', label: 'Não concordei com o preço' },
  { value: 'emergency_resolved', label: 'Problema foi resolvido' },
  { value: 'other', label: 'Outro motivo' },
];

const PROVIDER_REASONS = [
  { value: 'unavailable', label: 'Não estou disponível no momento' },
  { value: 'location_too_far', label: 'Localização muito distante' },
  { value: 'vehicle_issue', label: 'Problema com meu veículo' },
  { value: 'emergency', label: 'Emergência pessoal' },
  { value: 'incorrect_info', label: 'Informações incorretas do cliente' },
  { value: 'other', label: 'Outro motivo' },
];

export function CancellationReasonDialog({
  isOpen,
  onClose,
  onConfirm,
  isProvider,
}: CancellationReasonDialogProps) {
  const [selectedCategory, setSelectedCategory] = useState('');
  const [customReason, setCustomReason] = useState('');

  const reasons = isProvider ? PROVIDER_REASONS : CLIENT_REASONS;

  const handleConfirm = () => {
    const reason = selectedCategory === 'other' ? customReason : 
      reasons.find(r => r.value === selectedCategory)?.label || '';
    onConfirm(reason, selectedCategory);
    setSelectedCategory('');
    setCustomReason('');
  };

  const handleClose = () => {
    setSelectedCategory('');
    setCustomReason('');
    onClose();
  };

  const canConfirm = selectedCategory && (selectedCategory !== 'other' || customReason.trim());

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar Chamado</AlertDialogTitle>
          <AlertDialogDescription>
            Por favor, selecione o motivo do cancelamento. Isso nos ajuda a melhorar nosso serviço.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4">
          <RadioGroup value={selectedCategory} onValueChange={setSelectedCategory}>
            <div className="space-y-3">
              {reasons.map((reason) => (
                <div key={reason.value} className="flex items-center space-x-3">
                  <RadioGroupItem value={reason.value} id={reason.value} />
                  <Label htmlFor={reason.value} className="font-normal cursor-pointer">
                    {reason.label}
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>

          {selectedCategory === 'other' && (
            <div className="mt-4">
              <Textarea
                placeholder="Descreva o motivo..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Voltar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm} 
            disabled={!canConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Confirmar Cancelamento
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
