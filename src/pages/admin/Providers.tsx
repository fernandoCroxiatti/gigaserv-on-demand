import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAdminProviders, useAppSettings } from '@/hooks/useAdminData';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, 
  UserCheck,
  Ban,
  CheckCircle,
  CreditCard,
  DollarSign,
  Star,
  Phone,
  Mail,
  Truck,
  Calendar,
  ChevronDown,
  Percent,
  Settings
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ChevronsUpDown, Check } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PAGE_SIZE = 20;

// Component for Provider Fee Configuration
function ProviderFeeConfig({ provider, onUpdate }: { provider: any; onUpdate: () => void }) {
  const { commissionPercentage } = useAppSettings();
  const [useCustomFee, setUseCustomFee] = useState<boolean>(provider.custom_fee_enabled || false);
  const [customPercentage, setCustomPercentage] = useState<string>(
    provider.custom_fee_percentage?.toString() || ''
  );
  const [customFixed, setCustomFixed] = useState<string>(
    provider.custom_fee_fixed?.toString() || ''
  );
  const [saving, setSaving] = useState(false);

  const isStripeConnected = provider.stripe_connected;
  const isDisabled = !isStripeConnected;

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('provider_data')
        .update({
          custom_fee_enabled: useCustomFee,
          custom_fee_percentage: useCustomFee && customPercentage ? parseFloat(customPercentage) : null,
          custom_fee_fixed: useCustomFee && customFixed ? parseFloat(customFixed) : null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', provider.user_id);

      if (error) throw error;

      toast.success('Configuração de taxa salva com sucesso');
      onUpdate();
    } catch (err) {
      console.error('Error saving fee config:', err);
      toast.error('Erro ao salvar configuração de taxa');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/30">
      <div className="flex items-center gap-2">
        <Percent className="w-4 h-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Configuração de Taxa</Label>
      </div>

      {!isStripeConnected && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          <p className="text-sm text-amber-600">
            Stripe não está conectado. Configure o Stripe para editar taxas.
          </p>
        </div>
      )}

      <RadioGroup 
        value={useCustomFee ? 'custom' : 'global'} 
        onValueChange={(value) => setUseCustomFee(value === 'custom')}
        disabled={isDisabled}
        className="space-y-2"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="global" id="global" disabled={isDisabled} />
          <Label htmlFor="global" className={isDisabled ? 'text-muted-foreground' : ''}>
            Usar taxa global do app ({commissionPercentage}%)
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="custom" id="custom" disabled={isDisabled} />
          <Label htmlFor="custom" className={isDisabled ? 'text-muted-foreground' : ''}>
            Usar taxa personalizada
          </Label>
        </div>
      </RadioGroup>

      {useCustomFee && (
        <div className="grid gap-4 md:grid-cols-2 pl-6">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Taxa percentual (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="Ex: 10"
              value={customPercentage}
              onChange={(e) => setCustomPercentage(e.target.value)}
              disabled={isDisabled}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Taxa fixa (R$)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Ex: 5.00"
              value={customFixed}
              onChange={(e) => setCustomFixed(e.target.value)}
              disabled={isDisabled}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={isDisabled || saving}
          size="sm"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Settings className="w-4 h-4 mr-1" />
              Salvar Taxa
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default function AdminProviders() {
  const { user } = useAuth();
  const { providers, loading, onlineNow, onlineToday, blockProvider, unblockProvider, togglePayout, refetch: fetchProviders } = useAdminProviders();
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [blockDialog, setBlockDialog] = useState<{ open: boolean; provider?: any }>({ open: false });
  const [blockReason, setBlockReason] = useState('');
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset visible count when search changes
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setVisibleCount(PAGE_SIZE);
  }, []);

  // Sort providers alphabetically and filter by search query
  const sortedAndFilteredProviders = useMemo(() => {
    const sorted = [...providers].sort((a, b) => {
      const nameA = (a.profile?.name || '').toLowerCase();
      const nameB = (b.profile?.name || '').toLowerCase();
      return nameA.localeCompare(nameB, 'pt-BR');
    });

    if (!searchQuery.trim()) return sorted;

    const query = searchQuery.toLowerCase().trim();
    return sorted.filter(provider => {
      const name = (provider.profile?.name || '').toLowerCase();
      const phone = (provider.profile?.phone || '').toLowerCase();
      const email = (provider.profile?.email || '').toLowerCase();
      return name.includes(query) || phone.includes(query) || email.includes(query);
    });
  }, [providers, searchQuery]);

  // Paginated results
  const paginatedProviders = useMemo(() => {
    return sortedAndFilteredProviders.slice(0, visibleCount);
  }, [sortedAndFilteredProviders, visibleCount]);

  const hasMore = visibleCount < sortedAndFilteredProviders.length;
  const remainingCount = sortedAndFilteredProviders.length - visibleCount;

  const selectedProvider = providers.find(p => p.user_id === selectedProviderId);

  const handleBlock = async () => {
    if (!blockDialog.provider || !user) return;
    
    const result = await blockProvider(blockDialog.provider.user_id, blockReason, user.id);
    if (result.success) {
      toast.success('Prestador bloqueado');
      setBlockDialog({ open: false });
      setBlockReason('');
    } else {
      toast.error('Erro ao bloquear prestador');
    }
  };

  const handleUnblock = async (userId: string) => {
    if (!user) return;
    
    const result = await unblockProvider(userId, user.id);
    if (result.success) {
      toast.success('Prestador desbloqueado');
    } else {
      toast.error('Erro ao desbloquear prestador');
    }
  };

  const handleTogglePayout = async (userId: string, currentEnabled: boolean) => {
    if (!user) return;
    
    const result = await togglePayout(userId, !currentEnabled, user.id);
    if (result.success) {
      toast.success(currentEnabled ? 'Repasse suspenso' : 'Repasse habilitado');
    } else {
      toast.error('Erro ao alterar status de repasse');
    }
  };

  const loadMore = useCallback(() => {
    setVisibleCount(prev => prev + PAGE_SIZE);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Gestão de Prestadores</h2>
        <p className="text-muted-foreground">Gerencie todos os prestadores cadastrados</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{providers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Online Agora</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-finished">
              {onlineNow}
            </div>
            <p className="text-xs text-muted-foreground">últimos 5 minutos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Online Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {onlineToday}
            </div>
            <p className="text-xs text-muted-foreground">desde 00:00</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Bloqueados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {providers.filter(p => p.is_blocked).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Stripe Conectado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {providers.filter(p => p.stripe_connected).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5" />
            Selecionar Prestador
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Popover open={open} onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (!isOpen) {
              setSearchQuery('');
              setVisibleCount(PAGE_SIZE);
            }
          }}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between"
              >
                {selectedProvider ? (
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    <span>{selectedProvider.profile?.name || 'Sem nome'}</span>
                    {selectedProvider.is_online ? (
                      <Badge className="bg-status-finished text-white ml-2 text-xs">Online</Badge>
                    ) : selectedProvider.is_blocked ? (
                      <Badge variant="destructive" className="ml-2 text-xs">Bloqueado</Badge>
                    ) : (
                      <Badge variant="secondary" className="ml-2 text-xs">Offline</Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">Selecione um prestador...</span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0 bg-background border border-border z-50" align="start">
              <Command shouldFilter={false}>
                <CommandInput 
                  placeholder="Buscar por nome, telefone..." 
                  value={searchQuery}
                  onValueChange={handleSearchChange}
                />
                <CommandList className="max-h-[300px]">
                  <CommandEmpty>Nenhum prestador encontrado.</CommandEmpty>
                  <CommandGroup>
                    {paginatedProviders.map((provider) => (
                      <CommandItem
                        key={provider.user_id}
                        value={provider.user_id}
                        onSelect={() => {
                          setSelectedProviderId(provider.user_id);
                          setOpen(false);
                          setSearchQuery('');
                          setVisibleCount(PAGE_SIZE);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedProviderId === provider.user_id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex items-center gap-2 flex-1">
                          <Truck className="w-4 h-4" />
                          <span>{provider.profile?.name || 'Sem nome'}</span>
                          {provider.profile?.phone && (
                            <span className="text-muted-foreground text-xs">({provider.profile.phone})</span>
                          )}
                          {provider.is_online ? (
                            <Badge className="bg-status-finished text-white ml-auto text-xs">Online</Badge>
                          ) : provider.is_blocked ? (
                            <Badge variant="destructive" className="ml-auto text-xs">Bloqueado</Badge>
                          ) : (
                            <Badge variant="secondary" className="ml-auto text-xs">Offline</Badge>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                    {hasMore && (
                      <CommandItem
                        onSelect={loadMore}
                        className="justify-center text-primary cursor-pointer"
                      >
                        <ChevronDown className="w-4 h-4 mr-2" />
                        Carregar mais ({remainingCount} restantes)
                      </CommandItem>
                    )}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Selected Provider Details */}
          {selectedProvider ? (
            <div className="border border-border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{selectedProvider.profile?.name || 'Sem nome'}</h3>
                <div className="flex items-center gap-2">
                  {selectedProvider.is_blocked ? (
                    <Badge variant="destructive">Bloqueado</Badge>
                  ) : selectedProvider.is_online ? (
                    <Badge className="bg-status-finished text-white">Online</Badge>
                  ) : (
                    <Badge variant="secondary">Offline</Badge>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedProvider.profile?.email || 'Não informado'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedProvider.profile?.phone || 'Não informado'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>Cadastro: {selectedProvider.created_at ? format(new Date(selectedProvider.created_at), "dd/MM/yyyy", { locale: ptBR }) : 'Não informado'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Star className="w-4 h-4 text-status-searching fill-status-searching" />
                    <span>{(selectedProvider.rating || 5).toFixed(1)} ({selectedProvider.total_services || 0} serviços)</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    <span>Stripe: {selectedProvider.stripe_connected ? 'Conectado' : 'Não conectado'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <span>Repasse: {selectedProvider.payout_enabled ? 'Ativo' : 'Suspenso'}</span>
                  </div>
                </div>
              </div>

              {/* Fee Configuration */}
              <ProviderFeeConfig 
                provider={selectedProvider} 
                onUpdate={fetchProviders}
              />

              {/* Services Offered */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Serviços oferecidos:</Label>
                <div className="flex flex-wrap gap-2">
                  {(selectedProvider.services_offered || []).map((s: string) => (
                    <Badge key={s} variant="outline" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>

              {selectedProvider.is_blocked && selectedProvider.block_reason && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <p className="text-sm text-destructive">
                    <strong>Motivo do bloqueio:</strong> {selectedProvider.block_reason}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                {selectedProvider.is_blocked ? (
                  <Button
                    variant="outline"
                    onClick={() => handleUnblock(selectedProvider.user_id)}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Desbloquear
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setBlockDialog({ open: true, provider: selectedProvider })}
                  >
                    <Ban className="w-4 h-4 mr-1" />
                    Bloquear
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => handleTogglePayout(selectedProvider.user_id, selectedProvider.payout_enabled)}
                >
                  <DollarSign className="w-4 h-4 mr-1" />
                  {selectedProvider.payout_enabled ? 'Suspender Repasse' : 'Habilitar Repasse'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Selecione um prestador para ver os detalhes
            </div>
          )}
        </CardContent>
      </Card>

      {/* Block Dialog */}
      <Dialog open={blockDialog.open} onOpenChange={(open) => setBlockDialog({ open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear Prestador</DialogTitle>
            <DialogDescription>
              Bloqueando: {blockDialog.provider?.profile?.name || 'Prestador'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Motivo do bloqueio</Label>
              <Textarea
                placeholder="Descreva o motivo do bloqueio..."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialog({ open: false })}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleBlock} disabled={!blockReason}>
              <Ban className="w-4 h-4 mr-1" />
              Bloquear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
