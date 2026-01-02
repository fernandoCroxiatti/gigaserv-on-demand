/**
 * Admin Promotions Settings Component
 * 
 * Manages:
 * 1. Provider Fee Promotion - Campaign-based with fixed dates
 * 2. First-Use Coupon - Discount on first completed service
 * 
 * ALL FEATURES ARE DISABLED BY DEFAULT
 * This component is ONLY accessible in Admin panel
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Gift, Percent, AlertCircle, CheckCircle2, Calendar, User } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import {
  ProviderFeePromotionConfig,
  FirstUseCouponConfig,
  DEFAULT_PROVIDER_FEE_PROMOTION,
  DEFAULT_FIRST_USE_COUPON,
  isPromotionActive,
} from '@/domain/promotions/types';
import {
  validateFeePromotionConfig,
  validateCouponConfig,
} from '@/domain/promotions/validation';
import {
  fetchFeePromotionConfig,
  saveFeePromotionConfig,
  fetchCouponConfig,
  saveCouponConfig,
} from '@/services/promotions/promotionsService';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface ProviderOption {
  id: string;
  name: string;
}

export default function PromotionsSettings() {
  const { user } = useAuth();
  
  // Loading states
  const [loadingFeePromo, setLoadingFeePromo] = useState(true);
  const [loadingCoupon, setLoadingCoupon] = useState(true);
  const [savingFeePromo, setSavingFeePromo] = useState(false);
  const [savingCoupon, setSavingCoupon] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(false);

  // Fee promotion state
  const [feePromoConfig, setFeePromoConfig] = useState<ProviderFeePromotionConfig>(
    DEFAULT_PROVIDER_FEE_PROMOTION
  );

  // Coupon state
  const [couponConfig, setCouponConfig] = useState<FirstUseCouponConfig>(
    DEFAULT_FIRST_USE_COUPON
  );

  // Providers list for specific selection
  const [providers, setProviders] = useState<ProviderOption[]>([]);

  // Load configurations on mount
  useEffect(() => {
    loadConfigurations();
    loadProviders();
  }, []);

  const loadConfigurations = async () => {
    setLoadingFeePromo(true);
    setLoadingCoupon(true);

    try {
      const [feePromo, coupon] = await Promise.all([
        fetchFeePromotionConfig(),
        fetchCouponConfig(),
      ]);

      setFeePromoConfig(feePromo);
      setCouponConfig(coupon);
    } catch (error) {
      console.error('[PromotionsSettings] Error loading:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoadingFeePromo(false);
      setLoadingCoupon(false);
    }
  };

  const loadProviders = async () => {
    setLoadingProviders(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name')
        .eq('perfil_principal', 'provider')
        .order('name');

      if (error) throw error;

      setProviders(
        (data || []).map((p) => ({
          id: p.user_id,
          name: p.name,
        }))
      );
    } catch (error) {
      console.error('[PromotionsSettings] Error loading providers:', error);
    } finally {
      setLoadingProviders(false);
    }
  };

  // Save fee promotion config with notification
  const handleSaveFeePromo = async () => {
    if (!user?.id) return;

    const validation = validateFeePromotionConfig(feePromoConfig);
    if (!validation.valid) {
      toast.error(validation.errors[0]);
      return;
    }

    setSavingFeePromo(true);
    try {
      const success = await saveFeePromotionConfig(feePromoConfig, user.id);
      if (success) {
        // Create notification for affected providers
        if (feePromoConfig.enabled) {
          await createPromotionNotification(feePromoConfig);
        }
        toast.success('Promoção de taxa salva com sucesso');
      } else {
        toast.error('Erro ao salvar promoção de taxa');
      }
    } catch (error) {
      console.error('[PromotionsSettings] Error saving fee promo:', error);
      toast.error('Erro ao salvar');
    } finally {
      setSavingFeePromo(false);
    }
  };

  // Create notification for promotion
  const createPromotionNotification = async (config: ProviderFeePromotionConfig) => {
    try {
      const startDate = config.start_date ? format(new Date(config.start_date), 'dd/MM/yyyy', { locale: ptBR }) : '';
      const endDate = config.end_date ? format(new Date(config.end_date), 'dd/MM/yyyy', { locale: ptBR }) : '';
      
      const taxaTexto = config.promotional_commission === 0 
        ? 'isenção total de taxa'
        : `taxa promocional de ${config.promotional_commission}%`;

      const titulo = '🎉 Promoção de Taxa Ativa!';
      const texto = `Você está participando de uma promoção especial com ${taxaTexto}. Válida de ${startDate} até ${endDate}. Aproveite!`;

      // Determine audience
      const publico = config.scope === 'global' ? 'prestadores' : 'prestadores';

      // Create internal notification
      const { error } = await supabase
        .from('internal_notifications')
        .insert({
          titulo,
          texto,
          publico,
          destaque: true,
          publicada: true,
          publicada_em: new Date().toISOString(),
          criada_por: user?.id,
          expira_em: config.end_date, // Expires when promotion ends
          imagem_url: 'promocao', // Image concept for promo
        });

      if (error) {
        console.error('[PromotionsSettings] Error creating notification:', error);
      } else {
        console.log('[PromotionsSettings] Notification created for promotion');
      }
    } catch (err) {
      console.error('[PromotionsSettings] Error in createPromotionNotification:', err);
    }
  };

  // Save coupon config
  const handleSaveCoupon = async () => {
    if (!user?.id) return;

    const validation = validateCouponConfig(couponConfig);
    if (!validation.valid) {
      toast.error(validation.errors[0]);
      return;
    }

    setSavingCoupon(true);
    try {
      const success = await saveCouponConfig(couponConfig, user.id);
      if (success) {
        toast.success('Cupom de primeiro uso salvo com sucesso');
      } else {
        toast.error('Erro ao salvar cupom');
      }
    } catch (error) {
      console.error('[PromotionsSettings] Error saving coupon:', error);
      toast.error('Erro ao salvar');
    } finally {
      setSavingCoupon(false);
    }
  };

  // Format date for input
  const formatDateForInput = (dateStr: string | null): string => {
    if (!dateStr) return '';
    try {
      return dateStr.slice(0, 10);
    } catch {
      return '';
    }
  };

  // Get status text for promotion
  const getPromotionStatus = (): { text: string; active: boolean } => {
    if (!feePromoConfig.enabled) {
      return { text: 'Promoção DESATIVADA', active: false };
    }
    if (isPromotionActive(feePromoConfig)) {
      const endDate = feePromoConfig.end_date 
        ? format(new Date(feePromoConfig.end_date), 'dd/MM/yyyy', { locale: ptBR })
        : '';
      return { 
        text: `Promoção ATIVA até ${endDate}`, 
        active: true 
      };
    }
    if (feePromoConfig.start_date && new Date(feePromoConfig.start_date) > new Date()) {
      const startDate = format(new Date(feePromoConfig.start_date), 'dd/MM/yyyy', { locale: ptBR });
      return { 
        text: `Promoção agendada para ${startDate}`, 
        active: false 
      };
    }
    return { text: 'Promoção EXPIRADA', active: false };
  };

  const promotionStatus = getPromotionStatus();

  return (
    <div className="space-y-6">
      {/* Provider Fee Promotion */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-primary" />
            <CardTitle>Promoção de Taxa do Prestador</CardTitle>
          </div>
          <CardDescription>
            Configure promoção de taxa por campanha com data fixa.
            Quando ativa, substitui temporariamente as taxas individuais.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loadingFeePromo ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Status Alert */}
              <Alert variant={promotionStatus.active ? 'default' : 'destructive'}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {promotionStatus.text}
                </AlertDescription>
              </Alert>

              {/* Enable Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="fee-promo-enabled">Ativar promoção de taxa</Label>
                  <p className="text-sm text-muted-foreground">
                    Quando ativo, aplica taxa promocional no período definido
                  </p>
                </div>
                <Switch
                  id="fee-promo-enabled"
                  checked={feePromoConfig.enabled}
                  onCheckedChange={(enabled) =>
                    setFeePromoConfig({ ...feePromoConfig, enabled })
                  }
                />
              </div>

              {/* Promotional Commission */}
              <div className="space-y-2">
                <Label htmlFor="promo-commission">Comissão promocional (%)</Label>
                <Input
                  id="promo-commission"
                  type="number"
                  min="0"
                  max="100"
                  value={feePromoConfig.promotional_commission}
                  onChange={(e) =>
                    setFeePromoConfig({
                      ...feePromoConfig,
                      promotional_commission: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
                />
                <p className="text-sm text-muted-foreground">
                  0% = isenção total durante o período promocional
                </p>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date" className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Data de início
                  </Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={formatDateForInput(feePromoConfig.start_date)}
                    onChange={(e) =>
                      setFeePromoConfig({
                        ...feePromoConfig,
                        start_date: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date" className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Data de término
                  </Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={formatDateForInput(feePromoConfig.end_date)}
                    onChange={(e) =>
                      setFeePromoConfig({
                        ...feePromoConfig,
                        end_date: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                  />
                </div>
              </div>

              {/* Scope */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  Escopo da promoção
                </Label>
                <Select
                  value={feePromoConfig.scope}
                  onValueChange={(value: 'global' | 'specific_provider') =>
                    setFeePromoConfig({ 
                      ...feePromoConfig, 
                      scope: value,
                      specific_provider_id: value === 'global' ? null : feePromoConfig.specific_provider_id,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">
                      Todos os prestadores
                    </SelectItem>
                    <SelectItem value="specific_provider">
                      Prestador específico
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Specific Provider Selector */}
              {feePromoConfig.scope === 'specific_provider' && (
                <div className="space-y-2">
                  <Label>Selecionar prestador</Label>
                  {loadingProviders ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando prestadores...
                    </div>
                  ) : (
                    <Select
                      value={feePromoConfig.specific_provider_id || ''}
                      onValueChange={(value) => {
                        const provider = providers.find((p) => p.id === value);
                        setFeePromoConfig({
                          ...feePromoConfig,
                          specific_provider_id: value,
                          specific_provider_name: provider?.name || null,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um prestador" />
                      </SelectTrigger>
                      <SelectContent>
                        {providers.map((provider) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            {provider.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Info about priority */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Prioridade de taxa:</strong>
                  <ol className="mt-2 list-decimal pl-4 space-y-1">
                    <li>Promoção ativa (campanha com data vigente)</li>
                    <li>Taxa individual do prestador</li>
                    <li>Taxa global do app</li>
                  </ol>
                </AlertDescription>
              </Alert>

              {/* Save Button */}
              <Button
                onClick={handleSaveFeePromo}
                disabled={savingFeePromo}
                className="w-full"
              >
                {savingFeePromo ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Salvar Promoção de Taxa
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* First-Use Coupon */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            <CardTitle>Cupom Automático de Primeiro Uso</CardTitle>
          </div>
          <CardDescription>
            Configure desconto automático no primeiro serviço concluído do cliente.
            O desconto afeta apenas o valor pago pelo cliente, não o valor do prestador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loadingCoupon ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Status Alert */}
              <Alert variant={couponConfig.enabled ? 'default' : 'destructive'}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {couponConfig.enabled
                    ? `Cupom ATIVO - R$ ${couponConfig.discount_value.toFixed(2)} de desconto no primeiro serviço`
                    : 'Cupom DESATIVADO - Nenhum desconto automático aplicado'}
                </AlertDescription>
              </Alert>

              {/* Enable Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="coupon-enabled">Ativar cupom de primeiro uso</Label>
                  <p className="text-sm text-muted-foreground">
                    Quando ativo, aplica desconto automaticamente no primeiro serviço
                  </p>
                </div>
                <Switch
                  id="coupon-enabled"
                  checked={couponConfig.enabled}
                  onCheckedChange={(enabled) =>
                    setCouponConfig({ ...couponConfig, enabled })
                  }
                />
              </div>

              {/* Discount Value */}
              <div className="space-y-2">
                <Label htmlFor="discount-value">Valor do desconto (R$)</Label>
                <Input
                  id="discount-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={couponConfig.discount_value}
                  onChange={(e) =>
                    setCouponConfig({
                      ...couponConfig,
                      discount_value: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0.00"
                />
              </div>

              {/* Minimum Value */}
              <div className="space-y-2">
                <Label htmlFor="min-value">Valor mínimo do serviço (R$)</Label>
                <Input
                  id="min-value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={couponConfig.minimum_service_value}
                  onChange={(e) =>
                    setCouponConfig({
                      ...couponConfig,
                      minimum_service_value: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="0.00"
                />
                <p className="text-sm text-muted-foreground">
                  O cupom só será aplicado se o serviço atingir este valor mínimo
                </p>
              </div>

              {/* Info Box */}
              <Alert>
                <Gift className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Regras do cupom:</strong>
                  <ul className="mt-2 list-disc pl-4 space-y-1">
                    <li>Aplicado apenas no primeiro serviço <strong>concluído</strong></li>
                    <li>Cancelamentos não consomem o cupom</li>
                    <li>O desconto afeta apenas o valor pago pelo cliente</li>
                    <li>O prestador recebe o valor integral do serviço</li>
                  </ul>
                </AlertDescription>
              </Alert>

              {/* Save Button */}
              <Button
                onClick={handleSaveCoupon}
                disabled={savingCoupon}
                className="w-full"
              >
                {savingCoupon ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Salvar Cupom de Primeiro Uso
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}