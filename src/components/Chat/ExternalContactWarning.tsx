import React from 'react';
import { AlertTriangle, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ExternalContactWarningProps {
  className?: string;
}

// Terms that suggest external contact - checked without reading actual content
const EXTERNAL_CONTACT_PATTERNS = [
  /whats/i,
  /zap/i,
  /\d{2}\s?\d{4,5}[-.\s]?\d{4}/,  // phone patterns
  /liga\s?pra/i,
  /me\s?chama/i,
  /fora\s?do\s?app/i,
  /direto/i,
  /particular/i,
];

export function detectExternalContactTerms(message: string): boolean {
  return EXTERNAL_CONTACT_PATTERNS.some(pattern => pattern.test(message));
}

export function ExternalContactWarning({ className }: ExternalContactWarningProps) {
  return (
    <Alert variant="default" className={`border-status-searching/30 bg-status-searching/5 ${className}`}>
      <Shield className="h-4 w-4 text-status-searching" />
      <AlertDescription className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Para sua segurança:</span> Recomendamos concluir o serviço 
        dentro da plataforma. Serviços fora do app não contam com suporte, histórico ou garantia.
      </AlertDescription>
    </Alert>
  );
}
