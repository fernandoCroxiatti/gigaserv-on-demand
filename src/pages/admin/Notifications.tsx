import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Loader2, 
  Bell,
  Send,
  Users,
  Truck,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  FileText,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';

// =============================================
// TEMPLATES PRÉ-PRONTOS - SAUDAÇÕES (AMBOS)
// =============================================
const greetingTemplates = [
  { title: 'Bom dia!', body: 'Estamos online para te ajudar.' },
  { title: 'Boa tarde!', body: 'Conte com o GIGA S.O.S sempre que precisar.' },
  { title: 'Boa noite!', body: 'Atendimento disponível quando você precisar.' },
  { title: 'Olá!', body: 'O GIGA S.O.S está pronto para te atender.' },
  { title: 'GIGA S.O.S', body: 'Estamos por aqui sempre que precisar.' },
];

// =============================================
// TEMPLATES PRÉ-PRONTOS - PRESTADORES
// =============================================
const providerTemplates = [
  // Saudação + Operacional (novas)
  { title: 'Bom dia!', body: 'Já há chamados disponíveis na sua região.' },
  { title: 'Boa tarde!', body: 'Demanda ativa. Fique online.' },
  { title: 'Boa noite!', body: 'Clientes aguardando atendimento.' },
  { title: 'Horário de pico ativo', body: 'Mais oportunidades agora.' },
  { title: 'Fique disponível', body: 'Mantenha-se disponível para receber novos chamados.' },
  // Originais
  { title: 'Novos chamados na sua região!', body: 'Há novos clientes precisando de guincho na sua área. Fique online e aproveite!' },
  { title: 'Bônus do dia ativo!', body: 'Complete 3 chamados hoje e ganhe um bônus especial. Não perca!' },
  { title: 'Atualize seu cadastro', body: 'Mantenha seus dados atualizados para continuar recebendo chamados.' },
  { title: 'Pagamento liberado!', body: 'Seu pagamento foi processado e está disponível na sua conta.' },
  { title: 'Taxa pendente', body: 'Você tem taxas pendentes. Regularize para continuar operando.' },
  { title: 'Horário de pico!', body: 'Muitos chamados neste momento. Fique online e aumente seus ganhos!' },
];

// =============================================
// TEMPLATES PRÉ-PRONTOS - CLIENTES
// =============================================
const clientTemplates = [
  // Saudação + Conversão (novas)
  { title: 'Bom dia!', body: 'Precisa de guincho hoje? Solicite pelo app.' },
  { title: 'Boa tarde!', body: 'Atendimento rápido e seguro perto de você.' },
  { title: 'Boa noite!', body: 'Imprevistos acontecem. Conte com o GIGA S.O.S.' },
  { title: 'Profissionais próximos', body: 'Profissionais disponíveis próximos a você agora.' },
  { title: 'Solicite ajuda', body: 'Solicite ajuda em poucos cliques pelo GIGA S.O.S.' },
  // Originais
  { title: 'Precisando de guincho?', body: 'Solicite agora mesmo e tenha um prestador em minutos!' },
  { title: 'Novidade no GIGA S.O.S', body: 'Confira as novidades do app e aproveite os novos recursos.' },
  { title: 'Avalie seu último serviço', body: 'Sua opinião é importante! Avalie o prestador do seu último chamado.' },
  { title: 'Promoção especial!', body: 'Desconto exclusivo no seu próximo chamado. Aproveite!' },
  { title: 'Dica de segurança', body: 'Nunca combine pagamentos fora do app. Use sempre os métodos oficiais.' },
  { title: 'Obrigado por usar o GIGA S.O.S', body: 'Estamos sempre melhorando para você. Conte conosco!' },
];

// =============================================
// TEMPLATES PRÉ-PRONTOS - GERAIS (TODOS)
// =============================================
const generalTemplates = [
  // Mensagens neutras (novas)
  { title: 'Obrigado!', body: 'Obrigado por usar o GIGA S.O.S.' },
  { title: 'Melhorias constantes', body: 'Estamos sempre melhorando para você.' },
  { title: 'Conte conosco', body: 'Conte com o GIGA S.O.S quando precisar.' },
  // Originais
  { title: 'Atualização do App', body: 'Atualize o app para ter acesso às últimas melhorias e correções.' },
  { title: 'Manutenção programada', body: 'O app passará por manutenção hoje às 00h. Previsão de retorno: 02h.' },
  { title: 'Novos recursos disponíveis', body: 'Confira as novidades que preparamos para você!' },
  { title: 'Feliz Natal!', body: 'Toda a equipe GIGA S.O.S deseja a você um Feliz Natal!' },
  { title: 'Feliz Ano Novo!', body: 'Um próspero Ano Novo cheio de conquistas! Conte com o GIGA S.O.S.' },
];

export default function AdminNotifications() {
  const [sending, setSending] = useState(false);
  const [targetType, setTargetType] = useState<'providers' | 'clients' | 'all'>('all');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  // Fetch notification stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['notification-stats'],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count: todayCount } = await supabase
        .from('notification_history')
        .select('*', { count: 'exact', head: true })
        .gte('sent_at', today.toISOString());

      const { count: totalCount } = await supabase
        .from('notification_history')
        .select('*', { count: 'exact', head: true });

      const { count: providersWithNotif } = await supabase
        .from('notification_preferences')
        .select('*', { count: 'exact', head: true })
        .eq('enabled', true);

      return {
        todayCount: todayCount || 0,
        totalCount: totalCount || 0,
        enabledUsers: providersWithNotif || 0
      };
    }
  });

  // Fetch recent notifications
  const { data: recentNotifications, isLoading: recentLoading, refetch } = useQuery({
    queryKey: ['recent-notifications'],
    queryFn: async () => {
      const { data } = await supabase
        .from('notification_history')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(10);
      return data || [];
    }
  });

  // Fetch scheduled notifications
  const { data: scheduledNotifications, isLoading: scheduledLoading, refetch: refetchScheduled } = useQuery({
    queryKey: ['scheduled-notifications'],
    queryFn: async () => {
      const { data } = await supabase
        .from('scheduled_notifications')
        .select('*')
        .order('scheduled_at', { ascending: true });
      return data || [];
    }
  });

  const handleSendNotification = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Preencha o título e a mensagem');
      return;
    }

    if (scheduleEnabled && (!scheduledDate || !scheduledTime)) {
      toast.error('Preencha a data e hora para agendamento');
      return;
    }

    setSending(true);
    try {
      let scheduledAt: string | undefined;
      if (scheduleEnabled && scheduledDate && scheduledTime) {
        const dateTime = new Date(`${scheduledDate}T${scheduledTime}:00`);
        if (dateTime <= new Date()) {
          toast.error('A data de agendamento deve ser no futuro');
          setSending(false);
          return;
        }
        scheduledAt = dateTime.toISOString();
      }

      const { error } = await supabase.functions.invoke('send-notifications', {
        body: {
          action: 'manual',
          targetType,
          message: { title, body },
          scheduledAt
        }
      });

      if (error) throw error;

      toast.success(scheduleEnabled ? 'Notificação agendada com sucesso!' : 'Notificações enviadas com sucesso!');
      setTitle('');
      setBody('');
      setScheduleEnabled(false);
      setScheduledDate('');
      setScheduledTime('');
      refetch();
      refetchScheduled();
    } catch (error) {
      console.error('Error sending notifications:', error);
      toast.error('Erro ao enviar notificações');
    } finally {
      setSending(false);
    }
  };

  const getTargetLabel = (type: string) => {
    switch (type) {
      case 'providers': return 'Prestadores';
      case 'clients': return 'Clientes';
      case 'all': return 'Todos';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Notificações</h2>
        <p className="text-muted-foreground">Envie notificações push para usuários do app</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Bell className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statsLoading ? '-' : stats?.todayCount}</p>
                <p className="text-sm text-muted-foreground">Enviadas hoje</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-full">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statsLoading ? '-' : stats?.enabledUsers}</p>
                <p className="text-sm text-muted-foreground">Usuários com notif. ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-full">
                <Clock className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{statsLoading ? '-' : stats?.totalCount}</p>
                <p className="text-sm text-muted-foreground">Total histórico</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Send Notification Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Enviar Notificação Manual
          </CardTitle>
          <CardDescription>
            Envie uma notificação push para um grupo de usuários
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Target Selection */}
          <div className="space-y-3">
            <Label>Público-alvo</Label>
            <RadioGroup
              value={targetType}
              onValueChange={(v) => setTargetType(v as 'providers' | 'clients' | 'all')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="flex items-center gap-2 cursor-pointer">
                  <Users className="w-4 h-4" />
                  Todos
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="providers" id="providers" />
                <Label htmlFor="providers" className="flex items-center gap-2 cursor-pointer">
                  <Truck className="w-4 h-4" />
                  Prestadores
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="clients" id="clients" />
                <Label htmlFor="clients" className="flex items-center gap-2 cursor-pointer">
                  <Users className="w-4 h-4" />
                  Clientes
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Templates Selector */}
          <Collapsible open={templatesOpen} onOpenChange={setTemplatesOpen}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full justify-between text-muted-foreground hover:text-foreground"
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Mensagens pré-prontas
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${templatesOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-3">
              {/* Show templates based on target type */}
              {targetType === 'providers' && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Para Prestadores:</p>
                  <div className="grid gap-2">
                    {providerTemplates.map((template, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setTitle(template.title);
                          setBody(template.body);
                          setTemplatesOpen(false);
                        }}
                        className="text-left p-2 rounded-lg border border-border hover:bg-accent transition-colors"
                      >
                        <p className="text-sm font-medium">{template.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{template.body}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {targetType === 'clients' && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Para Clientes:</p>
                  <div className="grid gap-2">
                    {clientTemplates.map((template, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setTitle(template.title);
                          setBody(template.body);
                          setTemplatesOpen(false);
                        }}
                        className="text-left p-2 rounded-lg border border-border hover:bg-accent transition-colors"
                      >
                        <p className="text-sm font-medium">{template.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{template.body}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {targetType === 'all' && (
                <>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">🔹 Saudações (Ambos):</p>
                    <div className="grid gap-2">
                      {greetingTemplates.map((template, idx) => (
                        <button
                          key={`greeting-${idx}`}
                          type="button"
                          onClick={() => {
                            setTitle(template.title);
                            setBody(template.body);
                            setTemplatesOpen(false);
                          }}
                          className="text-left p-2 rounded-lg border border-border hover:bg-accent transition-colors"
                        >
                          <p className="text-sm font-medium">{template.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{template.body}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">🔹 Gerais / Neutras:</p>
                    <div className="grid gap-2">
                      {generalTemplates.map((template, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setTitle(template.title);
                            setBody(template.body);
                            setTemplatesOpen(false);
                          }}
                          className="text-left p-2 rounded-lg border border-border hover:bg-accent transition-colors"
                        >
                          <p className="text-sm font-medium">{template.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{template.body}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">🔹 Para Prestadores:</p>
                    <div className="grid gap-2">
                      {providerTemplates.slice(0, 5).map((template, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setTitle(template.title);
                            setBody(template.body);
                            setTemplatesOpen(false);
                          }}
                          className="text-left p-2 rounded-lg border border-border hover:bg-accent transition-colors"
                        >
                          <p className="text-sm font-medium">{template.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{template.body}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">🔹 Para Clientes:</p>
                    <div className="grid gap-2">
                      {clientTemplates.slice(0, 5).map((template, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setTitle(template.title);
                            setBody(template.body);
                            setTemplatesOpen(false);
                          }}
                          className="text-left p-2 rounded-lg border border-border hover:bg-accent transition-colors"
                        >
                          <p className="text-sm font-medium">{template.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{template.body}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              placeholder="Ex: Novidade no GIGA S.O.S"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">{title.length}/50 caracteres</p>
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="body">Mensagem</Label>
            <Textarea
              id="body"
              placeholder="Ex: Confira as novidades do app!"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={160}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">{body.length}/160 caracteres</p>
          </div>

          {/* Scheduling Option */}
          <div className="space-y-3 p-4 border border-border rounded-lg">
            <div className="flex items-center justify-between">
              <Label htmlFor="schedule" className="flex items-center gap-2 cursor-pointer">
                <Calendar className="w-4 h-4" />
                Agendar envio
              </Label>
              <input
                type="checkbox"
                id="schedule"
                checked={scheduleEnabled}
                onChange={(e) => setScheduleEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
            </div>
            
            {scheduleEnabled && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-2">
                  <Label htmlFor="scheduledDate">Data</Label>
                  <Input
                    id="scheduledDate"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduledTime">Hora</Label>
                  <Input
                    id="scheduledTime"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 text-amber-600 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              A notificação será enviada apenas para usuários que ativaram notificações no app.
              {scheduleEnabled && ' O agendamento usa o fuso horário local.'}
            </p>
          </div>

          <Button 
            onClick={handleSendNotification} 
            disabled={sending || !title.trim() || !body.trim() || (scheduleEnabled && (!scheduledDate || !scheduledTime))}
            className="w-full"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : scheduleEnabled ? (
              <Calendar className="w-4 h-4 mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {scheduleEnabled ? 'Agendar Notificação' : 'Enviar Agora'}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Notificações Recentes
          </CardTitle>
          <CardDescription>
            Últimas 10 notificações enviadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : recentNotifications?.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma notificação enviada ainda
            </p>
          ) : (
            <div className="space-y-3">
              {recentNotifications?.map((notif) => (
                <div 
                  key={notif.id} 
                  className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                >
                  <div className="p-2 bg-primary/10 rounded-full">
                    <Bell className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{notif.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{notif.body}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(notif.sent_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 bg-secondary rounded">
                        {notif.notification_type}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scheduled Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Notificações Agendadas
          </CardTitle>
          <CardDescription>
            Notificações programadas para envio futuro
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scheduledLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : scheduledNotifications?.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma notificação agendada
            </p>
          ) : (
            <div className="space-y-3">
              {scheduledNotifications?.map((notif) => (
                <div 
                  key={notif.id} 
                  className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                >
                  <div className={`p-2 rounded-full ${
                    notif.status === 'sent' ? 'bg-green-500/10' : 
                    notif.status === 'failed' ? 'bg-destructive/10' : 
                    notif.status === 'cancelled' ? 'bg-muted' : 'bg-amber-500/10'
                  }`}>
                    {notif.status === 'sent' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : notif.status === 'failed' ? (
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{notif.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{notif.body}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        Agendado: {format(new Date(notif.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        notif.status === 'sent' ? 'bg-green-500/10 text-green-600' : 
                        notif.status === 'failed' ? 'bg-destructive/10 text-destructive' : 
                        notif.status === 'cancelled' ? 'bg-muted text-muted-foreground' : 
                        'bg-amber-500/10 text-amber-600'
                      }`}>
                        {notif.status === 'sent' ? `Enviado (${notif.sent_count}/${notif.recipients_count})` : 
                         notif.status === 'failed' ? 'Falhou' : 
                         notif.status === 'cancelled' ? 'Cancelado' : 'Pendente'}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 bg-secondary rounded">
                        {getTargetLabel(notif.target_type)}
                      </span>
                    </div>
                    {notif.status === 'failed' && notif.failure_reason && (
                      <p className="text-xs text-destructive mt-1">{notif.failure_reason}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cron Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Notificações Automáticas
          </CardTitle>
          <CardDescription>
            Agendamentos configurados para envio automático
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-full">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">Notificações Matinais</p>
                  <p className="text-xs text-muted-foreground">Todos os dias às 07:00</p>
                </div>
              </div>
              <span className="text-xs px-2 py-1 bg-green-500/10 text-green-600 rounded-full">
                Ativo
              </span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-full">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">Notificações Vespertinas</p>
                  <p className="text-xs text-muted-foreground">Todos os dias às 17:00</p>
                </div>
              </div>
              <span className="text-xs px-2 py-1 bg-green-500/10 text-green-600 rounded-full">
                Ativo
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
