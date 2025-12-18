import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppSettings, useSettingsHistory } from '@/hooks/useAdminData';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  Loader2, 
  Percent, 
  History,
  Save,
  AlertCircle
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

export default function AdminSettings() {
  const { user } = useAuth();
  const { commissionPercentage, loading, saving, updateCommission } = useAppSettings();
  const { history, loading: historyLoading } = useSettingsHistory();
  const [newPercentage, setNewPercentage] = useState<string>('');

  const handleSave = async () => {
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
        <p className="text-muted-foreground">Gerencie a comissão e configurações do app</p>
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
            <Button onClick={handleSave} disabled={saving || !newPercentage}>
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
