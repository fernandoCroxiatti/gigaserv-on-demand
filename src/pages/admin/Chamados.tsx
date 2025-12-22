import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdminChamados } from '@/hooks/useAdminData';
import { 
  Loader2, 
  Car,
  Search,
  MapPin,
  Clock,
  User,
  UserCheck,
  DollarSign,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Database } from '@/integrations/supabase/types';

type ChamadoStatus = Database['public']['Enums']['chamado_status'];
type ServiceType = Database['public']['Enums']['service_type'];

const STATUS_CONFIG: Record<ChamadoStatus, { label: string; className: string }> = {
  idle: { label: 'Aguardando', className: 'bg-muted text-muted-foreground' },
  searching: { label: 'Buscando', className: 'bg-status-searching text-white' },
  accepted: { label: 'Aceito', className: 'bg-status-accepted text-white' },
  negotiating: { label: 'Negociando', className: 'bg-status-inService text-white' },
  awaiting_payment: { label: 'Aguard. Pagamento', className: 'bg-amber-500 text-white' },
  in_service: { label: 'Em Andamento', className: 'bg-status-inService text-white' },
  pending_client_confirmation: { label: 'Aguard. Confirmação', className: 'bg-orange-500 text-white' },
  finished: { label: 'Concluída', className: 'bg-status-finished text-white' },
  canceled: { label: 'Cancelada', className: 'bg-destructive text-white' },
};

const SERVICE_LABELS: Record<ServiceType, string> = {
  guincho: 'Guincho',
  borracharia: 'Borracharia',
  mecanica: 'Mecânica',
  chaveiro: 'Chaveiro',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function AdminChamados() {
  const [statusFilter, setStatusFilter] = useState<ChamadoStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const { chamados, loading } = useAdminChamados({
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const filteredChamados = chamados.filter(c => 
    c.cliente?.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.prestador?.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.origem_address?.toLowerCase().includes(search.toLowerCase())
  );

  // Calculate stats
  const stats = {
    total: chamados.length,
    active: chamados.filter(c => ['searching', 'negotiating', 'awaiting_payment', 'in_service'].includes(c.status)).length,
    completed: chamados.filter(c => c.status === 'finished').length,
    canceled: chamados.filter(c => c.status === 'canceled').length,
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
        <h2 className="text-2xl font-bold text-foreground">Gestão de Corridas</h2>
        <p className="text-muted-foreground">Visualize todas as corridas do sistema (somente leitura)</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Em Andamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-searching">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Concluídas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-finished">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Canceladas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.canceled}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="w-5 h-5" />
            Corridas
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, prestador ou endereço..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ChamadoStatus | 'all')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredChamados.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma corrida encontrada
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Prestador</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {filteredChamados.map((c) => {
                    const statusConfig = STATUS_CONFIG[c.status as ChamadoStatus];
                    const valor = c.valor || 0;
                    const commission = c.commission_amount || (valor * (c.commission_percentage || 15) / 100);
                    const isDirectPayment = (c as any).direct_payment_to_provider === true;
                    const receiptConfirmed = (c as any).direct_payment_receipt_confirmed === true;
                    const confirmedAt = (c as any).direct_payment_confirmed_at;
                    
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            {format(new Date(c.created_at), "dd/MM/yy HH:mm")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusConfig?.className}>
                            {statusConfig?.label || c.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {SERVICE_LABELS[c.tipo_servico as ServiceType] || c.tipo_servico}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isDirectPayment ? (
                            <div className="space-y-1">
                              <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">
                                <DollarSign className="w-3 h-3 mr-1" />
                                Direto
                              </Badge>
                              {receiptConfirmed ? (
                                <div className="flex items-center gap-1 text-xs text-green-600">
                                  <CheckCircle className="w-3 h-3" />
                                  <span>Confirmado</span>
                                  {confirmedAt && (
                                    <span className="text-muted-foreground">
                                      {format(new Date(confirmedAt), "dd/MM HH:mm")}
                                    </span>
                                  )}
                                </div>
                              ) : c.status === 'finished' ? (
                                <div className="flex items-center gap-1 text-xs text-red-600">
                                  <XCircle className="w-3 h-3" />
                                  <span>Não confirmado</span>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              {c.payment_method || 'App'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm">{c.cliente?.name || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <UserCheck className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm">{c.prestador?.name || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 max-w-[200px]">
                            <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm truncate" title={c.origem_address}>
                              {c.origem_address}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {valor > 0 ? formatCurrency(valor) : '-'}
                        </TableCell>
                        <TableCell className="text-right text-primary">
                          {valor > 0 ? formatCurrency(commission) : '-'}
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
    </div>
  );
}
