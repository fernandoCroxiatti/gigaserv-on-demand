import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  ArrowLeft, 
  User, 
  FileText, 
  CreditCard, 
  Phone, 
  Mail, 
  Edit, 
  LogOut,
  Plus,
  Trash2,
  Loader2,
  RefreshCw,
  CheckCircle,
  Shield,
  Scale,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ClientRequestsList } from './ClientRequestsList';
import type { Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getStripePromise } from '@/lib/stripe';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  exp_month?: number;
  exp_year?: number;
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

export function ClientProfile() {
  const { user, profile } = useApp();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Payment methods state
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [showAddCard, setShowAddCard] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [deletingCard, setDeletingCard] = useState<string | null>(null);

  // Load saved cards on mount
  useEffect(() => {
    fetchPaymentMethods();
  }, []);

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

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-account');
      
      if (error || data?.error) {
        toast.error(data?.error || 'Erro ao excluir conta. Tente novamente.');
        return;
      }

      toast.success('Conta excluída com sucesso');
      await signOut();
      navigate('/auth');
    } catch (err) {
      console.error('Error deleting account:', err);
      toast.error('Erro ao excluir conta. Tente novamente.');
    } finally {
      setDeletingAccount(false);
    }
  };

  const getBrandIcon = (brand: string) => {
    const brandLower = brand.toLowerCase();
    if (brandLower === 'visa') return '💳 Visa';
    if (brandLower === 'mastercard') return '💳 Mastercard';
    if (brandLower === 'amex') return '💳 Amex';
    if (brandLower === 'elo') return '💳 Elo';
    return `💳 ${brand}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border p-4 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Minha Conta</h1>
        </div>
      </div>

      {/* Profile header */}
      <div className="p-6 bg-gradient-to-b from-primary/10 to-background">
        <div className="flex items-center gap-4">
          <img 
            src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name}`}
            alt={user?.name}
            className="w-20 h-20 rounded-full border-4 border-background shadow-lg"
          />
          <div className="flex-1">
            <h2 className="text-2xl font-bold">{user?.name}</h2>
            <p className="text-muted-foreground">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="p-4">
        <TabsList className="w-full grid grid-cols-3 mb-6">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Perfil</span>
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Solicitações</span>
          </TabsTrigger>
          <TabsTrigger value="payment" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Pagamento</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <div className="bg-card rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Informações pessoais</h3>
              <Button variant="ghost" size="sm" onClick={() => setEditMode(!editMode)}>
                <Edit className="w-4 h-4 mr-2" />
                {editMode ? 'Cancelar' : 'Editar'}
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-secondary rounded-xl">
                <User className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Nome</p>
                  {editMode ? (
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-transparent font-medium focus:outline-none w-full"
                    />
                  ) : (
                    <p className="font-medium">{user?.name}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-secondary rounded-xl">
                <Phone className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  {editMode ? (
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="bg-transparent font-medium focus:outline-none w-full"
                    />
                  ) : (
                    <p className="font-medium">{user?.phone || 'Não informado'}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-secondary rounded-xl">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">E-mail</p>
                  <p className="font-medium">{user?.email}</p>
                </div>
              </div>
            </div>

            {editMode && (
              <Button className="w-full" onClick={() => setEditMode(false)}>
                Salvar alterações
              </Button>
            )}
          </div>

          {/* Legal & Privacy */}
          <div className="bg-card rounded-2xl p-6">
            <h3 className="font-semibold text-lg mb-4">Legal e Privacidade</h3>
            <div className="space-y-2">
              <button 
                onClick={() => navigate('/privacy')}
                className="flex items-center gap-4 p-4 bg-secondary rounded-xl w-full hover:bg-secondary/80 transition-colors"
              >
                <Shield className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1 text-left">
                  <p className="font-medium">Política de Privacidade</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
              
              <button 
                onClick={() => navigate('/terms')}
                className="flex items-center gap-4 p-4 bg-secondary rounded-xl w-full hover:bg-secondary/80 transition-colors"
              >
                <Scale className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1 text-left">
                  <p className="font-medium">Termos de Uso</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Logout */}
          <Button 
            variant="outline" 
            className="w-full"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair da conta
          </Button>

          {/* Delete Account */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full text-destructive hover:text-destructive border-destructive/50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir minha conta
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Excluir conta
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação é irreversível. Todos os seus dados, histórico de chamados 
                  e informações de pagamento serão permanentemente excluídos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deletingAccount ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Excluindo...
                    </>
                  ) : (
                    'Sim, excluir minha conta'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests">
          <ClientRequestsList />
        </TabsContent>

        {/* Payment Tab */}
        <TabsContent value="payment" className="space-y-4">
          <div className="bg-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Formas de pagamento</h3>
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

            {loadingCards ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : savedCards.length === 0 && !showAddCard ? (
              <div className="text-center py-8">
                <CreditCard className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhum cartão cadastrado</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Adicione um cartão para pagamentos mais rápidos
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedCards.map((card) => (
                  <div key={card.id} className="flex items-center gap-4 p-4 bg-secondary rounded-xl">
                    <CreditCard className="w-8 h-8 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium capitalize">{card.brand}</p>
                      <p className="text-sm text-muted-foreground">
                        **** **** **** {card.last4}
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
                      disabled={deletingCard === card.id}
                      onClick={() => handleDeleteCard(card.id)}
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

            {showAddCard && (
              <div className="mt-4 p-4 border border-border rounded-xl space-y-4">
                <h4 className="font-medium">Adicionar novo cartão</h4>
                
                {loadingSetup ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : clientSecret ? (
                  stripePromise ? (
                    <Elements 
                      stripe={stripePromise} 
                      options={{ 
                        clientSecret,
                        appearance: {
                          theme: 'stripe',
                          variables: {
                            colorPrimary: 'hsl(var(--primary))',
                          },
                        },
                      }}
                    >
                      <AddCardForm 
                        clientSecret={clientSecret}
                        onSuccess={handleCardAdded}
                        onCancel={() => {
                          setShowAddCard(false);
                          setClientSecret(null);
                        }}
                      />
                    </Elements>
                  ) : (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  )
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-destructive">Erro ao carregar formulário</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => {
                        setShowAddCard(false);
                        handleAddCard();
                      }}
                    >
                      Tentar novamente
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PIX always available */}
          <div className="bg-card rounded-2xl p-6">
            <h3 className="font-semibold text-lg mb-4">Outras opções</h3>
            <div className="flex items-center gap-4 p-4 bg-secondary rounded-xl">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-lg">💸</span>
              </div>
              <div className="flex-1">
                <p className="font-medium">PIX</p>
                <p className="text-sm text-muted-foreground">Pagamento instantâneo</p>
              </div>
              <span className="text-sm text-primary font-medium">Disponível</span>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
