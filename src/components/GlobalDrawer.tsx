import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/hooks/useAuth';
import { Menu, User, Landmark, FileText, Shield, Scale, LogOut, Trash2, Star, AlertTriangle, Loader2, CreditCard } from 'lucide-react';
import { Button } from './ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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

export function GlobalDrawer() {
  const { user, providerData } = useApp();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const isProvider = user?.activeProfile === 'provider';

  const handleSignOut = async () => {
    await signOut();
    setOpen(false);
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

  const handleNavigate = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={`glass-card w-10 h-10 sm:w-11 sm:h-11 ${isProvider ? 'provider-theme' : ''}`}
        >
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className={`w-80 p-0 ${isProvider ? 'provider-theme' : ''}`}>
        <SheetHeader className="p-6 border-b border-border">
          <div className="flex items-center gap-4">
            <img 
              src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name}`}
              alt={user?.name}
              className={`w-14 h-14 rounded-full border-2 ${isProvider ? 'border-provider-primary' : 'border-primary'}`}
            />
            <div>
              <SheetTitle className="text-left">{user?.name || 'Usuário'}</SheetTitle>
              {isProvider && providerData && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Star className="w-4 h-4 text-status-searching fill-current" />
                  <span>{providerData?.rating?.toFixed(1) || '5.0'}</span>
                </div>
              )}
            </div>
          </div>
        </SheetHeader>

        <nav className="p-4 space-y-2">
          {/* Profile & Bank info only for providers */}
          {isProvider && (
            <>
              <button
                onClick={() => handleNavigate('/profile')}
                className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-secondary transition-colors"
              >
                <User className="w-5 h-5" />
                <span className="font-medium">Perfil</span>
              </button>
              <button
                onClick={() => handleNavigate('/profile?tab=bank')}
                className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-secondary transition-colors"
              >
                <Landmark className="w-5 h-5" />
                <span className="font-medium">Informações Bancárias</span>
              </button>
              <button
                onClick={() => handleNavigate('/profile?tab=rides')}
                className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-secondary transition-colors"
              >
                <FileText className="w-5 h-5" />
                <span className="font-medium">Histórico de Corridas</span>
              </button>
            </>
          )}

        {/* Client menu items */}
        {!isProvider && (
          <>
            <button
              onClick={() => handleNavigate('/profile')}
              className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-secondary transition-colors"
            >
              <User className="w-5 h-5" />
              <span className="font-medium">Perfil</span>
            </button>
            <button
              onClick={() => handleNavigate('/profile?tab=rides')}
              className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-secondary transition-colors"
            >
              <FileText className="w-5 h-5" />
              <span className="font-medium">Corridas</span>
            </button>
            <button
              onClick={() => handleNavigate('/profile?tab=payments')}
              className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-secondary transition-colors"
            >
              <CreditCard className="w-5 h-5" />
              <span className="font-medium">Pagamentos</span>
            </button>
          </>
        )}

          <div className="border-t border-border my-4 pt-4">
            <button
              onClick={() => handleNavigate('/privacy')}
              className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-secondary transition-colors"
            >
              <Shield className="w-5 h-5" />
              <span>Política de Privacidade</span>
            </button>
            <button
              onClick={() => handleNavigate('/terms')}
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
  );
}
