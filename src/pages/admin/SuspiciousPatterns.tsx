import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { 
  Loader2, 
  AlertTriangle,
  CheckCircle,
  Eye,
  MessageSquare,
  Users,
  Clock,
  XCircle,
  RefreshCw
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SuspiciousPattern {
  id: string;
  pattern_type: string;
  client_id: string | null;
  provider_id: string | null;
  chamado_id: string | null;
  details: any;
  severity: string;
  reviewed: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  action_taken: string | null;
  created_at: string;
  client_name?: string;
  provider_name?: string;
}

interface ServicePair {
  id: string;
  client_id: string;
  provider_id: string;
  total_services: number;
  completed_services: number;
  cancelled_services: number;
  last_service_at: string;
  flagged_for_review: boolean;
  client_name?: string;
  provider_name?: string;
}

const PATTERN_LABELS: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
  quick_cancellation: {
    label: 'Cancelamento Rápido',
    icon: <Clock className="w-4 h-4" />,
    description: 'Serviço cancelado em menos de 3 minutos após aceite'
  },
  high_cancellation_pair: {
    label: 'Par com Alto Cancelamento',
    icon: <Users className="w-4 h-4" />,
    description: 'Cliente e prestador com taxa de cancelamento acima de 50%'
  },
  recurring_pair_no_completion: {
    label: 'Par Recorrente sem Conclusão',
    icon: <XCircle className="w-4 h-4" />,
    description: 'Cliente e prestador com 5+ serviços e nenhuma conclusão'
  },
};

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-status-searching/20 text-status-searching',
  high: 'bg-destructive/20 text-destructive',
};

const ACTION_OPTIONS = [
  { value: 'none', label: 'Nenhuma ação necessária' },
  { value: 'warning_sent', label: 'Aviso enviado' },
  { value: 'monitoring', label: 'Em monitoramento' },
  { value: 'account_restricted', label: 'Conta restrita' },
];

export default function AdminSuspiciousPatterns() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [patterns, setPatterns] = useState<SuspiciousPattern[]>([]);
  const [servicePairs, setServicePairs] = useState<ServicePair[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('pending');
  
  const [reviewDialog, setReviewDialog] = useState<{ open: boolean; pattern?: SuspiciousPattern }>({ open: false });
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionTaken, setActionTaken] = useState('none');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch suspicious patterns
      let query = supabase
        .from('suspicious_patterns')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (filter === 'pending') {
        query = query.eq('reviewed', false);
      } else if (filter === 'reviewed') {
        query = query.eq('reviewed', true);
      }

      const { data: patternsData, error: patternsError } = await query.limit(100);

      if (patternsError) throw patternsError;

      // Fetch names for clients and providers
      const clientIds = [...new Set(patternsData?.map(p => p.client_id).filter(Boolean))];
      const providerIds = [...new Set(patternsData?.map(p => p.provider_id).filter(Boolean))];
      const allUserIds = [...new Set([...clientIds, ...providerIds])];

      let profilesMap: Record<string, string> = {};
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', allUserIds);
        
        profiles?.forEach(p => {
          profilesMap[p.user_id] = p.name;
        });
      }

      const enrichedPatterns = patternsData?.map(p => ({
        ...p,
        client_name: p.client_id ? profilesMap[p.client_id] : undefined,
        provider_name: p.provider_id ? profilesMap[p.provider_id] : undefined,
      })) || [];

      setPatterns(enrichedPatterns);

      // Fetch flagged service pairs
      const { data: pairsData, error: pairsError } = await supabase
        .from('service_pairs')
        .select('*')
        .eq('flagged_for_review', true)
        .order('last_service_at', { ascending: false })
        .limit(50);

      if (!pairsError && pairsData) {
        const pairUserIds = [...new Set([
          ...pairsData.map(p => p.client_id),
          ...pairsData.map(p => p.provider_id)
        ])];

        let pairProfilesMap: Record<string, string> = {};
        if (pairUserIds.length > 0) {
          const { data: pairProfiles } = await supabase
            .from('profiles')
            .select('user_id, name')
            .in('user_id', pairUserIds);
          
          pairProfiles?.forEach(p => {
            pairProfilesMap[p.user_id] = p.name;
          });
        }

        const enrichedPairs = pairsData.map(p => ({
          ...p,
          client_name: pairProfilesMap[p.client_id],
          provider_name: pairProfilesMap[p.provider_id],
        }));

        setServicePairs(enrichedPairs);
      }
    } catch (err) {
      console.error('Error fetching suspicious patterns:', err);
      toast.error('Erro ao carregar padrões suspeitos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filter]);

  // Subscribe to new patterns
  useEffect(() => {
    const channel = supabase
      .channel('suspicious-patterns-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'suspicious_patterns',
        },
        () => {
          toast.info('Novo padrão suspeito detectado');
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleReview = async () => {
    if (!reviewDialog.pattern || !user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('suspicious_patterns')
        .update({
          reviewed: true,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || null,
          action_taken: actionTaken,
        })
        .eq('id', reviewDialog.pattern.id);

      if (error) throw error;

      // Log admin action
      await supabase.from('admin_logs').insert({
        admin_id: user.id,
        action: 'review_suspicious_pattern',
        target_type: 'suspicious_pattern',
        target_id: reviewDialog.pattern.id,
        details: { 
          pattern_type: reviewDialog.pattern.pattern_type,
          action_taken: actionTaken,
          notes: reviewNotes 
        }
      });

      toast.success('Padrão revisado com sucesso');
      setReviewDialog({ open: false });
      setReviewNotes('');
      setActionTaken('none');
      fetchData();
    } catch (err) {
      console.error('Error reviewing pattern:', err);
      toast.error('Erro ao revisar padrão');
    } finally {
      setSubmitting(false);
    }
  };

  // Stats
  const pendingCount = patterns.filter(p => !p.reviewed).length;
  const highSeverityCount = patterns.filter(p => p.severity === 'high' && !p.reviewed).length;
  const flaggedPairsCount = servicePairs.length;

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
          <h2 className="text-2xl font-bold text-foreground">Padrões Suspeitos</h2>
          <p className="text-muted-foreground">Detecção automática de comportamentos suspeitos para revisão manual</p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-status-searching" />
              Pendentes de Revisão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-searching">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="w-4 h-4 text-destructive" />
              Alta Severidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{highSeverityCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Pares Sinalizados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{flaggedPairsCount}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="patterns" className="space-y-4">
        <TabsList>
          <TabsTrigger value="patterns">Padrões Detectados</TabsTrigger>
          <TabsTrigger value="pairs">Pares Sinalizados</TabsTrigger>
        </TabsList>

        <TabsContent value="patterns">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Padrões Detectados
                </CardTitle>
                <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="reviewed">Revisados</SelectItem>
                    <SelectItem value="all">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {patterns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p>Nenhum padrão suspeito {filter === 'pending' ? 'pendente' : 'encontrado'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Prestador</TableHead>
                        <TableHead>Severidade</TableHead>
                        <TableHead>Detalhes</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {patterns.map((pattern) => {
                        const patternInfo = PATTERN_LABELS[pattern.pattern_type] || {
                          label: pattern.pattern_type,
                          icon: <AlertTriangle className="w-4 h-4" />,
                          description: ''
                        };

                        return (
                          <TableRow key={pattern.id} className={pattern.reviewed ? 'opacity-60' : ''}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {patternInfo.icon}
                                <div>
                                  <p className="font-medium text-sm">{patternInfo.label}</p>
                                  <p className="text-xs text-muted-foreground">{patternInfo.description}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{pattern.client_name || '-'}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{pattern.provider_name || '-'}</span>
                            </TableCell>
                            <TableCell>
                              <Badge className={SEVERITY_COLORS[pattern.severity] || ''}>
                                {pattern.severity === 'high' ? 'Alta' : pattern.severity === 'medium' ? 'Média' : 'Baixa'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-xs text-muted-foreground max-w-[200px] truncate">
                                {pattern.details?.seconds_to_cancel && (
                                  <span>Cancelado em {pattern.details.seconds_to_cancel}s</span>
                                )}
                                {pattern.details?.cancellation_rate && (
                                  <span>Taxa: {(pattern.details.cancellation_rate * 100).toFixed(0)}%</span>
                                )}
                                {pattern.details?.total_services && (
                                  <span>{pattern.details.total_services} serviços</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(pattern.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {pattern.reviewed ? (
                                <Badge variant="outline" className="text-xs">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Revisado
                                </Badge>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setReviewDialog({ open: true, pattern })}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  Revisar
                                </Button>
                              )}
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

        <TabsContent value="pairs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Pares Cliente-Prestador Sinalizados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {servicePairs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                  <p>Nenhum par sinalizado para revisão</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Prestador</TableHead>
                        <TableHead>Total Serviços</TableHead>
                        <TableHead>Concluídos</TableHead>
                        <TableHead>Cancelados</TableHead>
                        <TableHead>Taxa Cancelamento</TableHead>
                        <TableHead>Último Serviço</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {servicePairs.map((pair) => {
                        const cancelRate = pair.total_services > 0 
                          ? (pair.cancelled_services / pair.total_services) * 100 
                          : 0;

                        return (
                          <TableRow key={pair.id}>
                            <TableCell>
                              <span className="font-medium">{pair.client_name || pair.client_id.slice(0, 8)}</span>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">{pair.provider_name || pair.provider_id.slice(0, 8)}</span>
                            </TableCell>
                            <TableCell>{pair.total_services}</TableCell>
                            <TableCell>
                              <span className="text-status-finished">{pair.completed_services}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-destructive">{pair.cancelled_services}</span>
                            </TableCell>
                            <TableCell>
                              <Badge className={cancelRate > 50 ? 'bg-destructive/20 text-destructive' : 'bg-muted'}>
                                {cancelRate.toFixed(0)}%
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(pair.last_service_at), "dd/MM/yy", { locale: ptBR })}
                              </span>
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
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={reviewDialog.open} onOpenChange={(open) => !open && setReviewDialog({ open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revisar Padrão Suspeito</DialogTitle>
            <DialogDescription>
              Analise o padrão e registre sua decisão. Nenhuma ação automática será tomada.
            </DialogDescription>
          </DialogHeader>

          {reviewDialog.pattern && (
            <div className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <p className="font-medium">
                  {PATTERN_LABELS[reviewDialog.pattern.pattern_type]?.label || reviewDialog.pattern.pattern_type}
                </p>
                <div className="text-sm text-muted-foreground">
                  <p>Cliente: {reviewDialog.pattern.client_name || 'N/A'}</p>
                  <p>Prestador: {reviewDialog.pattern.provider_name || 'N/A'}</p>
                </div>
                {reviewDialog.pattern.details && (
                  <pre className="text-xs bg-background p-2 rounded mt-2 overflow-auto">
                    {JSON.stringify(reviewDialog.pattern.details, null, 2)}
                  </pre>
                )}
              </div>

              <div className="space-y-2">
                <Label>Ação Tomada</Label>
                <Select value={actionTaken} onValueChange={setActionTaken}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Observações (opcional)</Label>
                <Textarea
                  placeholder="Adicione observações sobre sua análise..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog({ open: false })}>
              Cancelar
            </Button>
            <Button onClick={handleReview} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Marcar como Revisado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
