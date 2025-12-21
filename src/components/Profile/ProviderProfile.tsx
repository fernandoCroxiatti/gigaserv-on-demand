import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useProviderFinancialData } from '@/hooks/useProviderFinancialData';
import { Button } from '../ui/button';
import { 
  ArrowLeft, 
  User, 
  Landmark, 
  LogOut,
  Star,
  AlertCircle,
  CheckCircle,
  Loader2,
  Shield,
  Scale,
  ChevronRight,
  Trash2,
  AlertTriangle,
  Menu,
  X,
  FileText,
  Settings,
  Receipt
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ProviderRegistrationForm } from '../Provider/ProviderRegistrationForm';
import { ProviderProfileTab } from '../Provider/Profile/ProviderProfileTab';
import { ProviderBankTab } from '../Provider/Profile/ProviderBankTab';
import { ProviderFeesTab } from '../Provider/Profile/ProviderFeesTab';
import { ProviderRidesHistoryTab } from '../Provider/Profile/ProviderRidesHistoryTab';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type TabType = 'profile' | 'bank' | 'fees' | 'rides';

interface StripeAccountStatus {
  has_account: boolean;
  account_id?: string;
  onboarding_completed: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  stripe_status?: 'not_configured' | 'pending' | 'verified' | 'restricted';
}

export function ProviderProfile() {
  const { user, profile, providerData } = useApp();
  const { signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Stripe Connect state
  const [stripeStatus, setStripeStatus] = useState<StripeAccountStatus | null>(null);
  const [loadingStripe, setLoadingStripe] = useState(true);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  
  // Check if registration is complete
  const isRegistrationComplete = providerData?.registration_complete === true;
  
  // Financial data hook
  const { data: financialData, loading: loadingFinancial, refetch: refetchFinancial } = useProviderFinancialData();

  // Handle tab from URL params (e.g., /profile?tab=bank)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'bank' || tabParam === 'profile' || tabParam === 'rides' || tabParam === 'fees') {
      setActiveTab(tabParam as TabType);
    }
  }, [searchParams]);

  // Check for Stripe return
  useEffect(() => {
    const stripeParam = searchParams.get('stripe');
    if (stripeParam === 'success') {
      toast.success('Conta Stripe configurada! Verificando status...');
      setActiveTab('bank'); // Navigate to bank tab on success
      checkStripeStatus();
    } else if (stripeParam === 'refresh') {
      toast.info('Complete o cadastro Stripe para receber pagamentos');
      setActiveTab('bank'); // Navigate to bank tab on refresh
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
    if (!isRegistrationComplete) {
      toast.error('Finalize seu cadastro como prestador antes de ativar os recebimentos.');
      setShowRegistrationForm(true);
      return;
    }

    setConnectingStripe(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-connect-account');
      
      if (error) {
        toast.error('Não foi possível iniciar a configuração da Stripe. Tente novamente.');
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error('Erro ao obter link de cadastro. Tente novamente.');
      }
    } catch (err) {
      toast.error('Erro ao conectar com Stripe. Verifique sua conexão.');
    } finally {
      setConnectingStripe(false);
    }
  };

  const handleRegistrationComplete = useCallback(() => {
    setShowRegistrationForm(false);
    window.location.reload();
  }, []);

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
      toast.error('Erro ao excluir conta. Tente novamente.');
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  // Show registration form if not complete
  if (showRegistrationForm || !isRegistrationComplete) {
    return (
      <ProviderRegistrationForm
        userId={profile?.user_id || ''}
        currentName={user?.name || ''}
        currentPhone={user?.phone || ''}
        currentAvatar={profile?.avatar_url || null}
        currentVehiclePlate={providerData?.vehicle_plate || null}
        onComplete={handleRegistrationComplete}
      />
    );
  }

  const tabLabels: Record<TabType, { icon: React.ReactNode; label: string }> = {
    profile: { icon: <User className="w-5 h-5" />, label: 'Perfil' },
    bank: { icon: <Landmark className="w-5 h-5" />, label: 'Informações Bancárias' },
    fees: { icon: <Receipt className="w-5 h-5" />, label: 'Taxas do App' },
    rides: { icon: <FileText className="w-5 h-5" />, label: 'Histórico de Corridas' },
  };

  return (
    <div className="min-h-screen bg-background provider-theme">
      {/* Header */}
      <div className="bg-card border-b border-border p-4 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0">
              <SheetHeader className="p-6 border-b border-border">
                <div className="flex items-center gap-4">
                  <img 
                    src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name}`}
                    alt={user?.name}
                    className="w-14 h-14 rounded-full border-2 border-provider-primary"
                  />
                  <div>
                    <SheetTitle className="text-left">{user?.name}</SheetTitle>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Star className="w-4 h-4 text-status-searching fill-current" />
                      <span>{providerData?.rating?.toFixed(1) || '5.0'}</span>
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <nav className="p-4 space-y-2">
                {(Object.keys(tabLabels) as TabType[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => handleTabChange(tab)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl transition-colors ${
                      activeTab === tab
                        ? 'bg-provider-primary text-white'
                        : 'hover:bg-secondary'
                    }`}
                  >
                    {tabLabels[tab].icon}
                    <span className="font-medium">{tabLabels[tab].label}</span>
                  </button>
                ))}

                {isAdmin && (
                  <button
                    onClick={() => {
                      setSidebarOpen(false);
                      navigate('/admin');
                    }}
                    className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-secondary transition-colors text-primary"
                  >
                    <Settings className="w-5 h-5" />
                    <span className="font-medium">Administração</span>
                  </button>
                )}

                <div className="border-t border-border my-4 pt-4">
                  <button
                    onClick={() => navigate('/privacy')}
                    className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-secondary transition-colors"
                  >
                    <Shield className="w-5 h-5" />
                    <span>Política de Privacidade</span>
                  </button>
                  <button
                    onClick={() => navigate('/terms')}
                    className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-secondary transition-colors"
                  >
                    <Scale className="w-5 h-5" />
                    <span>Termos de Uso</span>
                  </button>
                </div>

                <div className="border-t border-border pt-4">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-secondary transition-colors text-muted-foreground"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Sair da conta</span>
                  </button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-destructive/10 transition-colors text-destructive">
                        <Trash2 className="w-5 h-5" />
                        <span>Excluir conta</span>
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-destructive" />
                          Excluir conta
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação é irreversível. Todos os seus dados serão permanentemente excluídos.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleDeleteAccount}
                          disabled={deletingAccount}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deletingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sim, excluir'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
          
          <h1 className="text-xl font-bold">{tabLabels[activeTab].label}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="pb-20">
        {activeTab === 'profile' && (
          <ProviderProfileTab 
            rating={financialData?.providerInfo?.rating || providerData?.rating || 5.0}
            totalServices={financialData?.providerInfo?.totalServices || providerData?.total_services || 0}
          />
        )}
        
        {activeTab === 'bank' && (
          <>
            {loadingStripe ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : !stripeStatus?.has_account ? (
              <div className="p-4">
                <div className="bg-card rounded-2xl p-6 text-center">
                  <Landmark className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-semibold text-lg mb-2">Configure seus recebimentos</h3>
                  <p className="text-muted-foreground mb-4">
                    Conecte sua conta Stripe para receber pagamentos automaticamente após cada serviço.
                  </p>
                  <Button 
                    onClick={handleStripeOnboarding}
                    disabled={connectingStripe}
                    className="w-full"
                    variant="provider"
                  >
                    {connectingStripe ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Configurar recebimentos
                  </Button>
                </div>
              </div>
            ) : (
              <ProviderBankTab
                balance={financialData?.balance || { available: 0, pending: 0, paid: 0 }}
                earnings={financialData?.earnings || { today: 0, week: 0, month: 0, total: 0, todayRides: 0, weekRides: 0, monthRides: 0, totalRides: 0 }}
                payouts={financialData?.payouts || []}
                stripeStatus={financialData?.stripeStatus || {
                  connected: stripeStatus.charges_enabled && stripeStatus.payouts_enabled,
                  chargesEnabled: stripeStatus.charges_enabled,
                  payoutsEnabled: stripeStatus.payouts_enabled,
                  status: stripeStatus.stripe_status || 'pending',
                }}
                loading={loadingFinancial}
                onRefresh={() => {
                  refetchFinancial();
                  checkStripeStatus();
                }}
              />
            )}
          </>
        )}
        
        {activeTab === 'fees' && <ProviderFeesTab />}
        
        {activeTab === 'rides' && <ProviderRidesHistoryTab />}
      </div>
    </div>
  );
}