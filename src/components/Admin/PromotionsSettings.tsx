/**
 * Admin Promotions Settings Component
 * 
 * Manages:
 * 1. Provider Fee Promotion - Temporary fee exemptions
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
import { Loader2, Gift, Percent, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  ProviderFeePromotionConfig,
  FirstUseCouponConfig,
  DEFAULT_PROVIDER_FEE_PROMOTION,
  DEFAULT_FIRST_USE_COUPON,
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

export default function PromotionsSettings() {
  const { user } = useAuth();
  
  // Loading states
  const [loadingFeePromo, setLoadingFeePromo] = useState(true);
  const [loadingCoupon, setLoadingCoupon] = useState(true);
  const [savingFeePromo, setSavingFeePromo] = useState(false);
  const [savingCoupon, setSavingCoupon] = useState(false);

  // Fee promotion state
  const [feePromoConfig, setFeePromoConfig] = useState<ProviderFeePromotionConfig>(
    DEFAULT_PROVIDER_FEE_PROMOTION
  );

  // Coupon state
  const [couponConfig, setCouponConfig] = useState<FirstUseCouponConfig>(
    DEFAULT_FIRST_USE_COUPON
  );

  // Load configurations on mount
  useEffect(() => {
    loadConfigurations();
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

  // Save fee promotion config
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
            Configure isenção temporária de taxa para prestadores.
            Esta configuração NÃO substitui a taxa global - apenas adiciona regras de isenção.
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
              <Alert variant={feePromoConfig.enabled ? 'default' : 'destructive'}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {feePromoConfig.enabled
                    ? 'Promoção ATIVA - Novos prestadores receberão isenção de taxa'
                    : 'Promoção DESATIVADA - Sistema usando apenas taxa global'}
                </AlertDescription>
              </Alert>

              {/* Enable Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="fee-promo-enabled">Ativar promoção de taxa</Label>
                  <p className="text-sm text-muted-foreground">
                    Quando ativo, aplica isenção de taxa conforme configuração
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

              {/* Duration */}
              <div className="space-y-2">
                <Label htmlFor="promo-duration">Duração da promoção (dias)</Label>
                <Input
                  id="promo-duration"
                  type="number"
                  min="1"
                  max="365"
                  value={feePromoConfig.default_duration_days}
                  onChange={(e) =>
                    setFeePromoConfig({
                      ...feePromoConfig,
                      default_duration_days: parseInt(e.target.value) || 30,
                    })
                  }
                  placeholder="30"
                />
              </div>

              {/* Apply To */}
              <div className="space-y-2">
                <Label>Aplicar promoção para</Label>
                <Select
                  value={feePromoConfig.apply_to}
                  onValueChange={(value: 'new_providers' | 'all_providers') =>
                    setFeePromoConfig({ ...feePromoConfig, apply_to: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new_providers">
                      Apenas novos prestadores
                    </SelectItem>
                    <SelectItem value="all_providers">
                      Todos os prestadores
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

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
