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
import { 
  Bell, 
  Plus, 
  Sparkles, 
  Send, 
  Eye,
  Loader2,
  Users,
  UserCog,
  UsersRound,
  Trash2,
  Check,
  Clock
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  NOTIFICATION_CONCEPTS, 
  DEFAULT_CONCEPT,
  type NotificationConcept 
} from '@/lib/notificationConcepts';
import { NotificationConceptIcon } from '@/components/Notifications/NotificationConceptIcon';

interface NotificationDraft {
  titulo: string;
  texto: string;
  image_concept: NotificationConcept;
  publico: 'cliente' | 'prestador' | 'ambos';
}

const initialDraft: NotificationDraft = {
  titulo: '',
  texto: '',
  image_concept: DEFAULT_CONCEPT,
  publico: 'ambos',
};

export default function InternalNotificationsAdmin() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<NotificationDraft>(initialDraft);
  const [isCreating, setIsCreating] = useState(false);
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showPreview, setShowPreview] = useState(false);

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
    mutationFn: async (notification: NotificationDraft & { publicada: boolean }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      // Map image_concept to imagem_url field for DB compatibility
      const { image_concept, ...rest } = notification;
      
      const { error } = await supabase
        .from('internal_notifications')
        .insert({
          ...rest,
          imagem_url: image_concept, // Store concept as string in imagem_url
          criada_por: userData.user?.id,
          publicada_em: notification.publicada ? new Date().toISOString() : null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-internal-notifications'] });
      setDraft(initialDraft);
      setIsCreating(false);
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
          image_concept: data.image_concept && data.image_concept in NOTIFICATION_CONCEPTS 
            ? data.image_concept 
            : DEFAULT_CONCEPT,
        }));
        toast.success('Texto e conceito gerados! Revise e edite conforme necessário.');
      }
    } catch (error) {
      console.error('Error generating text:', error);
      toast.error('Erro ao gerar texto');
    } finally {
      setIsGeneratingText(false);
    }
  };

  const handleSaveDraft = () => {
    if (!draft.titulo.trim() || !draft.texto.trim()) {
      toast.error('Preencha título e texto');
      return;
    }
    createMutation.mutate({ ...draft, publicada: false });
  };

  const handlePublish = () => {
    if (!draft.titulo.trim() || !draft.texto.trim()) {
      toast.error('Preencha título e texto');
      return;
    }
    createMutation.mutate({ ...draft, publicada: true });
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

              {/* Concept Icon */}
              <div className="space-y-2">
                <Label>Ícone da Notificação</Label>
                <div className="flex items-center gap-4">
                  <NotificationConceptIcon concept={draft.image_concept} size="lg" />
                  <Select
                    value={draft.image_concept}
                    onValueChange={(value) => setDraft(prev => ({ ...prev, image_concept: value as NotificationConcept }))}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Selecione o ícone" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(NOTIFICATION_CONCEPTS).map(([key, config]) => {
                        const Icon = config.icon;
                        return (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              <span>{config.label}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  A IA sugere automaticamente o ícone baseado no tema, mas você pode alterar manualmente.
                </p>
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
                      <NotificationConceptIcon concept={draft.image_concept} size="md" />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold line-clamp-2">
                          {draft.titulo || 'Título da notificação'}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                          {draft.texto || 'Texto da notificação...'}
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-2">
                          Agora mesmo
                        </p>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                    </div>
                  </CardContent>
                </Card>
              </DialogContent>
            </Dialog>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setIsCreating(false)}>
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
                  <NotificationConceptIcon concept={notification.imagem_url} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{notification.titulo}</h4>
                      <Badge variant={notification.publicada ? 'default' : 'secondary'}>
                        {notification.publicada ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Publicada
                          </>
                        ) : (
                          <>
                            <Clock className="h-3 w-3 mr-1" />
                            Rascunho
                          </>
                        )}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        {getPublicoIcon(notification.publico)}
                        {getPublicoLabel(notification.publico)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {notification.texto}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-2">
                      Criada em {format(new Date(notification.criada_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      {notification.publicada_em && (
                        <> · Publicada em {format(new Date(notification.publicada_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!notification.publicada && (
                      <Button
                        size="sm"
                        onClick={() => publishMutation.mutate(notification.id)}
                        disabled={publishMutation.isPending}
                      >
                        <Send className="h-4 w-4 mr-1" />
                        Publicar
                      </Button>
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
