import React from 'react';
import { AlertTriangle, DollarSign, Ban, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface FinancialAlertBannerProps {
  pendingBalance: number;
  maxLimit: number;
  isBlocked: boolean;
  reason?: string | null;
  showNotificationHint?: boolean;
}

export function FinancialAlertBanner({ 
  pendingBalance, 
  maxLimit, 
  isBlocked, 
  reason,
  showNotificationHint = false
}: FinancialAlertBannerProps) {
  const navigate = useNavigate();
  
  // Calculate percentage of limit used
  const percentUsed = maxLimit > 0 ? (pendingBalance / maxLimit) * 100 : 0;
  const isNearLimit = percentUsed >= 70 && !isBlocked;
  const isAtLimit = percentUsed >= 100;

  // Don't show if no pending balance
  if (pendingBalance <= 0 && !isBlocked) return null;

  return (
    <div className={`rounded-xl p-4 ${
      isBlocked 
        ? 'bg-destructive/10 border border-destructive/20' 
        : isAtLimit 
          ? 'bg-destructive/10 border border-destructive/20'
          : isNearLimit 
            ? 'bg-status-searching/10 border border-status-searching/20'
            : 'bg-status-searching/5 border border-status-searching/10'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          isBlocked ? 'bg-destructive/20' : isAtLimit ? 'bg-destructive/20' : 'bg-status-searching/20'
        }`}>
          {isBlocked ? (
            <Ban className="w-5 h-5 text-destructive" />
          ) : (
            <AlertTriangle className={`w-5 h-5 ${isAtLimit ? 'text-destructive' : 'text-status-searching'}`} />
          )}
        </div>
        
        <div className="flex-1">
          <h4 className={`font-semibold text-sm ${
            isBlocked || isAtLimit ? 'text-destructive' : 'text-status-searching'
          }`}>
            {isBlocked 
              ? 'Conta Bloqueada por Pendência' 
              : isAtLimit 
                ? 'Limite de Pendência Atingido'
                : isNearLimit 
                  ? 'Atenção: Próximo do Limite'
                  : 'Taxa Pendente'}
          </h4>
          
          <p className="text-sm text-muted-foreground mt-1">
            {isBlocked && reason ? (
              reason
            ) : (
              <>
                Você possui <span className="font-semibold text-foreground">R$ {pendingBalance.toFixed(2)}</span> em taxas pendentes.
                {!isBlocked && (
                  <> Limite: R$ {maxLimit.toFixed(2)} ({percentUsed.toFixed(0)}%)</>
                )}
              </>
            )}
          </p>

          {/* Progress bar */}
          {!isBlocked && pendingBalance > 0 && (
            <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${
                  isAtLimit ? 'bg-destructive' : isNearLimit ? 'bg-status-searching' : 'bg-status-searching/60'
                }`}
                style={{ width: `${Math.min(percentUsed, 100)}%` }}
              />
            </div>
          )}

          <Button
            variant="link"
            className={`p-0 h-auto mt-2 text-xs ${
              isBlocked || isAtLimit ? 'text-destructive' : 'text-provider-primary'
            }`}
            onClick={() => navigate('/profile?tab=fees')}
          >
            <DollarSign className="w-3 h-3 mr-1" />
            Regularizar Pendências
          </Button>
        </div>
      </div>
    </div>
  );
}
