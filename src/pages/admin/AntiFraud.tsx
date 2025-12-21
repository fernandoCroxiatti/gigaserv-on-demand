import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, 
  Search,
  Ban,
  CheckCircle,
  AlertTriangle,
  Shield,
  DollarSign,
  Smartphone,
  CreditCard,
  Phone,
  Mail,
  Car,
  FileText,
  XCircle,
  Eye
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProviderWithProfile {
  id: string;
  user_id: string;
  device_id: string | null;
  pending_fee_balance: number | null;
  max_debt_limit: number | null;
  is_blocked: boolean | null;
  block_reason: string | null;
  blocked_at: string | null;
  financial_blocked: boolean | null;
  financial_block_reason: string | null;
  fraud_flagged: boolean | null;
  fraud_reason: string | null;
  permanently_blocked: boolean | null;
  permanently_blocked_reason: string | null;
  permanently_blocked_at: string | null;
  pix_key: string | null;
  vehicle_plate: string | null;
  profile?: {
    name: string;
    email: string | null;
    phone: string | null;
    cpf: string | null;
  };
}

interface BlockedCredential {
  id: string;
  credential_type: string;
  credential_value: string;
  block_reason: string;
  blocked_at: string | null;
  original_user_id: string | null;
  notes: string | null;
}

interface FraudHistoryEntry {
  id: string;
  user_id: string;
  action: string;
  details: any;
  performed_by: string | null;
  created_at: string | null;
}

export default function AdminAntiFraud() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<ProviderWithProfile[]>([]);
  const [blockedCredentials, setBlockedCredentials] = useState<BlockedCredential[]>([]);
  const [fraudHistory, setFraudHistory] = useState<FraudHistoryEntry[]>([]);
  const [search, setSearch] = useState('');
  
  const [blockDialog, setBlockDialog] = useState<{ open: boolean; provider?: ProviderWithProfile }>({ open: false });
  const [blockReason, setBlockReason] = useState('');
  const [blockingType, setBlockingType] = useState<'fraud' | 'manual'>('manual');
  
  const [unblockConfirm, setUnblockConfirm] = useState<{ open: boolean; provider?: ProviderWithProfile }>({ open: false });
  const [unblockNotes, setUnblockNotes] = useState('');
  
  const [detailsDialog, setDetailsDialog] = useState<{ open: boolean; provider?: ProviderWithProfile }>({ open: false });

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch providers with financial data
      const { data: providerData, error: providerError } = await supabase
        .from('provider_data')
        .select('*')
        .order('pending_fee_balance', { ascending: false, nullsFirst: false });

      if (providerError) throw providerError;

      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name, email, phone, cpf')
        .eq('perfil_principal', 'provider');

      if (profilesError) throw profilesError;

      // Combine data
      const combined = providerData?.map(pd => ({
        ...pd,
        profile: profiles?.find(p => p.user_id === pd.user_id)
      })) || [];

      setProviders(combined);

      // Fetch blocked credentials
      const { data: credentials, error: credError } = await supabase
        .from('blocked_credentials')
        .select('*')
        .order('blocked_at', { ascending: false });

      if (!credError) {
        setBlockedCredentials(credentials || []);
      }

      // Fetch fraud history
      const { data: history, error: histError } = await supabase
        .from('fraud_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!histError) {
        setFraudHistory(history || []);
      }
    } catch (err) {
      console.error('Error fetching anti-fraud data:', err);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleBlockForFraud = async () => {
    if (!blockDialog.provider || !user || !blockReason) return;

    try {
      const { error } = await supabase.rpc('block_provider_for_fraud', {
        _provider_user_id: blockDialog.provider.user_id,
        _reason: blockReason,
        _admin_id: user.id
      });

      if (error) throw error;

      toast.success('Prestador bloqueado por fraude');
      setBlockDialog({ open: false });
      setBlockReason('');
      fetchData();
    } catch (err: any) {
      console.error('Error blocking provider:', err);
      toast.error(err.message || 'Erro ao bloquear prestador');
    }
  };

  const handleManualBlock = async () => {
    if (!blockDialog.provider || !user || !blockReason) return;

    try {
      const { error } = await supabase
        .from('provider_data')
        .update({
          is_blocked: true,
          block_reason: blockReason,
          blocked_at: new Date().toISOString(),
          blocked_by: user.id
        })
        .eq('user_id', blockDialog.provider.user_id);

      if (error) throw error;

      await supabase.from('admin_logs').insert({
        admin_id: user.id,
        action: 'manual_block_provider',
        target_type: 'provider',
        target_id: blockDialog.provider.user_id,
        details: { reason: blockReason }
      });

      toast.success('Prestador bloqueado');
      setBlockDialog({ open: false });
      setBlockReason('');
      fetchData();
    } catch (err: any) {
      console.error('Error blocking provider:', err);
      toast.error(err.message || 'Erro ao bloquear prestador');
    }
  };

  const handleUnblock = async () => {
    if (!unblockConfirm.provider || !user) return;

    try {
      const { error } = await supabase.rpc('unblock_provider', {
        _provider_user_id: unblockConfirm.provider.user_id,
        _admin_id: user.id,
        _notes: unblockNotes || null
      });

      if (error) throw error;

      toast.success('Prestador desbloqueado');
      setUnblockConfirm({ open: false });
      setUnblockNotes('');
      fetchData();
    } catch (err: any) {
      console.error('Error unblocking provider:', err);
      toast.error(err.message || 'Erro ao desbloquear prestador');
    }
  };

  const filteredProviders = providers.filter(p => 
    p.profile?.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.profile?.email?.toLowerCase().includes(search.toLowerCase()) ||
    p.profile?.phone?.includes(search) ||
    p.profile?.cpf?.includes(search) ||
    p.device_id?.includes(search)
  );

  // Stats
  const blockedCount = providers.filter(p => p.is_blocked || p.permanently_blocked || p.fraud_flagged).length;
  const financialBlockedCount = providers.filter(p => p.financial_blocked).length;
  const debtTotal = providers.reduce((acc, p) => acc + (p.pending_fee_balance || 0), 0);
  const fraudCount = providers.filter(p => p.fraud_flagged).length;

  const getProviderStatus = (p: ProviderWithProfile) => {
    if (p.permanently_blocked) return { label: 'Bloqueio Permanente', variant: 'destructive' as const, icon: Ban };
    if (p.fraud_flagged) return { label: 'Fraude', variant: 'destructive' as const, icon: AlertTriangle };
    if (p.financial_blocked) return { label: 'Bloqueio Financeiro', variant: 'destructive' as const, icon: DollarSign };
    if (p.is_blocked) return { label: 'Bloqueado', variant: 'destructive' as const, icon: XCircle };
    return { label: 'Normal', variant: 'secondary' as const, icon: CheckCircle };
  };

  const formatCPF = (cpf: string | null) => {
    if (!cpf) return '-';
    const clean = cpf.replace(/\D/g, '');
    if (clean.length === 11) {
      return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
    }
    return cpf;
  };

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
        <h2 className="text-2xl font-bold text-foreground">Sistema Antifraude</h2>
        <p className="text-muted-foreground">Controle de fraudes, bloqueios e pendências financeiras</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Ban className="w-4 h-4 text-destructive" />
              Bloqueados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{blockedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-status-searching" />
              Fraudes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-searching">{fraudCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-destructive" />
              Bloqueios Financeiros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{financialBlockedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              Total Pendente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">R$ {debtTotal.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="providers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="providers">Prestadores</TabsTrigger>
          <TabsTrigger value="credentials">Credenciais Bloqueadas</TabsTrigger>
          <TabsTrigger value="history">Histórico de Fraudes</TabsTrigger>
        </TabsList>

        <TabsContent value="providers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Controle de Prestadores
              </CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email, CPF, telefone ou Device ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              {filteredProviders.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum prestador encontrado
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Prestador</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Device ID</TableHead>
                        <TableHead>Pendência</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProviders.map((p) => {
                        const status = getProviderStatus(p);
                        const isBlocked = p.is_blocked || p.permanently_blocked || p.fraud_flagged || p.financial_blocked;
                        const pendingBalance = p.pending_fee_balance || 0;
                        const maxLimit = p.max_debt_limit || 400;
                        const isOverLimit = pendingBalance >= maxLimit;

                        return (
                          <TableRow key={p.id} className={isBlocked ? 'bg-destructive/5' : ''}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{p.profile?.name || 'Sem nome'}</p>
                                <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                                  {p.profile?.email && (
                                    <span className="flex items-center gap-1">
                                      <Mail className="w-3 h-3" />
                                      {p.profile.email}
                                    </span>
                                  )}
                                  {p.profile?.phone && (
                                    <span className="flex items-center gap-1">
                                      <Phone className="w-3 h-3" />
                                      {p.profile.phone}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-xs">
                                {formatCPF(p.profile?.cpf || null)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Smartphone className="w-3 h-3 text-muted-foreground" />
                                <span className="font-mono text-xs truncate max-w-[100px]">
                                  {p.device_id ? p.device_id.slice(0, 12) + '...' : '-'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className={`font-semibold ${isOverLimit ? 'text-destructive' : pendingBalance > 0 ? 'text-status-searching' : 'text-muted-foreground'}`}>
                                R$ {pendingBalance.toFixed(2)}
                                {isOverLimit && (
                                  <span className="ml-1 text-xs">(limite: R$ {maxLimit})</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={status.variant} className="flex items-center gap-1 w-fit">
                                <status.icon className="w-3 h-3" />
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setDetailsDialog({ open: true, provider: p })}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {isBlocked ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setUnblockConfirm({ open: true, provider: p })}
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Desbloquear
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => {
                                      setBlockDialog({ open: true, provider: p });
                                      setBlockingType('manual');
                                    }}
                                  >
                                    <Ban className="w-4 h-4 mr-1" />
                                    Bloquear
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credentials">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Credenciais Bloqueadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {blockedCredentials.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma credencial bloqueada
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {blockedCredentials.map((cred) => (
                        <TableRow key={cred.id}>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {cred.credential_type === 'cpf' && <CreditCard className="w-3 h-3 mr-1" />}
                              {cred.credential_type === 'email' && <Mail className="w-3 h-3 mr-1" />}
                              {cred.credential_type === 'phone' && <Phone className="w-3 h-3 mr-1" />}
                              {cred.credential_type === 'device_id' && <Smartphone className="w-3 h-3 mr-1" />}
                              {cred.credential_type === 'vehicle_plate' && <Car className="w-3 h-3 mr-1" />}
                              {cred.credential_type.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs">
                              {cred.credential_type === 'cpf' 
                                ? formatCPF(cred.credential_value)
                                : cred.credential_value.length > 30 
                                  ? cred.credential_value.slice(0, 30) + '...'
                                  : cred.credential_value}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">{cred.block_reason}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {cred.blocked_at 
                              ? format(new Date(cred.blocked_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Histórico de Fraudes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {fraudHistory.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum registro de fraude
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ação</TableHead>
                        <TableHead>Detalhes</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fraudHistory.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>
                            <Badge variant={entry.action.includes('unblock') ? 'default' : 'destructive'}>
                              {entry.action === 'blocked_for_fraud' && 'Bloqueado por Fraude'}
                              {entry.action === 'unblocked' && 'Desbloqueado'}
                              {!['blocked_for_fraud', 'unblocked'].includes(entry.action) && entry.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {entry.details?.reason || entry.details?.notes || '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {entry.created_at 
                              ? format(new Date(entry.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
            <div className="flex gap-2">
              <Button
                variant={blockingType === 'manual' ? 'default' : 'outline'}
                onClick={() => setBlockingType('manual')}
                className="flex-1"
              >
                Bloqueio Manual
              </Button>
              <Button
                variant={blockingType === 'fraud' ? 'destructive' : 'outline'}
                onClick={() => setBlockingType('fraud')}
                className="flex-1"
              >
                <AlertTriangle className="w-4 h-4 mr-1" />
                Marcar Fraude
              </Button>
            </div>
            
            {blockingType === 'fraud' && (
              <div className="p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
                <p className="font-medium">Atenção: Bloqueio permanente!</p>
                <p>Ao marcar como fraude, o CPF, email, telefone, device ID, placa e chave PIX serão bloqueados permanentemente.</p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Motivo do bloqueio *</Label>
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
            <Button 
              variant="destructive" 
              onClick={blockingType === 'fraud' ? handleBlockForFraud : handleManualBlock} 
              disabled={!blockReason}
            >
              <Ban className="w-4 h-4 mr-1" />
              {blockingType === 'fraud' ? 'Bloquear por Fraude' : 'Bloquear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unblock Confirm */}
      <AlertDialog open={unblockConfirm.open} onOpenChange={(open) => setUnblockConfirm({ open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desbloquear Prestador?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso removerá todos os bloqueios e credenciais bloqueadas associadas a este prestador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label>Observações (opcional)</Label>
            <Textarea
              placeholder="Motivo do desbloqueio..."
              value={unblockNotes}
              onChange={(e) => setUnblockNotes(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnblock}>
              <CheckCircle className="w-4 h-4 mr-1" />
              Desbloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialog.open} onOpenChange={(open) => setDetailsDialog({ open })}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes do Prestador</DialogTitle>
          </DialogHeader>
          {detailsDialog.provider && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Nome</p>
                  <p className="font-medium">{detailsDialog.provider.profile?.name || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">CPF</p>
                  <p className="font-mono">{formatCPF(detailsDialog.provider.profile?.cpf || null)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{detailsDialog.provider.profile?.email || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Telefone</p>
                  <p className="font-medium">{detailsDialog.provider.profile?.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Device ID</p>
                  <p className="font-mono text-xs break-all">{detailsDialog.provider.device_id || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Placa do Veículo</p>
                  <p className="font-mono">{detailsDialog.provider.vehicle_plate || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Chave PIX</p>
                  <p className="font-mono text-xs break-all">{detailsDialog.provider.pix_key || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pendência</p>
                  <p className="font-semibold text-destructive">
                    R$ {(detailsDialog.provider.pending_fee_balance || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {(detailsDialog.provider.block_reason || detailsDialog.provider.fraud_reason || detailsDialog.provider.permanently_blocked_reason) && (
                <div className="p-3 bg-destructive/10 rounded-lg">
                  <p className="text-sm font-medium text-destructive">Motivo do Bloqueio:</p>
                  <p className="text-sm">
                    {detailsDialog.provider.fraud_reason || 
                     detailsDialog.provider.permanently_blocked_reason || 
                     detailsDialog.provider.block_reason ||
                     detailsDialog.provider.financial_block_reason}
                  </p>
                  {detailsDialog.provider.blocked_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Bloqueado em: {format(new Date(detailsDialog.provider.blocked_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsDialog({ open: false })}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
