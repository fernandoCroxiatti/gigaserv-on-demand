import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { RealMapView } from '../Map/RealMapView';
import { Button } from '../ui/button';
import { Power, Radar, Star, MapPin, Settings2, Check, AlertCircle, ChevronDown, Ban } from 'lucide-react';
import { Slider } from '../ui/slider';
import { useGeolocation } from '@/hooks/useGeolocation';
import { SERVICE_CONFIG, ServiceType } from '@/types/chamado';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationPermissionModal } from '../Notifications/NotificationPermissionModal';
import { useAntiFraud } from '@/hooks/useAntiFraud';
import { FinancialAlertBanner } from './FinancialAlertBanner';
import { useAuth } from '@/hooks/useAuth';

const ALL_SERVICES: ServiceType[] = ['guincho', 'borracharia', 'mecanica', 'chaveiro'];

export function ProviderIdleView() {
  const { user, toggleProviderOnline, setProviderRadarRange, setProviderServices, updateProviderLocation, providerData } = useApp();
  const { user: authUser } = useAuth();
  const { location, error: geoError } = useGeolocation(true);
  const [showServiceConfig, setShowServiceConfig] = useState(false);
  const [stripeVerified, setStripeVerified] = useState(false);
  const [checkingStripe, setCheckingStripe] = useState(true);
  const navigate = useNavigate();
  
  const { checkDebtLimit, checkProviderCanAccept } = useAntiFraud();
  const [financialInfo, setFinancialInfo] = useState<{
    isBlocked: boolean;
    reason: string | null;
    pendingBalance: number;
    maxLimit: number;
  } | null>(null);
  
  const { 
    shouldAskPermission,
    requestPermission
  } = useNotifications();
  const [showNotifModal, setShowNotifModal] = useState(false);
  const hasAskedNotifRef = useRef(false);
  
  const isOnline = user?.providerData?.online || false;
  const radarRange = user?.providerData?.radarRange || 15;
  const currentServices = (providerData?.services_offered as ServiceType[]) || ['guincho'];
  const isRegistrationComplete = providerData?.registration_complete === true;

  useEffect(() => {
    const checkStripeStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('check-connect-status');
        if (!error && data) {
          const isVerified = data.stripe_status === 'verified' && 
                            data.charges_enabled === true && 
                            data.payouts_enabled === true;
          setStripeVerified(isVerified);
        }
      } catch (err) {
        console.error('Error checking Stripe status:', err);
      } finally {
        setCheckingStripe(false);
      }
    };
    checkStripeStatus();
  }, []);

  // Check financial status
  useEffect(() => {
    const checkFinancialStatus = async () => {
      if (!authUser?.id) return;
      
      const debtInfo = await checkDebtLimit(authUser.id);
      const canAcceptInfo = await checkProviderCanAccept(authUser.id);
      
      setFinancialInfo({
        isBlocked: !canAcceptInfo.canAccept,
        reason: canAcceptInfo.blockReason || null,
        pendingBalance: debtInfo.currentDebt,
        maxLimit: debtInfo.maxLimit,
      });
    };
    checkFinancialStatus();
  }, [authUser?.id, checkDebtLimit, checkProviderCanAccept]);

  const toggleService = (service: ServiceType) => {
    const newServices = currentServices.includes(service)
      ? currentServices.filter(s => s !== service)
      : [...currentServices, service];
    
    if (newServices.length > 0) {
      setProviderServices(newServices);
    }
  };

  const handleToggleOnline = async () => {
    if (!isOnline) {
      if (!isRegistrationComplete) {
        toast.error('Finalize seu cadastro para começar a atender.', {
          action: { label: 'Ir para cadastro', onClick: () => navigate('/profile') },
        });
        return;
      }

      if (!stripeVerified) {
        toast.error('Ative os recebimentos para começar a atender.', {
          action: { label: 'Configurar', onClick: () => navigate('/profile?tab=bank') },
        });
        return;
      }
      
      // Check if can accept
      if (authUser?.id) {
        const canAcceptInfo = await checkProviderCanAccept(authUser.id);
        if (!canAcceptInfo.canAccept) {
          toast.error('Você possui pendências que impedem de ficar online.', {
            action: { label: 'Ver taxas', onClick: () => navigate('/profile?tab=fees') },
            duration: 5000,
          });
          return;
        }
      }
      
      if (shouldAskPermission && !hasAskedNotifRef.current) {
        hasAskedNotifRef.current = true;
        setShowNotifModal(true);
      }
    }

    await toggleProviderOnline();
  };

  useEffect(() => {
    if (isOnline && location) {
      updateProviderLocation({ lat: location.lat, lng: location.lng, address: location.address });
    }
  }, [isOnline, location, updateProviderLocation]);

  return (
    <div className="relative h-full provider-theme">
      <RealMapView className="absolute inset-0" center={location || undefined} showSearchRadius={isOnline} searchRadius={radarRange} />

      {geoError && (
        <div className="absolute top-20 left-3 right-3 z-10">
          <div className="bg-destructive/10 rounded-xl px-4 py-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">{geoError}</p>
          </div>
        </div>
      )}

      <div className={`absolute ${geoError ? 'top-36' : 'top-20'} left-3 right-3 z-10 animate-slide-down`}>
        <div className={`bg-card rounded-xl px-4 py-3 shadow-sm ${isOnline ? 'ring-1 ring-provider-primary/20' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <img src={user?.avatar} alt={user?.name} className="w-11 h-11 rounded-full object-cover" />
              {isOnline && (
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-provider-primary rounded-full flex items-center justify-center ring-2 ring-card">
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{user?.name}</h3>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Star className="w-3 h-3 text-status-searching fill-current" />
                <span>{user?.providerData?.rating?.toFixed(1)}</span>
                <span className="text-border">•</span>
                <span>{user?.providerData?.totalServices} serviços</span>
              </div>
            </div>
            <span className={`status-badge ${isOnline ? 'bg-provider-primary/10 text-provider-primary' : 'bg-muted text-muted-foreground'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 animate-slide-up">
        <div className="bg-card rounded-t-2xl shadow-xl p-4 space-y-4">
          
          {!isOnline && (!isRegistrationComplete || !stripeVerified) && !checkingStripe && (
            <div className="flex items-start gap-3 p-3 bg-status-searching/10 rounded-xl">
              <AlertCircle className="w-4 h-4 text-status-searching flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-status-searching">
                  {!isRegistrationComplete ? 'Finalize seu cadastro' : 'Ative os recebimentos'}
                </p>
                <Button variant="link" className="p-0 h-auto text-xs text-provider-primary" onClick={() => navigate(!isRegistrationComplete ? '/profile' : '/profile?tab=bank')}>
                  {!isRegistrationComplete ? 'Completar cadastro' : 'Configurar recebimentos'}
                </Button>
              </div>
            </div>
          )}

          {/* Financial Alert Banner */}
          {financialInfo && (financialInfo.pendingBalance > 0 || financialInfo.isBlocked) && (
            <FinancialAlertBanner
              pendingBalance={financialInfo.pendingBalance}
              maxLimit={financialInfo.maxLimit}
              isBlocked={financialInfo.isBlocked}
              reason={financialInfo.reason}
            />
          )}

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isOnline ? 'bg-provider-primary/10' : 'bg-muted'}`}>
                <Power className={`w-5 h-5 ${isOnline ? 'text-provider-primary' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="font-semibold text-sm">{isOnline ? 'Você está online' : 'Você está offline'}</p>
                <p className="text-xs text-muted-foreground">{isOnline ? 'Recebendo chamados' : 'Ative para receber'}</p>
              </div>
            </div>
            <Button variant={isOnline ? 'provider' : 'outline'} onClick={handleToggleOnline} className="h-10 px-5 font-semibold" disabled={checkingStripe}>
              {isOnline ? 'Ficar offline' : 'Ficar online'}
            </Button>
          </div>

          {isOnline && (
            <div className="space-y-3 animate-fade-in pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radar className="w-4 h-4 text-provider-primary" />
                  <span className="text-sm text-muted-foreground">Raio de busca</span>
                </div>
                <span className="text-lg font-bold text-provider-primary">{radarRange} km</span>
              </div>
              <Slider value={[radarRange]} onValueChange={(value) => setProviderRadarRange(value[0])} max={100} min={5} step={5} className="provider-theme" />
            </div>
          )}

          {isOnline && (
            <div className="space-y-2 animate-fade-in">
              <button onClick={() => setShowServiceConfig(!showServiceConfig)} className="w-full flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-provider-primary" />
                  <span className="text-sm font-medium">Serviços oferecidos</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{currentServices.length} selecionado{currentServices.length > 1 ? 's' : ''}</span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showServiceConfig ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {showServiceConfig && (
                <div className="grid grid-cols-2 gap-2 animate-fade-in">
                  {ALL_SERVICES.map((service) => {
                    const config = SERVICE_CONFIG[service];
                    const isSelected = currentServices.includes(service);
                    return (
                      <button key={service} onClick={() => toggleService(service)} className={`flex items-center gap-2 p-2.5 rounded-xl transition-all ${isSelected ? 'bg-provider-primary/10 ring-1 ring-provider-primary/30' : 'bg-secondary/50 hover:bg-secondary'}`}>
                        <span className="text-lg">{config.icon}</span>
                        <span className={`text-xs font-medium flex-1 text-left ${isSelected ? 'text-provider-primary' : ''}`}>{config.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-provider-primary" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {!isOnline && isRegistrationComplete && stripeVerified && !financialInfo?.isBlocked && (
            <div className="bg-secondary/50 rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">💡 Fique online para receber chamados na sua região</p>
            </div>
          )}
        </div>
      </div>
      
      <NotificationPermissionModal open={showNotifModal} onConfirm={async () => { setShowNotifModal(false); await requestPermission(); }} onDecline={() => setShowNotifModal(false)} userType="provider" />
    </div>
  );
}
