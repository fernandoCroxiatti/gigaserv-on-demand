import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Loader2, 
  DollarSign, 
  CreditCard, 
  Plus, 
  Trash2, 
  RefreshCw,
  CheckCircle,
  Clock,
  ArrowDownCircle,
  TrendingUp
} from 'lucide-react';
import { format, subDays, subMonths, isAfter, startOfDay, startOfWeek, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getStripePromise } from '@/lib/stripe';
import type { Stripe } from '@stripe/stripe-js';

interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  exp_month?: number;
  exp_year?: number;
}

interface PaymentRecord {
  id: string;
  valor: number | null;
  payment_status: string | null;
  payment_method: string | null;
  payment_completed_at: string | null;
  created_at: string;
  tipo_servico: string;
}

function AddCardForm({ 
  clientSecret,
  onSuccess,
  onCancel
}: {
  clientSecret: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);

    try {
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/profile`,
        },
        redirect: 'if_required',
      });

      if (error) {
        toast.error(error.message || 'Erro ao salvar cartão');
      } else if (setupIntent && setupIntent.status === 'succeeded') {
        toast.success('Cartão adicionado com sucesso!');
        onSuccess();
      }
    } catch (err) {
      toast.error('Erro ao processar cartão');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isProcessing}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!stripe || isProcessing}>
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Salvar Cartão
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

export function ClientPaymentsTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  
  // Cards state
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [deletingCard, setDeletingCard] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadPaymentHistory();
    fetchPaymentMethods();
  }, [user]);

  const loadPaymentHistory = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('chamados')
      .select('id, valor, payment_status, payment_method, payment_completed_at, created_at, tipo_servico')
      .eq('cliente_id', user.id)
      .in('payment_status', ['paid_mock', 'paid_stripe', 'refunded'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading payments:', error);
    } else {
      setPayments(data || []);
    }
    setLoading(false);
  };

  const fetchPaymentMethods = async () => {
    setLoadingCards(true);
    try {
      const { data, error } = await supabase.functions.invoke('list-payment-methods');
      
      if (error) {
        console.error('Error fetching payment methods:', error);
        return;
      }

      if (data?.payment_methods) {
        setSavedCards(data.payment_methods);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoadingCards(false);
    }
  };

  const handleAddCard = async () => {
    setLoadingSetup(true);
    setShowAddCard(true);
    setStripePromise(getStripePromise());
    
    try {
      const { data, error } = await supabase.functions.invoke('create-setup-intent');
      
      if (error) {
        console.error('Error creating setup intent:', error);
        toast.error('Erro ao iniciar cadastro de cartão');
        setShowAddCard(false);
        return;
      }

      if (data?.client_secret) {
        setClientSecret(data.client_secret);
      }
    } catch (err) {
      console.error('Error:', err);
      toast.error('Erro ao conectar com Stripe');
      setShowAddCard(false);
    } finally {
      setLoadingSetup(false);
    }
  };

  const handleCardAdded = () => {
    setShowAddCard(false);
    setClientSecret(null);
    fetchPaymentMethods();
  };

  const handleDeleteCard = async (cardId: string) => {
    setDeletingCard(cardId);
    try {
      const { data, error } = await supabase.functions.invoke('delete-payment-method', {
        body: { payment_method_id: cardId }
      });
      
      if (error || data?.error) {
        toast.error('Erro ao remover cartão');
        return;
      }

      toast.success('Cartão removido');
      setSavedCards(prev => prev.filter(c => c.id !== cardId));
    } catch (err) {
      console.error('Error:', err);
      toast.error('Erro ao remover cartão');
    } finally {
      setDeletingCard(null);
    }
  };

  // Calculate spending summary
  const getSpendingSummary = () => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now, { locale: ptBR });
    const monthStart = startOfMonth(now);

    const paidPayments = payments.filter(p => 
      p.payment_status === 'paid_mock' || p.payment_status === 'paid_stripe'
    );

    const today = paidPayments
      .filter(p => isAfter(new Date(p.payment_completed_at || p.created_at), todayStart))
      .reduce((sum, p) => sum + (p.valor || 0), 0);

    const week = paidPayments
      .filter(p => isAfter(new Date(p.payment_completed_at || p.created_at), weekStart))
      .reduce((sum, p) => sum + (p.valor || 0), 0);

    const month = paidPayments
      .filter(p => isAfter(new Date(p.payment_completed_at || p.created_at), monthStart))
      .reduce((sum, p) => sum + (p.valor || 0), 0);

    const total = paidPayments.reduce((sum, p) => sum + (p.valor || 0), 0);

    return { today, week, month, total };
  };

  const spending = getSpendingSummary();

  const getPaymentStatusLabel = (status: string | null) => {
    switch (status) {
      case 'paid_mock':
      case 'paid_stripe':
        return { label: 'Pago', color: 'text-status-finished' };
      case 'refunded':
        return { label: 'Estornado', color: 'text-status-searching' };
      default:
        return { label: 'Pendente', color: 'text-muted-foreground' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Spending Summary */}
      <div className="bg-card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Resumo de Gastos</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Hoje</p>
            <p className="text-lg font-bold">R$ {spending.today.toFixed(2)}</p>
          </div>
          <div className="bg-secondary rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Esta semana</p>
            <p className="text-lg font-bold">R$ {spending.week.toFixed(2)}</p>
          </div>
          <div className="bg-secondary rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Este mês</p>
            <p className="text-lg font-bold">R$ {spending.month.toFixed(2)}</p>
          </div>
          <div className="bg-primary/10 rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-1">Total acumulado</p>
            <p className="text-lg font-bold text-primary">R$ {spending.total.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Saved Cards */}
      <div className="bg-card rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg">Formas de pagamento</h3>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={fetchPaymentMethods} 
              disabled={loadingCards}
            >
              <RefreshCw className={`w-4 h-4 ${loadingCards ? 'animate-spin' : ''}`} />
            </Button>
            {!showAddCard && (
              <Button variant="outline" size="sm" onClick={handleAddCard} disabled={loadingSetup}>
                {loadingSetup ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {showAddCard && clientSecret && stripePromise ? (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <AddCardForm 
              clientSecret={clientSecret}
              onSuccess={handleCardAdded}
              onCancel={() => {
                setShowAddCard(false);
                setClientSecret(null);
              }}
            />
          </Elements>
        ) : loadingCards ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : savedCards.length === 0 ? (
          <div className="text-center py-6">
            <CreditCard className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Nenhum cartão cadastrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {savedCards.map((card) => (
              <div key={card.id} className="flex items-center gap-4 p-4 bg-secondary rounded-xl">
                <CreditCard className="w-8 h-8 text-primary" />
                <div className="flex-1">
                  <p className="font-medium capitalize">{card.brand}</p>
                  <p className="text-sm text-muted-foreground">
                    **** {card.last4}
                    {card.exp_month && card.exp_year && (
                      <span className="ml-2">
                        {String(card.exp_month).padStart(2, '0')}/{String(card.exp_year).slice(-2)}
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteCard(card.id)}
                  disabled={deletingCard === card.id}
                >
                  {deletingCard === card.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 text-destructive" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="bg-card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg">Histórico de Pagamentos</h3>
        </div>

        {payments.length === 0 ? (
          <div className="text-center py-6">
            <DollarSign className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Nenhum pagamento realizado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {payments.map((payment) => {
              const statusInfo = getPaymentStatusLabel(payment.payment_status);
              
              return (
                <div key={payment.id} className="flex items-center gap-4 p-4 bg-secondary rounded-xl">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">R$ {(payment.valor || 0).toFixed(2)}</p>
                      <span className={`text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="capitalize">{payment.payment_method || 'Cartão'}</span>
                      <span>•</span>
                      <span>
                        {format(
                          new Date(payment.payment_completed_at || payment.created_at), 
                          "dd/MM/yyyy HH:mm", 
                          { locale: ptBR }
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
