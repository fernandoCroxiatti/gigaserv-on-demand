import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdminChamados, useAdminProviders } from '@/hooks/useAdminData';
import { 
  Loader2, 
  FileText, 
  Download,
  Calendar,
  Filter
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Database } from '@/integrations/supabase/types';

type ServiceType = Database['public']['Enums']['service_type'];

const SERVICE_LABELS: Record<ServiceType, string> = {
  guincho: 'Guincho',
  borracharia: 'Borracharia',
  mecanica: 'Mecânica',
  chaveiro: 'Chaveiro',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function AdminReports() {
  const [startDate, setStartDate] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [selectedService, setSelectedService] = useState<string>('all');

  const { providers } = useAdminProviders();
  const { chamados, loading } = useAdminChamados({
    startDate: startOfDay(new Date(startDate)).toISOString(),
    endDate: endOfDay(new Date(endDate)).toISOString(),
    providerId: selectedProvider !== 'all' ? selectedProvider : undefined,
    serviceType: selectedService !== 'all' ? selectedService as ServiceType : undefined,
  });

  const finishedChamados = useMemo(() => 
    chamados.filter(c => c.status === 'finished' && c.valor),
    [chamados]
  );

  const stats = useMemo(() => {
    const totalRevenue = finishedChamados.reduce((acc, c) => acc + (c.valor || 0), 0);
    const totalCommission = finishedChamados.reduce((acc, c) => {
      const valor = c.valor || 0;
      const commission = c.commission_amount || (valor * (c.commission_percentage || 15) / 100);
      return acc + commission;
    }, 0);
    const totalPayout = totalRevenue - totalCommission;

    return {
      totalRevenue,
      totalCommission,
      totalPayout,
      totalRides: finishedChamados.length,
    };
  }, [finishedChamados]);

  const handleExportCSV = () => {
    const headers = ['Data', 'Cliente', 'Prestador', 'Serviço', 'Valor', 'Comissão', 'Repasse'];
    const rows = finishedChamados.map(c => {
      const valor = c.valor || 0;
      const commission = c.commission_amount || (valor * (c.commission_percentage || 15) / 100);
      return [
        format(new Date(c.created_at), 'dd/MM/yyyy HH:mm'),
        c.cliente?.name || '-',
        c.prestador?.name || '-',
        SERVICE_LABELS[c.tipo_servico as ServiceType] || c.tipo_servico,
        valor.toFixed(2),
        commission.toFixed(2),
        (valor - commission).toFixed(2),
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_${format(new Date(startDate), 'yyyy-MM-dd')}_${format(new Date(endDate), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const setQuickFilter = (days: number) => {
    const end = new Date();
    const start = subDays(end, days);
    setStartDate(format(start, 'yyyy-MM-dd'));
    setEndDate(format(end, 'yyyy-MM-dd'));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Relatórios Financeiros</h2>
        <p className="text-muted-foreground">Análise detalhada de faturamento e comissões</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Data Início</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Prestador</Label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {providers.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.profile?.name || 'Sem nome'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de Serviço</Label>
              <Select value={selectedService} onValueChange={setSelectedService}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(SERVICE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setQuickFilter(0)}>Hoje</Button>
            <Button variant="outline" size="sm" onClick={() => setQuickFilter(7)}>7 dias</Button>
            <Button variant="outline" size="sm" onClick={() => setQuickFilter(30)}>30 dias</Button>
            <Button variant="outline" size="sm" onClick={() => {
              setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
              setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
            }}>Este mês</Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Faturado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">{stats.totalRides} corridas</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/10 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Comissão do App</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(stats.totalCommission)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Repasse Prestadores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalPayout)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Exportar</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExportCSV} className="w-full" disabled={finishedChamados.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Detalhamento
          </CardTitle>
          <CardDescription>
            {finishedChamados.length} corridas no período selecionado
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : finishedChamados.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma corrida encontrada no período
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Prestador</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                    <TableHead className="text-right">Repasse</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finishedChamados.map((c) => {
                    const valor = c.valor || 0;
                    const commission = c.commission_amount || (valor * (c.commission_percentage || 15) / 100);
                    return (
                      <TableRow key={c.id}>
                        <TableCell>{format(new Date(c.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                        <TableCell>{c.cliente?.name || '-'}</TableCell>
                        <TableCell>{c.prestador?.name || '-'}</TableCell>
                        <TableCell>{SERVICE_LABELS[c.tipo_servico as ServiceType] || c.tipo_servico}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(valor)}</TableCell>
                        <TableCell className="text-right text-primary">{formatCurrency(commission)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(valor - commission)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
