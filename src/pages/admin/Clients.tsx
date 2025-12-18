import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAdminClients } from '@/hooks/useAdminData';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  Loader2, 
  Users,
  Search,
  Ban,
  CheckCircle,
  Phone,
  Mail,
  DollarSign,
  Car
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function AdminClients() {
  const { user } = useAuth();
  const { clients, loading, blockClient, unblockClient } = useAdminClients();
  const [search, setSearch] = useState('');
  const [blockDialog, setBlockDialog] = useState<{ open: boolean; client?: any }>({ open: false });
  const [blockReason, setBlockReason] = useState('');

  const filteredClients = clients.filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  const handleBlock = async () => {
    if (!blockDialog.client || !user) return;
    
    const result = await blockClient(blockDialog.client.user_id, blockReason, user.id);
    if (result.success) {
      toast.success('Cliente bloqueado');
      setBlockDialog({ open: false });
      setBlockReason('');
    } else {
      toast.error('Erro ao bloquear cliente');
    }
  };

  const handleUnblock = async (userId: string) => {
    if (!user) return;
    
    const result = await unblockClient(userId, user.id);
    if (result.success) {
      toast.success('Cliente desbloqueado');
    } else {
      toast.error('Erro ao desbloquear cliente');
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
        <h2 className="text-2xl font-bold text-foreground">Gestão de Clientes</h2>
        <p className="text-muted-foreground">Gerencie todos os clientes cadastrados</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clients.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-finished">
              {clients.filter(c => !c.is_blocked).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Bloqueados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {clients.filter(c => c.is_blocked).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Clientes
          </CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {filteredClients.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum cliente encontrado
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total Gasto</TableHead>
                    <TableHead>Corridas</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{c.name || 'Sem nome'}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {c.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {c.email}
                              </span>
                            )}
                            {c.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {c.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {c.is_blocked ? (
                          <Badge variant="destructive">Bloqueado</Badge>
                        ) : (
                          <Badge className="bg-status-finished text-white">Ativo</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4 text-muted-foreground" />
                          {formatCurrency(c.totalSpent || 0)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Car className="w-4 h-4 text-muted-foreground" />
                          {c.totalRides || 0}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {c.is_blocked ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnblock(c.user_id)}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Desbloquear
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setBlockDialog({ open: true, client: c })}
                          >
                            <Ban className="w-4 h-4 mr-1" />
                            Bloquear
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Block Dialog */}
      <Dialog open={blockDialog.open} onOpenChange={(open) => setBlockDialog({ open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear Cliente</DialogTitle>
            <DialogDescription>
              Bloqueando: {blockDialog.client?.name || 'Cliente'}
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
