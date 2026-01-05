import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useWakeLock } from '@/hooks/useWakeLock';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  User, 
  Bell, 
  Shield, 
  Scale, 
  Trash2, 
  ChevronRight,
  LogOut,
  Loader2,
  AlertTriangle,
  Smartphone,
  MapPin,
  MessageSquare,
  BellOff,
  Sun,
  Monitor
} from 'lucide-react';
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

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useApp();
  const { signOut } = useAuth();
  const { 
    permission, 
    preferences, 
    updatePreferences,
    requestPermission
  } = useNotifications();
  const { isSupported: wakeLockSupported, isEnabled: wakeLockEnabled, setEnabled: setWakeLockEnabled } = useWakeLock();
  const [deletingAccount, setDeletingAccount] = useState(false);
  
  // Notification preferences from hook
  const [notifChamados, setNotifChamados] = useState(true);
  const [notifPromocoes, setNotifPromocoes] = useState(true);
  const [notifEnabled, setNotifEnabled] = useState(true);

  // Sync with saved preferences
  useEffect(() => {
    if (preferences) {
      setNotifChamados(preferences.chamado_updates);
      setNotifPromocoes(preferences.promotional);
      setNotifEnabled(preferences.enabled);
    }
  }, [preferences]);

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

  const handleSignOut = async () => {
    navigate('/auth');
    await signOut();
  };

  const handleNotifChamadosChange = async (value: boolean) => {
    setNotifChamados(value);
    await updatePreferences({ chamado_updates: value });
  };

  const handleNotifPromocoesChange = async (value: boolean) => {
    setNotifPromocoes(value);
    await updatePreferences({ promotional: value });
  };

  const handleNotifEnabledChange = async (value: boolean) => {
    if (value && permission === 'default') {
      // Request permission first
      const granted = await requestPermission();
      if (!granted) {
        toast.error('Permissão de notificações negada');
        return;
      }
    }
    setNotifEnabled(value);
    await updatePreferences({ enabled: value });
  };

  const isProvider = user?.activeProfile === 'provider';
  const notificationsBlocked = permission === 'denied';

  return (
    <div className={`min-h-screen bg-background ${isProvider ? 'provider-theme' : ''}`}>
      {/* Header */}
      <div className="bg-card border-b border-border p-4 sticky top-0 z-10">
        <div className="flex items-center gap-4 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Configurações</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        
        {/* Account Section */}
        <div className="bg-card rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Minha Conta
            </h2>
          </div>
          <div className="divide-y divide-border">
            <button 
              onClick={() => navigate('/profile')}
              className="flex items-center gap-4 p-4 w-full hover:bg-secondary/50 transition-colors"
            >
              <div className="flex-1 text-left">
                <p className="font-medium">Informações pessoais</p>
                <p className="text-sm text-muted-foreground">Nome, telefone e e-mail</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
            
            {isProvider && (
              <button 
                onClick={() => navigate('/profile')}
                className="flex items-center gap-4 p-4 w-full hover:bg-secondary/50 transition-colors"
              >
                <div className="flex-1 text-left">
                  <p className="font-medium">Dados bancários</p>
                  <p className="text-sm text-muted-foreground">Conta Stripe para recebimentos</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
            
            {!isProvider && (
              <button 
                onClick={() => navigate('/profile')}
                className="flex items-center gap-4 p-4 w-full hover:bg-secondary/50 transition-colors"
              >
                <div className="flex-1 text-left">
                  <p className="font-medium">Formas de pagamento</p>
                  <p className="text-sm text-muted-foreground">Cartões salvos e PIX</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Notifications Section */}
        <div className="bg-card rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              {notificationsBlocked ? <BellOff className="w-5 h-5 text-destructive" /> : <Bell className="w-5 h-5 text-primary" />}
              Notificações
            </h2>
            {notificationsBlocked && (
              <p className="text-xs text-destructive mt-1">
                Notificações bloqueadas. Ative nas configurações do dispositivo.
              </p>
            )}
          </div>
          <div className="divide-y divide-border">
            <div className="flex items-center gap-4 p-4">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-medium">Ativar notificações</p>
                <p className="text-sm text-muted-foreground">
                  Receba alertas importantes
                </p>
              </div>
              <Switch 
                checked={notifEnabled && !notificationsBlocked} 
                onCheckedChange={handleNotifEnabledChange}
                disabled={notificationsBlocked}
              />
            </div>
            
            <div className="flex items-center gap-4 p-4">
              <Smartphone className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-medium">Chamados e status</p>
                <p className="text-sm text-muted-foreground">
                  Atualizações sobre seus {isProvider ? 'atendimentos' : 'chamados'}
                </p>
              </div>
              <Switch 
                checked={notifChamados} 
                onCheckedChange={handleNotifChamadosChange}
                disabled={!notifEnabled || notificationsBlocked}
              />
            </div>
            
            <div className="flex items-center gap-4 p-4">
              <MapPin className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-medium">Promoções e novidades</p>
                <p className="text-sm text-muted-foreground">
                  Ofertas e atualizações do app
                </p>
              </div>
              <Switch 
                checked={notifPromocoes} 
                onCheckedChange={handleNotifPromocoesChange}
                disabled={!notifEnabled || notificationsBlocked}
              />
            </div>
          </div>
        </div>

        {/* Display Section */}
        <div className="bg-card rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Monitor className="w-5 h-5 text-primary" />
              Tela
            </h2>
          </div>
          <div className="divide-y divide-border">
            <div className="flex items-center gap-4 p-4">
              <Sun className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-medium">Manter tela ligada</p>
                <p className="text-sm text-muted-foreground">
                  Impede que a tela desligue enquanto usa o app
                </p>
                {!wakeLockSupported && (
                  <p className="text-xs text-amber-500 mt-1">
                    Não suportado neste navegador
                  </p>
                )}
              </div>
              <Switch 
                checked={wakeLockEnabled} 
                onCheckedChange={setWakeLockEnabled}
                disabled={!wakeLockSupported}
              />
            </div>
          </div>
        </div>

        {/* Legal Section */}
        <div className="bg-card rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Scale className="w-5 h-5 text-primary" />
              Legal e Privacidade
            </h2>
          </div>
          <div className="divide-y divide-border">
            <button 
              onClick={() => navigate('/privacy')}
              className="flex items-center gap-4 p-4 w-full hover:bg-secondary/50 transition-colors"
            >
              <Shield className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1 text-left">
                <p className="font-medium">Política de Privacidade</p>
                <p className="text-sm text-muted-foreground">Como usamos seus dados</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
            
            <button 
              onClick={() => navigate('/terms')}
              className="flex items-center gap-4 p-4 w-full hover:bg-secondary/50 transition-colors"
            >
              <Scale className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1 text-left">
                <p className="font-medium">Termos de Uso</p>
                <p className="text-sm text-muted-foreground">Regras de utilização</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-card rounded-2xl overflow-hidden border border-destructive/20">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-lg flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Zona de Perigo
            </h2>
          </div>
          <div className="divide-y divide-border">
            <button 
              onClick={handleSignOut}
              className="flex items-center gap-4 p-4 w-full hover:bg-secondary/50 transition-colors"
            >
              <LogOut className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1 text-left">
                <p className="font-medium">Sair da conta</p>
                <p className="text-sm text-muted-foreground">Desconectar deste dispositivo</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button 
                  className="flex items-center gap-4 p-4 w-full hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-5 h-5 text-destructive" />
                  <div className="flex-1 text-left">
                    <p className="font-medium text-destructive">Excluir minha conta</p>
                    <p className="text-sm text-muted-foreground">Remover permanentemente todos os dados</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-destructive" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    Excluir conta
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação é irreversível. Todos os seus dados, histórico de {isProvider ? 'corridas' : 'chamados'}, 
                    {isProvider ? ' ganhos' : ''} e informações de pagamento serão permanentemente excluídos.
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
          </div>
        </div>

        {/* App version */}
        <div className="text-center text-sm text-muted-foreground py-4">
          <p>GIGA S.O.S v1.0.0</p>
          <p className="text-xs mt-1">© 2024 Todos os direitos reservados</p>
        </div>
      </div>
    </div>
  );
}
