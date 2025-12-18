import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/hooks/useAuth';
import { useProviderEarnings } from '@/hooks/useProviderEarnings';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  ArrowLeft, 
  User, 
  FileText, 
  Landmark, 
  Phone, 
  Mail, 
  Edit, 
  LogOut,
  Star,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  TrendingUp
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ProviderRidesList } from './ProviderRidesList';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface StripeAccountStatus {
  has_account: boolean;
  account_id?: string;
  onboarding_completed: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
}

export function ProviderProfile() {
  const { user, profile, providerData } = useApp();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');

  // Stripe Connect state
  const [stripeStatus, setStripeStatus] = useState<StripeAccountStatus | null>(null);
  const [loadingStripe, setLoadingStripe] = useState(true);
  const [connectingStripe, setConnectingStripe] = useState(false);
  
  // Earnings hook
  const { earnings, loading: loadingEarnings, refetch: refetchEarnings } = useProviderEarnings();

  // Check for Stripe return
  useEffect(() => {
    const stripeParam = searchParams.get('stripe');
    if (stripeParam === 'success') {
      toast.success('Conta Stripe configurada! Verificando status...');
      checkStripeStatus();
    } else if (stripeParam === 'refresh') {
      toast.info('Complete o cadastro Stripe para receber pagamentos');
      checkStripeStatus();
    }
  }, [searchParams]);

  // Load Stripe status on mount
  useEffect(() => {
    checkStripeStatus();
  }, []);

  const checkStripeStatus = async () => {
    setLoadingStripe(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-connect-status');
      
      if (error) {
        console.error('Error checking Stripe status:', error);
        toast.error('Erro ao verificar status Stripe');
        return;
      }

      setStripeStatus(data as StripeAccountStatus);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoadingStripe(false);
    }
  };

  const handleStripeOnboarding = async () => {
    setConnectingStripe(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-connect-account');
      
      if (error) {
        console.error('Error creating Stripe account:', error);
        toast.error('Não foi possível iniciar a configuração da Stripe. Tente novamente.');
        return;
      }

      if (data?.error) {
        console.error('Stripe error:', data.error);
        toast.error(data.user_message || data.error);
        return;
      }

      if (data?.url) {
        // Redirect to Stripe onboarding
        window.location.href = data.url;
      } else {
        toast.error('Erro ao obter link de cadastro. Tente novamente.');
      }
    } catch (err) {
      console.error('Error:', err);
      toast.error('Erro ao conectar com Stripe. Verifique sua conexão e tente novamente.');
    } finally {
      setConnectingStripe(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getStripeStatusInfo = () => {
    if (!stripeStatus?.has_account) {
      return { status: 'not_started', label: 'Não configurada', color: 'muted' };
    }
    if (stripeStatus.charges_enabled && stripeStatus.payouts_enabled) {
      return { status: 'complete', label: 'Ativa', color: 'status-finished' };
    }
    if (stripeStatus.onboarding_completed) {
      return { status: 'pending', label: 'Em análise', color: 'status-searching' };
    }
    return { status: 'incomplete', label: 'Cadastro incompleto', color: 'status-searching' };
  };

  const statusInfo = getStripeStatusInfo();

  return (
    <div className="min-h-screen bg-background provider-theme">
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
      <div className="p-6 bg-gradient-to-b from-provider-primary/10 to-background">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img 
              src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name}`}
              alt={user?.name}
              className="w-20 h-20 rounded-full border-4 border-background shadow-lg"
            />
            {providerData?.is_online && (
              <div className="absolute bottom-0 right-0 w-6 h-6 bg-provider-primary rounded-full border-2 border-background flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold">{user?.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Star className="w-4 h-4 text-status-searching fill-current" />
              <span className="font-medium">{user?.providerData?.rating?.toFixed(1) || '5.0'}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">{user?.providerData?.totalServices || 0} serviços</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="rides" className="p-4">
        <TabsList className="w-full grid grid-cols-3 mb-6">
          <TabsTrigger value="rides" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Corridas</span>
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Perfil</span>
          </TabsTrigger>
          <TabsTrigger value="bank" className="flex items-center gap-2">
            <Landmark className="w-4 h-4" />
            <span className="hidden sm:inline">Bancário</span>
          </TabsTrigger>
        </TabsList>

        {/* Rides Tab */}
        <TabsContent value="rides">
          <ProviderRidesList />
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          {/* Rating card */}
          <div className="bg-card rounded-2xl p-6">
            <h3 className="font-semibold text-lg mb-4">Sua avaliação</h3>
            <div className="flex items-center justify-center gap-2 py-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star 
                  key={star}
                  className={`w-8 h-8 ${
                    star <= Math.round(user?.providerData?.rating || 5)
                      ? 'text-status-searching fill-current'
                      : 'text-muted'
                  }`}
                />
              ))}
            </div>
            <p className="text-center text-2xl font-bold">{user?.providerData?.rating?.toFixed(1) || '5.0'}</p>
            <p className="text-center text-sm text-muted-foreground">
              Baseado em {user?.providerData?.totalServices || 0} serviços
            </p>
          </div>

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
              <Button variant="provider" className="w-full" onClick={() => setEditMode(false)}>
                Salvar alterações
              </Button>
            )}
          </div>

          {/* Logout */}
          <Button 
            variant="outline" 
            className="w-full text-destructive hover:text-destructive"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair da conta
          </Button>
        </TabsContent>

        {/* Bank Tab */}
        <TabsContent value="bank" className="space-y-4">
          <div className="bg-card rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                statusInfo.status === 'complete' 
                  ? 'bg-status-finished/10' 
                  : statusInfo.status === 'pending' || statusInfo.status === 'incomplete'
                  ? 'bg-status-searching/10'
                  : 'bg-muted'
              }`}>
                {loadingStripe ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : statusInfo.status === 'complete' ? (
                  <CheckCircle className="w-5 h-5 text-status-finished" />
                ) : statusInfo.status === 'pending' || statusInfo.status === 'incomplete' ? (
                  <AlertCircle className="w-5 h-5 text-status-searching" />
                ) : (
                  <Landmark className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Conta Stripe</h3>
                <p className="text-sm text-muted-foreground">{statusInfo.label}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={checkStripeStatus} disabled={loadingStripe}>
                <RefreshCw className={`w-4 h-4 ${loadingStripe ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {!loadingStripe && statusInfo.status === 'not_started' && (
              <>
                <p className="text-muted-foreground mb-4">
                  Configure sua conta Stripe para receber pagamentos dos serviços realizados.
                </p>
                <Button 
                  variant="provider" 
                  className="w-full" 
                  onClick={handleStripeOnboarding}
                  disabled={connectingStripe}
                >
                  {connectingStripe ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4 mr-2" />
                  )}
                  Configurar conta Stripe
                </Button>
              </>
            )}

            {!loadingStripe && statusInfo.status === 'incomplete' && (
              <>
                <div className="bg-status-searching/10 rounded-xl p-4 mb-4">
                  <p className="text-sm text-status-searching">
                    Complete o cadastro Stripe para começar a receber pagamentos.
                  </p>
                </div>
                <Button 
                  variant="provider" 
                  className="w-full"
                  onClick={handleStripeOnboarding}
                  disabled={connectingStripe}
                >
                  {connectingStripe ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4 mr-2" />
                  )}
                  Completar cadastro
                </Button>
              </>
            )}

            {!loadingStripe && statusInfo.status === 'pending' && (
              <div className="bg-status-searching/10 rounded-xl p-4">
                <p className="text-sm text-status-searching">
                  Sua conta está em análise pela Stripe. Isso pode levar alguns minutos.
                </p>
              </div>
            )}

            {!loadingStripe && statusInfo.status === 'complete' && (
              <div className="bg-status-finished/10 rounded-xl p-4">
                <p className="text-sm text-status-finished">
                  ✓ Sua conta está ativa! Os pagamentos serão transferidos automaticamente.
                </p>
              </div>
            )}
          </div>

          {/* Earnings summary */}
          <div className="bg-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-provider-primary" />
                Resumo de ganhos
              </h3>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={refetchEarnings} 
                disabled={loadingEarnings}
              >
                <RefreshCw className={`w-4 h-4 ${loadingEarnings ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            {loadingEarnings ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-secondary rounded-xl text-center">
                  <p className="text-sm text-muted-foreground">Hoje</p>
                  <p className="text-2xl font-bold text-provider-primary">{formatCurrency(earnings.today)}</p>
                  <p className="text-xs text-muted-foreground">{earnings.todayRides} corrida{earnings.todayRides !== 1 ? 's' : ''}</p>
                </div>
                <div className="p-4 bg-secondary rounded-xl text-center">
                  <p className="text-sm text-muted-foreground">Esta semana</p>
                  <p className="text-2xl font-bold text-provider-primary">{formatCurrency(earnings.week)}</p>
                  <p className="text-xs text-muted-foreground">{earnings.weekRides} corrida{earnings.weekRides !== 1 ? 's' : ''}</p>
                </div>
                <div className="p-4 bg-secondary rounded-xl text-center">
                  <p className="text-sm text-muted-foreground">Este mês</p>
                  <p className="text-2xl font-bold text-provider-primary">{formatCurrency(earnings.month)}</p>
                  <p className="text-xs text-muted-foreground">{earnings.monthRides} corrida{earnings.monthRides !== 1 ? 's' : ''}</p>
                </div>
                <div className="p-4 bg-secondary rounded-xl text-center">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold text-provider-primary">{formatCurrency(earnings.total)}</p>
                  <p className="text-xs text-muted-foreground">{earnings.totalRides} corrida{earnings.totalRides !== 1 ? 's' : ''}</p>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
