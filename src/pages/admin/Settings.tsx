import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppSettings, useSettingsHistory, PixConfig } from '@/hooks/useAdminData';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  Loader2, 
  Percent, 
  History,
  Save,
  AlertCircle,
  DollarSign,
  Smartphone,
  Building
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

export default function AdminSettings() {
  const { user } = useAuth();
  const { 
    commissionPercentage, 
    maxPendingFeeLimit, 
    pixConfig, 
    loading, 
    saving, 
    updateCommission, 
    updateMaxPendingFeeLimit,
    updatePixConfig 
  } = useAppSettings();
  const { history, loading: historyLoading } = useSettingsHistory();
  const [newPercentage, setNewPercentage] = useState<string>('');
  const [newLimit, setNewLimit] = useState<string>('');
  
  // PIX form state
  const [pixKeyType, setPixKeyType] = useState<PixConfig['key_type']>('random');
  const [pixKey, setPixKey] = useState('');
  const [pixRecipientName, setPixRecipientName] = useState('');
  const [pixBankName, setPixBankName] = useState('');

  // Sync PIX form with fetched data
  useEffect(() => {
    if (pixConfig) {
      setPixKeyType(pixConfig.key_type || 'random');
      setPixKey(pixConfig.key || '');
      setPixRecipientName(pixConfig.recipient_name || '');
      setPixBankName(pixConfig.bank_name || '');
    }
  }, [pixConfig]);

  const handleSaveCommission = async () => {
    const value = parseFloat(newPercentage);
    if (isNaN(value) || value < 0 || value > 100) {
      toast.error('Porcentagem deve estar entre 0 e 100');
      return;
    }

    const result = await updateCommission(value);
    if (result.success) {
      toast.success('Comissão atualizada com sucesso!');
      setNewPercentage('');
    } else {
      toast.error('Erro ao atualizar comissão');
    }
  };

  const handleSaveLimit = async () => {
    const value = parseFloat(newLimit);
    if (isNaN(value) || value < 0) {
      toast.error('Limite deve ser um valor positivo');
      return;
    }

    const result = await updateMaxPendingFeeLimit(value);
    if (result.success) {
      toast.success('Limite de pendência atualizado com sucesso!');
      setNewLimit('');
    } else {
      toast.error('Erro ao atualizar limite');
    }
  };

  const handleSavePixConfig = async () => {
    if (!pixKey.trim()) {
      toast.error('Informe a chave PIX');
      return;
    }

    const result = await updatePixConfig({
      key_type: pixKeyType,
      key: pixKey.trim(),
      recipient_name: pixRecipientName.trim(),
      bank_name: pixBankName.trim(),
    });

    if (result.success) {
      toast.success('Configuração PIX atualizada com sucesso!');
    } else {
      toast.error('Erro ao atualizar configuração PIX');
    }
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
        <h2 className="text-2xl font-bold text-foreground">Configurações Financeiras</h2>
        <p className="text-muted-foreground">Gerencie a comissão, limites e configurações de pagamento</p>
      </div>

      {/* Commission Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="w-5 h-5" />
            Porcentagem de Comissão do App
          </CardTitle>
          <CardDescription>
            Defina a porcentagem que o app retém de cada corrida. Esta configuração será aplicada automaticamente em todos os novos pagamentos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Comissão atual</p>
              <p className="text-3xl font-bold text-primary">{commissionPercentage}%</p>
            </div>
            <div className="h-12 w-px bg-border" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Repasse ao prestador</p>
              <p className="text-3xl font-bold">{100 - commissionPercentage}%</p>
            </div>
          </div>

          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="newPercentage">Nova porcentagem (%)</Label>
              <Input
                id="newPercentage"
                type="number"
                min="0"
                max="100"
                step="0.5"
                placeholder={`${commissionPercentage}`}
                value={newPercentage}
                onChange={(e) => setNewPercentage(e.target.value)}
              />
            </div>
            <Button onClick={handleSaveCommission} disabled={saving || !newPercentage}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>

          <div className="flex items-start gap-2 p-3 bg-amber-500/10 text-amber-600 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              A alteração será aplicada apenas para novas corridas. Corridas já iniciadas manterão a porcentagem original.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Max Pending Fee Limit */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Limite Máximo de Pendência
          </CardTitle>
          <CardDescription>
            Defina o limite máximo de taxa pendente (MANUAL_PIX) antes de bloquear o prestador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Limite atual</p>
              <p className="text-3xl font-bold text-destructive">R$ {maxPendingFeeLimit.toFixed(0)}</p>
            </div>
            <div className="h-12 w-px bg-border" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Comportamento</p>
              <p className="text-sm">Bloqueia prestador quando exceder</p>
            </div>
          </div>

          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="newLimit">Novo limite (R$)</Label>
              <Input
                id="newLimit"
                type="number"
                min="0"
                step="50"
                placeholder={`${maxPendingFeeLimit}`}
                value={newLimit}
                onChange={(e) => setNewLimit(e.target.value)}
              />
            </div>
            <Button onClick={handleSaveLimit} disabled={saving || !newLimit}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>

          <div className="flex items-start gap-2 p-3 bg-amber-500/10 text-amber-600 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              Prestadores com saldo devedor acima deste limite não poderão ficar online ou aceitar novos chamados.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* PIX Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Configuração da Chave PIX
          </CardTitle>
          <CardDescription>
            Configure a chave PIX para receber os pagamentos de taxas dos prestadores.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!pixConfig?.key && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>
                <strong>Atenção:</strong> A chave PIX não está configurada. Os prestadores não conseguirão pagar as taxas.
              </p>
            </div>
          )}

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="pixKeyType">Tipo de chave</Label>
              <Select value={pixKeyType} onValueChange={(v) => setPixKeyType(v as PixConfig['key_type'])}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
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
              <Label htmlFor="pixKey">Chave PIX *</Label>
              <Input
                id="pixKey"
                type="text"
                placeholder="Informe a chave PIX"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pixRecipientName">Nome do recebedor</Label>
              <Input
                id="pixRecipientName"
                type="text"
                placeholder="Ex: GIGA S.O.S LTDA"
                value={pixRecipientName}
                onChange={(e) => setPixRecipientName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pixBankName">Nome do banco</Label>
              <div className="flex gap-2 items-center">
                <Building className="w-4 h-4 text-muted-foreground" />
                <Input
                  id="pixBankName"
                  type="text"
                  placeholder="Ex: Banco Inter"
                  value={pixBankName}
                  onChange={(e) => setPixBankName(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Button onClick={handleSavePixConfig} disabled={saving} className="w-full">
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar Configuração PIX
          </Button>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Histórico de Alterações
          </CardTitle>
          <CardDescription>
            Registro de todas as alterações de configuração
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma alteração registrada
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Configuração</TableHead>
                  <TableHead>Valor Anterior</TableHead>
                  <TableHead>Novo Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {format(new Date(item.changed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-medium">{item.setting_key}</TableCell>
                    <TableCell>
                      {item.old_value?.value !== undefined ? `${item.old_value.value}%` : '-'}
                    </TableCell>
                    <TableCell className="font-medium text-primary">
                      {item.new_value?.value !== undefined ? `${item.new_value.value}%` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
