import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAdminClients } from '@/hooks/useAdminData';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  Loader2, 
  Users,
  Ban,
  CheckCircle,
  Phone,
  Mail,
  DollarSign,
  Car,
  User
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [blockDialog, setBlockDialog] = useState<{ open: boolean; client?: any }>({ open: false });
  const [blockReason, setBlockReason] = useState('');

  const selectedClient = clients.find(c => c.user_id === selectedClientId);

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

      {/* Client Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Selecionar Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Select 
            value={selectedClientId || ""} 
            onValueChange={(value) => setSelectedClientId(value || null)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione um cliente..." />
            </SelectTrigger>
            <SelectContent className="bg-background border border-border z-50">
              {clients.map((c) => (
                <SelectItem key={c.user_id} value={c.user_id}>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{c.name || 'Sem nome'}</span>
                    {c.is_blocked && (
                      <Badge variant="destructive" className="ml-2 text-xs">Bloqueado</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Selected Client Details */}
          {selectedClient && (
            <div className="border border-border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{selectedClient.name || 'Sem nome'}</h3>
                {selectedClient.is_blocked ? (
                  <Badge variant="destructive">Bloqueado</Badge>
                ) : (
                  <Badge className="bg-status-finished text-white">Ativo</Badge>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedClient.email || 'Não informado'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedClient.phone || 'Não informado'}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <span>Total gasto: {formatCurrency(selectedClient.totalSpent || 0)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Car className="w-4 h-4 text-muted-foreground" />
                    <span>Corridas: {selectedClient.totalRides || 0}</span>
                  </div>
                </div>
              </div>

              {selectedClient.is_blocked && selectedClient.block_reason && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <p className="text-sm text-destructive">
                    <strong>Motivo do bloqueio:</strong> {selectedClient.block_reason}
                  </p>
                </div>
              )}

              <div className="flex justify-end">
                {selectedClient.is_blocked ? (
                  <Button
                    variant="outline"
                    onClick={() => handleUnblock(selectedClient.user_id)}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Desbloquear
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setBlockDialog({ open: true, client: selectedClient })}
                  >
                    <Ban className="w-4 h-4 mr-1" />
                    Bloquear
                  </Button>
                )}
              </div>
            </div>
          )}

          {!selectedClient && (
            <div className="text-center text-muted-foreground py-8">
              Selecione um cliente para ver os detalhes
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
