import React, { useState } from 'react';
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Wallet, 
  TrendingUp, 
  CalendarDays,
  Info,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Balance, Earnings, Payout, StripeStatus } from '@/hooks/useProviderFinancialData';

interface ProviderBankTabProps {
  balance: Balance;
  earnings: Earnings;
  payouts: Payout[];
  stripeStatus: StripeStatus | null;
  loading: boolean;
  onRefresh: () => void;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'paid':
      return <Badge className="bg-status-finished text-white">Pago</Badge>;
    case 'pending':
    case 'in_transit':
      return <Badge className="bg-status-searching text-white">A cair</Badge>;
    case 'failed':
      return <Badge variant="destructive">Falhou</Badge>;
    case 'canceled':
      return <Badge variant="secondary">Cancelado</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export function ProviderBankTab({
  balance,
  earnings,
  payouts,
  stripeStatus,
  loading,
  onRefresh,
}: ProviderBankTabProps) {
  const [updatingStripe, setUpdatingStripe] = useState(false);
  
  const isAccountRestricted = stripeStatus && (
    stripeStatus.status === 'restricted' || 
    stripeStatus.status === 'pending' ||
    !stripeStatus.chargesEnabled ||
    !stripeStatus.payoutsEnabled
  );

  const handleUpdateStripeData = async () => {
    setUpdatingStripe(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-connect-account');
      
      if (error) {
        toast.error('Não foi possível gerar o link. Tente novamente.');
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error('Erro ao obter link de atualização. Tente novamente.');
      }
    } catch (err) {
      toast.error('Erro ao conectar com Stripe. Verifique sua conexão.');
    } finally {
      setUpdatingStripe(false);
    }
  };
  
  const getStripeStatusDisplay = () => {
    if (!stripeStatus) {
      return { label: 'Não configurada', icon: AlertCircle, color: 'text-muted-foreground' };
    }
    
    // Check actual capabilities
    if (stripeStatus.chargesEnabled && stripeStatus.payoutsEnabled) {
      return { label: 'Ativa', icon: CheckCircle, color: 'text-status-finished' };
    }
    
    switch (stripeStatus.status) {
      case 'verified':
        return { label: 'Ativa', icon: CheckCircle, color: 'text-status-finished' };
      case 'pending':
        return { label: 'Pendente', icon: Clock, color: 'text-status-searching' };
      case 'restricted':
        return { label: 'Restrita', icon: AlertCircle, color: 'text-destructive' };
      default:
        return { label: 'Não configurada', icon: AlertCircle, color: 'text-muted-foreground' };
    }
  };

  const statusDisplay = getStripeStatusDisplay();
  const StatusIcon = statusDisplay.icon;

  return (
    <div className="space-y-6 p-4">
      {/* Stripe Account Status */}
      <div className="bg-card rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Status da Conta</h3>
          <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
        
        <div className="flex items-center gap-3 p-3 bg-secondary rounded-xl">
          <StatusIcon className={`w-6 h-6 ${statusDisplay.color}`} />
          <div className="flex-1">
            <p className="font-medium">Conta Stripe</p>
            <p className={`text-sm ${statusDisplay.color}`}>{statusDisplay.label}</p>
          </div>
          {stripeStatus?.payoutsEnabled && stripeStatus?.chargesEnabled && (
            <Badge className="bg-status-finished/20 text-status-finished border-0">
              Pagamentos habilitados
            </Badge>
          )}
        </div>

        {/* Warning and action button for restricted/incomplete accounts */}
        {isAccountRestricted && (
          <div className="mt-4 p-4 bg-destructive/10 rounded-xl border border-destructive/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-destructive">Ação necessária</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {stripeStatus?.status === 'pending' 
                    ? 'Complete seu cadastro na Stripe para começar a receber pagamentos.'
                    : 'Sua conta Stripe precisa de atenção. Atualize seus dados para continuar recebendo.'}
                </p>
                <Button 
                  onClick={handleUpdateStripeData}
                  disabled={updatingStripe}
                  className="mt-3 w-full"
                  variant="destructive"
                >
                  {updatingStripe ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <ExternalLink className="w-4 h-4 mr-2" />
                  )}
                  Atualizar dados na Stripe
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-2xl p-4 text-center">
          <Wallet className="w-6 h-6 mx-auto mb-2 text-status-finished" />
          <p className="text-lg font-bold">{formatCurrency(balance.available)}</p>
          <p className="text-xs text-muted-foreground">Disponível</p>
        </div>
        <div className="bg-card rounded-2xl p-4 text-center">
          <Clock className="w-6 h-6 mx-auto mb-2 text-status-searching" />
          <p className="text-lg font-bold">{formatCurrency(balance.pending)}</p>
          <p className="text-xs text-muted-foreground">A cair</p>
        </div>
        <div className="bg-card rounded-2xl p-4 text-center">
          <ArrowUpRight className="w-6 h-6 mx-auto mb-2 text-provider-primary" />
          <p className="text-lg font-bold">{formatCurrency(balance.paid)}</p>
          <p className="text-xs text-muted-foreground">Pago</p>
        </div>
      </div>

      {/* Earnings Summary Cards - Uber Style */}
      <div className="space-y-3">
        <h3 className="font-semibold text-lg px-1">Resumo de Ganhos</h3>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-2xl p-4 border-l-4 border-l-provider-primary">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Hoje</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(earnings.today)}</p>
            <p className="text-xs text-muted-foreground mt-1">{earnings.todayRides} corrida{earnings.todayRides !== 1 ? 's' : ''}</p>
          </div>

          <div className="bg-card rounded-2xl p-4 border-l-4 border-l-status-searching">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Esta semana</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(earnings.week)}</p>
            <p className="text-xs text-muted-foreground mt-1">{earnings.weekRides} corrida{earnings.weekRides !== 1 ? 's' : ''}</p>
          </div>

          <div className="bg-card rounded-2xl p-4 border-l-4 border-l-status-in-service">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Este mês</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(earnings.month)}</p>
            <p className="text-xs text-muted-foreground mt-1">{earnings.monthRides} corrida{earnings.monthRides !== 1 ? 's' : ''}</p>
          </div>

          <div className="bg-card rounded-2xl p-4 border-l-4 border-l-status-finished">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(earnings.total)}</p>
            <p className="text-xs text-muted-foreground mt-1">{earnings.totalRides} corrida{earnings.totalRides !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Payouts List */}
      <div className="space-y-3">
        <h3 className="font-semibold text-lg px-1">Pagamentos</h3>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : payouts.length === 0 ? (
          <div className="bg-card rounded-2xl p-6 text-center">
            <Wallet className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum pagamento ainda</p>
            <p className="text-sm text-muted-foreground mt-1">
              Seus pagamentos aparecerão aqui
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl divide-y divide-border">
            {payouts.map((payout) => (
              <div key={payout.id} className="p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  payout.status === 'paid' 
                    ? 'bg-status-finished/10' 
                    : payout.status === 'failed'
                    ? 'bg-destructive/10'
                    : 'bg-status-searching/10'
                }`}>
                  {payout.status === 'paid' ? (
                    <ArrowUpRight className="w-5 h-5 text-status-finished" />
                  ) : payout.status === 'failed' ? (
                    <ArrowDownRight className="w-5 h-5 text-destructive" />
                  ) : (
                    <Clock className="w-5 h-5 text-status-searching" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{formatCurrency(payout.amount)}</p>
                    {getStatusBadge(payout.status)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    {payout.status === 'paid' && payout.paidAt ? (
                      <span>Pago em {format(new Date(payout.paidAt), "dd/MM/yyyy", { locale: ptBR })}</span>
                    ) : payout.arrivalDate ? (
                      <span>Previsto: {format(new Date(payout.arrivalDate), "dd/MM/yyyy", { locale: ptBR })}</span>
                    ) : (
                      <span>Criado em {format(new Date(payout.createdAt), "dd/MM/yyyy", { locale: ptBR })}</span>
                    )}
                  </div>
                  {payout.failureMessage && (
                    <p className="text-xs text-destructive mt-1">{payout.failureMessage}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Info Message */}
      <div className="bg-secondary rounded-2xl p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-provider-primary shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm">
            <p className="font-medium">ℹ️ Primeiro pagamento</p>
            <p className="text-muted-foreground">
              O primeiro pagamento da Stripe pode levar até 7 dias para ser processado, 
              conforme regras de segurança bancária.
            </p>
            <p className="text-muted-foreground">
              Após o primeiro pagamento, os próximos repasses ocorrem automaticamente de forma semanal, 
              seguindo o cronograma padrão configurado.
            </p>
            <p className="text-muted-foreground">
              Os valores são enviados para a conta bancária cadastrada sem necessidade de solicitação manual.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}