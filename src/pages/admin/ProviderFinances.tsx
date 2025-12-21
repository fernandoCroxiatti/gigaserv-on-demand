import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAdminFees, FinancialStatus, PixConfig } from '@/hooks/useAdminFees';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Loader2, 
  Receipt, 
  Users,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Smartphone,
  CreditCard,
  Save,
  RefreshCw,
  Filter,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function getStatusBadge(status: FinancialStatus) {
  switch (status) {
    case 'PAGO':
      return <Badge className="bg-status-finished text-white">Pago</Badge>;
    case 'DEVENDO':
      return <Badge variant="destructive">Devendo</Badge>;
    case 'AGUARDANDO_APROVACAO':
      return <Badge className="bg-status-searching text-white">Aguardando</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

type FilterType = 'all' | 'PAGO' | 'DEVENDO' | 'AGUARDANDO_APROVACAO' | 'STRIPE' | 'MANUAL_PIX';

export default function ProviderFinances() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterType>('all');
  const { 
    providers, 
    fees, 
    pixConfig, 
    loading, 
    refetch, 
    approvePayment, 
    rejectPayment,
    updatePixConfig 
  } = useAdminFees(filter);

  const [savingPix, setSavingPix] = useState(false);
  const [localPixConfig, setLocalPixConfig] = useState<PixConfig>(
    pixConfig || { key_type: 'random', key: '', recipient_name: 'GIGA S.O.S', bank_name: '' }
  );
  const [confirmAction, setConfirmAction] = useState<{ type: 'approve' | 'reject'; providerId: string; providerName: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [loadingProof, setLoadingProof] = useState<string | null>(null);

  const handleViewProof = async (proofPath: string) => {
    if (!proofPath) return;
    
    setLoadingProof(proofPath);
    try {
      // Check if it's already a full URL (legacy) or just a path
      if (proofPath.startsWith('http')) {
        window.open(proofPath, '_blank');
        return;
      }
      
      // Generate signed URL for private bucket
      const { data, error } = await supabase.storage
        .from('payment-proofs')
        .createSignedUrl(proofPath, 3600); // 1 hour expiry

      if (error) throw error;
      
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err) {
      console.error('Error getting signed URL:', err);
      toast.error('Erro ao abrir comprovante');
    } finally {
      setLoadingProof(null);
    }
  };

  React.useEffect(() => {
    if (pixConfig) {
      setLocalPixConfig(pixConfig);
    }
  }, [pixConfig]);

  const handleSavePixConfig = async () => {
    setSavingPix(true);
    const result = await updatePixConfig(localPixConfig);
    setSavingPix(false);

    if (result.success) {
      toast.success('Configuração PIX atualizada!');
    } else {
      toast.error(result.error || 'Erro ao salvar configuração');
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction || !user?.id) return;
    
    setProcessing(true);
    
    let result;
    if (confirmAction.type === 'approve') {
      result = await approvePayment(confirmAction.providerId, user.id);
      if (result.success) {
        toast.success(`Pagamento de ${confirmAction.providerName} aprovado!`);
      }
    } else {
      result = await rejectPayment(confirmAction.providerId, user.id);
      if (result.success) {
        toast.success(`Pagamento de ${confirmAction.providerName} recusado!`);
      }
    }

    if (!result.success) {
      toast.error(result.error || 'Erro ao processar ação');
    }

    setProcessing(false);
    setConfirmAction(null);
  };

  // Stats
  const totalPending = providers.reduce((acc, p) => acc + p.pendingBalance, 0);
  const awaitingApproval = providers.filter(p => p.financialStatus === 'AGUARDANDO_APROVACAO').length;
  const totalProviders = providers.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Financeiro dos Prestadores</h2>
          <p className="text-muted-foreground">Gerencie taxas e aprovações de pagamento</p>
        </div>
        <Button variant="outline" onClick={refetch}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Prestadores</p>
                <p className="text-2xl font-bold">{totalProviders}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <Receipt className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Pendente</p>
                <p className="text-2xl font-bold">{formatCurrency(totalPending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-status-searching/10 rounded-lg">
                <Clock className="w-5 h-5 text-status-searching" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aguardando Aprovação</p>
                <p className="text-2xl font-bold">{awaitingApproval}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-status-finished/10 rounded-lg">
                <CheckCircle className="w-5 h-5 text-status-finished" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em Dia</p>
                <p className="text-2xl font-bold">
                  {providers.filter(p => p.financialStatus === 'PAGO').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PIX Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Configuração da Chave PIX
          </CardTitle>
          <CardDescription>
            Configure a chave PIX para recebimento das taxas dos prestadores
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="keyType">Tipo de Chave</Label>
              <Select 
                value={localPixConfig.key_type} 
                onValueChange={(value: PixConfig['key_type']) => 
                  setLocalPixConfig({ ...localPixConfig, key_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="random">Chave Aleatória</SelectItem>
                  <SelectItem value="cpf_cnpj">CPF/CNPJ</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="phone">Telefone</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pixKey">Chave PIX</Label>
              <Input
                id="pixKey"
                value={localPixConfig.key}
                onChange={(e) => setLocalPixConfig({ ...localPixConfig, key: e.target.value })}
                placeholder="Digite a chave PIX"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipientName">Nome do Recebedor</Label>
              <Input
                id="recipientName"
                value={localPixConfig.recipient_name}
                onChange={(e) => setLocalPixConfig({ ...localPixConfig, recipient_name: e.target.value })}
                placeholder="Ex: GIGA S.O.S"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bankName">Instituição Financeira (opcional)</Label>
              <Input
                id="bankName"
                value={localPixConfig.bank_name}
                onChange={(e) => setLocalPixConfig({ ...localPixConfig, bank_name: e.target.value })}
                placeholder="Ex: Nubank"
              />
            </div>
          </div>

          <Button onClick={handleSavePixConfig} disabled={savingPix}>
            {savingPix ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar Configuração PIX
          </Button>
        </CardContent>
      </Card>

      {/* Providers Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Lista de Prestadores
              </CardTitle>
              <CardDescription>
                Visualize e gerencie o status financeiro dos prestadores
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="PAGO">Pagos</SelectItem>
                  <SelectItem value="DEVENDO">Devendo</SelectItem>
                  <SelectItem value="AGUARDANDO_APROVACAO">Aguardando Aprovação</SelectItem>
                  <SelectItem value="STRIPE">Apenas Stripe</SelectItem>
                  <SelectItem value="MANUAL_PIX">Apenas PIX Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {providers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum prestador encontrado com o filtro selecionado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prestador</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor Devido</TableHead>
                  <TableHead className="text-right">Taxa Stripe</TableHead>
                  <TableHead className="text-right">Taxa Manual</TableHead>
                  <TableHead>Último Pagamento</TableHead>
                  <TableHead>Comprovante</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.map((provider) => (
                  <TableRow key={provider.providerId}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{provider.providerName}</p>
                        <p className="text-xs text-muted-foreground">{provider.providerEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(provider.financialStatus)}
                        {provider.isBlocked && (
                          <Badge variant="outline" className="text-destructive border-destructive">
                            Bloqueado
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium text-destructive">
                      {formatCurrency(provider.pendingBalance)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(provider.stripeFees)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(provider.manualFees)}
                    </TableCell>
                    <TableCell>
                      {provider.lastPaymentAt 
                        ? format(new Date(provider.lastPaymentAt), "dd/MM/yyyy", { locale: ptBR })
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      {provider.proofUrl ? (
                        <Button 
                          size="sm" 
                          variant="outline"
                          disabled={loadingProof === provider.proofUrl}
                          onClick={() => handleViewProof(provider.proofUrl!)}
                        >
                          {loadingProof === provider.proofUrl ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <ExternalLink className="w-4 h-4 mr-1" />
                          )}
                          Ver comprovante
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem comprovante</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {provider.financialStatus === 'AGUARDANDO_APROVACAO' && (
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-status-finished border-status-finished hover:bg-status-finished/10"
                            onClick={() => setConfirmAction({ 
                              type: 'approve', 
                              providerId: provider.providerId, 
                              providerName: provider.providerName 
                            })}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Aprovar
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-destructive border-destructive hover:bg-destructive/10"
                            onClick={() => setConfirmAction({ 
                              type: 'reject', 
                              providerId: provider.providerId, 
                              providerName: provider.providerName 
                            })}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Recusar
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'approve' ? 'Aprovar Pagamento' : 'Recusar Pagamento'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'approve' 
                ? `Confirma a aprovação do pagamento de ${confirmAction?.providerName}? O prestador será desbloqueado automaticamente.`
                : `Confirma a recusa do pagamento de ${confirmAction?.providerName}? O prestador continuará bloqueado até regularização.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmAction}
              disabled={processing}
              className={confirmAction?.type === 'approve' 
                ? 'bg-status-finished hover:bg-status-finished/90' 
                : 'bg-destructive hover:bg-destructive/90'
              }
            >
              {processing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {confirmAction?.type === 'approve' ? 'Aprovar' : 'Recusar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
