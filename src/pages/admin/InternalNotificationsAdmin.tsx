import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { 
  Bell, 
  Plus, 
  Sparkles, 
  Image as ImageIcon,
  Send, 
  Eye,
  Loader2,
  Users,
  UserCog,
  UsersRound,
  Trash2,
  Check,
  Clock,
  Calendar,
  CalendarClock
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface NotificationDraft {
  titulo: string;
  texto: string;
  imagem_url: string;
  publico: 'cliente' | 'prestador' | 'ambos';
  agendada_para: string;
}

const initialDraft: NotificationDraft = {
  titulo: '',
  texto: '',
  imagem_url: '',
  publico: 'ambos',
  agendada_para: '',
};

export default function InternalNotificationsAdmin() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<NotificationDraft>(initialDraft);
  const [isCreating, setIsCreating] = useState(false);
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);

  // Fetch all notifications (including unpublished)
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['admin-internal-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('internal_notifications')
        .select('*')
        .order('criada_em', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Create notification
  const createMutation = useMutation({
    mutationFn: async (notification: NotificationDraft & { status: string; publicada: boolean }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('internal_notifications')
        .insert({
          titulo: notification.titulo,
          texto: notification.texto,
          imagem_url: notification.imagem_url || null,
          publico: notification.publico,
          agendada_para: notification.agendada_para || null,
          status: notification.status,
          publicada: notification.publicada,
          criada_por: userData.user?.id,
          publicada_em: notification.publicada ? new Date().toISOString() : null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-internal-notifications'] });
      setDraft(initialDraft);
      setIsCreating(false);
      setScheduleEnabled(false);
      toast.success('Notificação criada com sucesso!');
    },
    onError: (error) => {
      console.error('Error creating notification:', error);
      toast.error('Erro ao criar notificação');
    },
  });

  // Publish notification
  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('internal_notifications')
        .update({ 
          status: 'publicada',
          publicada: true,
          publicada_em: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-internal-notifications'] });
      toast.success('Notificação publicada!');
    },
    onError: () => {
      toast.error('Erro ao publicar notificação');
    },
  });

  // Cancel scheduled notification
  const cancelScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('internal_notifications')
        .update({ 
          status: 'rascunho',
          agendada_para: null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-internal-notifications'] });
      toast.success('Agendamento cancelado');
    },
    onError: () => {
      toast.error('Erro ao cancelar agendamento');
    },
  });

  // Delete notification
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('internal_notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-internal-notifications'] });
      toast.success('Notificação removida');
    },
    onError: () => {
      toast.error('Erro ao remover notificação');
    },
  });

  // Generate text with AI
  const generateText = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Digite um tema para a IA gerar o texto');
      return;
    }

    setIsGeneratingText(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-notification-text', {
        body: { prompt: aiPrompt },
      });

      if (error) throw error;

      if (data?.titulo && data?.texto) {
        setDraft(prev => ({
          ...prev,
          titulo: data.titulo,
          texto: data.texto,
        }));
        toast.success('Texto gerado! Revise e edite conforme necessário.');
      }
    } catch (error) {
      console.error('Error generating text:', error);
      toast.error('Erro ao gerar texto');
    } finally {
      setIsGeneratingText(false);
    }
  };

  // Generate image with AI
  const generateImage = async () => {
    if (!draft.titulo.trim()) {
      toast.error('Preencha o título antes de gerar a ilustração');
      return;
    }

    setIsGeneratingImage(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-notification-image', {
        body: { 
          titulo: draft.titulo,
          texto: draft.texto,
        },
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setDraft(prev => ({
          ...prev,
          imagem_url: data.imageUrl,
        }));
        toast.success('Ilustração gerada!');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      toast.error('Erro ao gerar ilustração');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSaveDraft = () => {
    if (!draft.titulo.trim() || !draft.texto.trim()) {
      toast.error('Preencha título e texto');
      return;
    }
    createMutation.mutate({ ...draft, status: 'rascunho', publicada: false });
  };

  const handleSchedule = () => {
    if (!draft.titulo.trim() || !draft.texto.trim()) {
      toast.error('Preencha título e texto');
      return;
    }
    if (!draft.agendada_para) {
      toast.error('Selecione data e hora para agendar');
      return;
    }
    const scheduledDate = new Date(draft.agendada_para);
    if (scheduledDate <= new Date()) {
      toast.error('A data de agendamento deve ser no futuro');
      return;
    }
    createMutation.mutate({ ...draft, status: 'agendada', publicada: false });
  };

  const handlePublish = () => {
    if (!draft.titulo.trim() || !draft.texto.trim()) {
      toast.error('Preencha título e texto');
      return;
    }
    createMutation.mutate({ ...draft, status: 'publicada', publicada: true });
  };

  const getPublicoLabel = (publico: string) => {
    switch (publico) {
      case 'cliente': return 'Clientes';
      case 'prestador': return 'Prestadores';
      default: return 'Todos';
    }
  };

  const getPublicoIcon = (publico: string) => {
    switch (publico) {
      case 'cliente': return <Users className="h-4 w-4" />;
      case 'prestador': return <UserCog className="h-4 w-4" />;
      default: return <UsersRound className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (notification: any) => {
    switch (notification.status) {
      case 'publicada':
        return (
          <Badge variant="default" className="bg-green-600">
            <Check className="h-3 w-3 mr-1" />
            Publicada
          </Badge>
        );
      case 'agendada':
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            <CalendarClock className="h-3 w-3 mr-1" />
            Agendada
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Rascunho
          </Badge>
        );
    }
  };

  // Get min datetime for scheduling (now + 5 minutes)
  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    return now.toISOString().slice(0, 16);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Notificações Internas
          </h1>
          <p className="text-muted-foreground">
            Crie e gerencie notificações para usuários do app
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)} disabled={isCreating}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Notificação
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
                <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Publicadas</p>
                <p className="text-2xl font-bold">
                  {notifications.filter(n => n.status === 'publicada').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                <CalendarClock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Agendadas</p>
                <p className="text-2xl font-bold">
                  {notifications.filter(n => n.status === 'agendada').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-gray-100 dark:bg-gray-800">
                <Clock className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rascunhos</p>
                <p className="text-2xl font-bold">
                  {notifications.filter(n => n.status === 'rascunho').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Creation Form */}
      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>Criar Notificação</CardTitle>
            <CardDescription>
              Use a IA para ajudar a criar o conteúdo ou escreva manualmente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* AI Assistant */}
            <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-medium">Assistente IA</span>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Descreva o tema da notificação (ex: promoção de 10% desconto, manutenção do sistema...)"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  onClick={generateText} 
                  disabled={isGeneratingText}
                  variant="secondary"
                >
                  {isGeneratingText ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Gerar Texto
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Form Fields */}
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="titulo">Título</Label>
                <Input
                  id="titulo"
                  placeholder="Título curto e objetivo"
                  value={draft.titulo}
                  onChange={(e) => setDraft(prev => ({ ...prev, titulo: e.target.value }))}
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">{draft.titulo.length}/100</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="texto">Texto</Label>
                <Textarea
                  id="texto"
                  placeholder="Texto da notificação (2 a 4 linhas)"
                  value={draft.texto}
                  onChange={(e) => setDraft(prev => ({ ...prev, texto: e.target.value }))}
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">{draft.texto.length}/500</p>
              </div>

              <div className="space-y-2">
                <Label>Público-alvo</Label>
                <RadioGroup
                  value={draft.publico}
                  onValueChange={(value) => setDraft(prev => ({ ...prev, publico: value as any }))}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ambos" id="ambos" />
                    <Label htmlFor="ambos" className="flex items-center gap-1.5 cursor-pointer">
                      <UsersRound className="h-4 w-4" />
                      Todos
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cliente" id="cliente" />
                    <Label htmlFor="cliente" className="flex items-center gap-1.5 cursor-pointer">
                      <Users className="h-4 w-4" />
                      Clientes
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="prestador" id="prestador" />
                    <Label htmlFor="prestador" className="flex items-center gap-1.5 cursor-pointer">
                      <UserCog className="h-4 w-4" />
                      Prestadores
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Image */}
              <div className="space-y-2">
                <Label>Ilustração (opcional)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="URL da imagem ou gere com IA"
                    value={draft.imagem_url}
                    onChange={(e) => setDraft(prev => ({ ...prev, imagem_url: e.target.value }))}
                    className="flex-1"
                  />
                  <Button 
                    onClick={generateImage} 
                    disabled={isGeneratingImage || !draft.titulo.trim()}
                    variant="outline"
                  >
                    {isGeneratingImage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Gerar IA
                      </>
                    )}
                  </Button>
                </div>
                {draft.imagem_url && (
                  <img 
                    src={draft.imagem_url} 
                    alt="Preview" 
                    className="w-32 h-32 rounded-lg object-cover mt-2"
                  />
                )}
              </div>

              {/* Scheduling */}
              <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <Label htmlFor="schedule-toggle" className="font-medium">Agendar publicação</Label>
                  </div>
                  <Switch
                    id="schedule-toggle"
                    checked={scheduleEnabled}
                    onCheckedChange={(checked) => {
                      setScheduleEnabled(checked);
                      if (!checked) {
                        setDraft(prev => ({ ...prev, agendada_para: '' }));
                      }
                    }}
                  />
                </div>
                
                {scheduleEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="agendada_para">Data e hora</Label>
                    <Input
                      id="agendada_para"
                      type="datetime-local"
                      min={getMinDateTime()}
                      value={draft.agendada_para}
                      onChange={(e) => setDraft(prev => ({ ...prev, agendada_para: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      A notificação será publicada automaticamente na data/hora selecionada
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Preview */}
            <Dialog open={showPreview} onOpenChange={setShowPreview}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Eye className="h-4 w-4 mr-2" />
                  Visualizar Preview
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Preview da Notificação</DialogTitle>
                  <DialogDescription>
                    Como aparecerá para o usuário
                  </DialogDescription>
                </DialogHeader>
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      {draft.imagem_url && (
                        <img
                          src={draft.imagem_url}
                          alt=""
                          className="w-16 h-16 rounded-lg object-cover bg-muted flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold line-clamp-2">
                          {draft.titulo || 'Título da notificação'}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                          {draft.texto || 'Texto da notificação...'}
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-2">
                          {scheduleEnabled && draft.agendada_para 
                            ? format(new Date(draft.agendada_para), "dd/MM 'às' HH:mm", { locale: ptBR })
                            : 'Agora mesmo'
                          }
                        </p>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                    </div>
                  </CardContent>
                </Card>
              </DialogContent>
            </Dialog>

            {/* Actions */}
            <div className="flex gap-3 justify-end flex-wrap">
              <Button variant="ghost" onClick={() => { setIsCreating(false); setScheduleEnabled(false); }}>
                Cancelar
              </Button>
              <Button 
                variant="outline" 
                onClick={handleSaveDraft}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Clock className="h-4 w-4 mr-2" />
                )}
                Salvar Rascunho
              </Button>
              {scheduleEnabled ? (
                <Button 
                  onClick={handleSchedule}
                  disabled={createMutation.isPending || !draft.agendada_para}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CalendarClock className="h-4 w-4 mr-2" />
                  )}
                  Agendar
                </Button>
              ) : (
                <Button 
                  onClick={handlePublish}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Publicar Agora
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notifications List */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Notificações</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma notificação criada ainda
            </div>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-start gap-4 p-4 rounded-lg border bg-card"
                >
                  {notification.imagem_url && (
                    <img
                      src={notification.imagem_url}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover bg-muted flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-medium">{notification.titulo}</h4>
                      {getStatusBadge(notification)}
                      <Badge variant="outline" className="gap-1">
                        {getPublicoIcon(notification.publico)}
                        {getPublicoLabel(notification.publico)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {notification.texto}
                    </p>
                    <div className="text-xs text-muted-foreground/60 mt-2 space-y-0.5">
                      <p>
                        Criada em {format(new Date(notification.criada_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                      {notification.status === 'agendada' && notification.agendada_para && (
                        <p className="text-blue-600 dark:text-blue-400 font-medium">
                          <CalendarClock className="h-3 w-3 inline mr-1" />
                          Agendada para {format(new Date(notification.agendada_para), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      )}
                      {notification.publicada_em && (
                        <p>Publicada em {format(new Date(notification.publicada_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {notification.status === 'rascunho' && (
                      <Button
                        size="sm"
                        onClick={() => publishMutation.mutate(notification.id)}
                        disabled={publishMutation.isPending}
                      >
                        <Send className="h-4 w-4 mr-1" />
                        Publicar
                      </Button>
                    )}
                    {notification.status === 'agendada' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => publishMutation.mutate(notification.id)}
                          disabled={publishMutation.isPending}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Publicar Agora
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancelScheduleMutation.mutate(notification.id)}
                          disabled={cancelScheduleMutation.isPending}
                        >
                          Cancelar
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm('Remover esta notificação?')) {
                          deleteMutation.mutate(notification.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
