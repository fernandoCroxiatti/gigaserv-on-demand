import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { Button } from '../ui/button';
import { 
  User, 
  Car, 
  CreditCard, 
  LogOut,
  Star,
  Loader2,
  Shield,
  Scale,
  Trash2,
  AlertTriangle,
  Menu,
  Settings
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ClientProfileTab } from './Client/ClientProfileTab';
import { ClientRidesTab } from './Client/ClientRidesTab';
import { ClientPaymentsTab } from './Client/ClientPaymentsTab';
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

type TabType = 'profile' | 'rides' | 'payments';

export function ClientProfile() {
  const { user, profile } = useApp();
  const { signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [clientStats, setClientStats] = useState({ totalRides: 0, averageRating: undefined as number | undefined });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    loadClientStats();
  }, [user]);

  const loadClientStats = async () => {
    if (!profile?.user_id) return;

    try {
      // Get total rides
      const { count: ridesCount } = await supabase
        .from('chamados')
        .select('*', { count: 'exact', head: true })
        .eq('cliente_id', profile.user_id)
        .eq('status', 'finished');

      // Get average rating (reviews received as client)
      const { data: reviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('reviewed_id', profile.user_id)
        .eq('reviewer_type', 'provider');

      const avgRating = reviews && reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : undefined;

      setClientStats({
        totalRides: ridesCount || 0,
        averageRating: avgRating
      });
    } catch (err) {
      console.error('Error loading client stats:', err);
    } finally {
      setLoadingStats(false);
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

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  const tabLabels: Record<TabType, { icon: React.ReactNode; label: string }> = {
    profile: { icon: <User className="w-5 h-5" />, label: 'Perfil' },
    rides: { icon: <Car className="w-5 h-5" />, label: 'Corridas' },
    payments: { icon: <CreditCard className="w-5 h-5" />, label: 'Pagamentos' },
  };

  return (
    <div className="min-h-screen bg-background">
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
                    className="w-14 h-14 rounded-full border-2 border-primary"
                  />
                  <div>
                    <SheetTitle className="text-left">{user?.name}</SheetTitle>
                    {clientStats.averageRating && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Star className="w-4 h-4 text-status-searching fill-current" />
                        <span>{clientStats.averageRating.toFixed(1)}</span>
                      </div>
                    )}
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
                        ? 'bg-primary text-primary-foreground'
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
                    onClick={() => {
                      setSidebarOpen(false);
                      navigate('/privacy');
                    }}
                    className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-secondary transition-colors"
                  >
                    <Shield className="w-5 h-5" />
                    <span>Política de Privacidade</span>
                  </button>
                  <button
                    onClick={() => {
                      setSidebarOpen(false);
                      navigate('/terms');
                    }}
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
          <ClientProfileTab 
            totalRides={clientStats.totalRides}
            averageRating={clientStats.averageRating}
          />
        )}
        
        {activeTab === 'rides' && <ClientRidesTab />}
        
        {activeTab === 'payments' && <ClientPaymentsTab />}
      </div>
    </div>
  );
}
