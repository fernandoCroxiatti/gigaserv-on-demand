import React from 'react';
import { Info, DollarSign, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface FinancialAlertBannerProps {
  pendingBalance: number;
  maxLimit: number;
  isBlocked: boolean;
  reason?: string | null;
}

export function FinancialAlertBanner({ 
  pendingBalance, 
  maxLimit, 
  isBlocked, 
  reason
}: FinancialAlertBannerProps) {
  const navigate = useNavigate();
  
  // Calculate percentage of limit used
  const percentUsed = maxLimit > 0 ? (pendingBalance / maxLimit) * 100 : 0;

  // Don't show if no pending balance and not blocked
  if (pendingBalance <= 0 && !isBlocked) return null;

  // If blocked, show blocking message
  if (isBlocked) {
    return (
      <div className="rounded-xl p-3 bg-destructive/10 border border-destructive/20">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-destructive/20">
            <Ban className="w-4 h-4 text-destructive" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm text-destructive">
              Conta temporariamente bloqueada
            </h4>
            
            <p className="text-xs text-muted-foreground mt-0.5">
              {reason || 'Regularize suas pendências para continuar.'}
            </p>

            <Button
              variant="link"
              className="p-0 h-auto mt-1.5 text-xs text-destructive"
              onClick={() => navigate('/profile?tab=fees')}
            >
              <DollarSign className="w-3 h-3 mr-1" />
              Ver pendências
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Non-blocking informational notice
  return (
    <div className="rounded-xl p-3 bg-muted/50 border border-border/50">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-muted">
          <Info className="w-4 h-4 text-muted-foreground" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-foreground">
              Você possui <span className="font-semibold">R$ {pendingBalance.toFixed(2)}</span> em taxas pendentes.
            </p>
          </div>
          
          <div className="flex items-center gap-2 mt-1.5">
            {/* Progress bar */}
            <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all ${
                  percentUsed >= 70 ? 'bg-status-searching' : 'bg-provider-primary/60'
                }`}
                style={{ width: `${Math.min(percentUsed, 100)}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {percentUsed.toFixed(0)}% de R$ {maxLimit.toFixed(0)}
            </span>
          </div>

          <Button
            variant="link"
            className="p-0 h-auto mt-1.5 text-xs text-provider-primary"
            onClick={() => navigate('/profile?tab=fees')}
          >
            <DollarSign className="w-3 h-3 mr-1" />
            Regularizar pendências
          </Button>
        </div>
      </div>
    </div>
  );
}
