import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  ArrowLeft, 
  User, 
  FileText, 
  CreditCard, 
  Phone, 
  Mail, 
  Edit, 
  LogOut,
  Plus,
  Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ClientRequestsList } from './ClientRequestsList';

export function ClientProfile() {
  const { user, profile } = useApp();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');

  const [savedCards, setSavedCards] = useState<Array<{id: string; last4: string; brand: string}>>([]);
  const [showAddCard, setShowAddCard] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border p-4 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Minha Conta</h1>
        </div>
      </div>

      {/* Profile header */}
      <div className="p-6 bg-gradient-to-b from-primary/10 to-background">
        <div className="flex items-center gap-4">
          <img 
            src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name}`}
            alt={user?.name}
            className="w-20 h-20 rounded-full border-4 border-background shadow-lg"
          />
          <div className="flex-1">
            <h2 className="text-2xl font-bold">{user?.name}</h2>
            <p className="text-muted-foreground">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="p-4">
        <TabsList className="w-full grid grid-cols-3 mb-6">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Perfil</span>
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Solicitações</span>
          </TabsTrigger>
          <TabsTrigger value="payment" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            <span className="hidden sm:inline">Pagamento</span>
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <div className="bg-card rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Informações pessoais</h3>
              <Button variant="ghost" size="sm" onClick={() => setEditMode(!editMode)}>
                <Edit className="w-4 h-4 mr-2" />
                {editMode ? 'Cancelar' : 'Editar'}
              </Button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-secondary rounded-xl">
                <User className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Nome</p>
                  {editMode ? (
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-transparent font-medium focus:outline-none w-full"
                    />
                  ) : (
                    <p className="font-medium">{user?.name}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-secondary rounded-xl">
                <Phone className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  {editMode ? (
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="bg-transparent font-medium focus:outline-none w-full"
                    />
                  ) : (
                    <p className="font-medium">{user?.phone || 'Não informado'}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-secondary rounded-xl">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">E-mail</p>
                  <p className="font-medium">{user?.email}</p>
                </div>
              </div>
            </div>

            {editMode && (
              <Button className="w-full" onClick={() => setEditMode(false)}>
                Salvar alterações
              </Button>
            )}
          </div>

          {/* Logout */}
          <Button 
            variant="outline" 
            className="w-full text-destructive hover:text-destructive"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair da conta
          </Button>
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests">
          <ClientRequestsList />
        </TabsContent>

        {/* Payment Tab */}
        <TabsContent value="payment" className="space-y-4">
          <div className="bg-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Formas de pagamento</h3>
              <Button variant="outline" size="sm" onClick={() => setShowAddCard(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
            </div>

            {savedCards.length === 0 ? (
              <div className="text-center py-8">
                <CreditCard className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Nenhum cartão cadastrado</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Adicione um cartão para pagamentos mais rápidos
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedCards.map((card) => (
                  <div key={card.id} className="flex items-center gap-4 p-4 bg-secondary rounded-xl">
                    <CreditCard className="w-8 h-8 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium">{card.brand}</p>
                      <p className="text-sm text-muted-foreground">**** **** **** {card.last4}</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setSavedCards(prev => prev.filter(c => c.id !== card.id))}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {showAddCard && (
              <div className="mt-4 p-4 border border-border rounded-xl space-y-4">
                <h4 className="font-medium">Adicionar novo cartão</h4>
                <p className="text-sm text-muted-foreground">
                  A integração com Stripe será ativada em breve para pagamentos seguros.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowAddCard(false)}>
                    Cancelar
                  </Button>
                  <Button disabled>Em breve</Button>
                </div>
              </div>
            )}
          </div>

          {/* PIX always available */}
          <div className="bg-card rounded-2xl p-6">
            <h3 className="font-semibold text-lg mb-4">Outras opções</h3>
            <div className="flex items-center gap-4 p-4 bg-secondary rounded-xl">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-lg">💸</span>
              </div>
              <div className="flex-1">
                <p className="font-medium">PIX</p>
                <p className="text-sm text-muted-foreground">Pagamento instantâneo</p>
              </div>
              <span className="text-sm text-primary font-medium">Disponível</span>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
