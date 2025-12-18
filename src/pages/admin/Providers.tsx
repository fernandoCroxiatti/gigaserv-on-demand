import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAdminProviders } from '@/hooks/useAdminData';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  Loader2, 
  UserCheck,
  Search,
  Ban,
  CheckCircle,
  CreditCard,
  DollarSign,
  Star,
  Phone,
  Mail
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

export default function AdminProviders() {
  const { user } = useAuth();
  const { providers, loading, blockProvider, unblockProvider, togglePayout } = useAdminProviders();
  const [search, setSearch] = useState('');
  const [blockDialog, setBlockDialog] = useState<{ open: boolean; provider?: any }>({ open: false });
  const [blockReason, setBlockReason] = useState('');

  const filteredProviders = providers.filter(p => 
    p.profile?.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.profile?.email?.toLowerCase().includes(search.toLowerCase()) ||
    p.profile?.phone?.includes(search)
  );

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
      <div className="grid gap-4 md:grid-cols-4">
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
            <CardTitle className="text-sm font-medium">Online</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-finished">
              {providers.filter(p => p.is_online).length}
            </div>
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

      {/* Search & Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5" />
            Prestadores
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
                    <TableHead>Status</TableHead>
                    <TableHead>Avaliação</TableHead>
                    <TableHead>Serviços</TableHead>
                    <TableHead>Stripe</TableHead>
                    <TableHead>Repasse</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProviders.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{p.profile?.name || 'Sem nome'}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                        {p.is_blocked ? (
                          <Badge variant="destructive">Bloqueado</Badge>
                        ) : p.is_online ? (
                          <Badge className="bg-status-finished text-white">Online</Badge>
                        ) : (
                          <Badge variant="secondary">Offline</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-status-searching fill-status-searching" />
                          <span>{(p.rating || 5).toFixed(1)}</span>
                          <span className="text-muted-foreground">({p.total_services || 0})</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(p.services_offered || []).map((s: string) => (
                            <Badge key={s} variant="outline" className="text-xs">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.stripe_connected ? (
                          <CheckCircle className="w-4 h-4 text-status-finished" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {p.payout_enabled ? (
                          <Badge className="bg-status-finished text-white">Ativo</Badge>
                        ) : (
                          <Badge variant="destructive">Suspenso</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {p.is_blocked ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUnblock(p.user_id)}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Desbloquear
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setBlockDialog({ open: true, provider: p })}
                            >
                              <Ban className="w-4 h-4 mr-1" />
                              Bloquear
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTogglePayout(p.user_id, p.payout_enabled)}
                          >
                            <DollarSign className="w-4 h-4 mr-1" />
                            {p.payout_enabled ? 'Suspender' : 'Habilitar'}
                          </Button>
                        </div>
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
