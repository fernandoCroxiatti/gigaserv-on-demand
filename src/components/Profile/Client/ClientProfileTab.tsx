import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { User, Phone, Mail, Edit, Star, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ClientProfileTabProps {
  totalRides: number;
  averageRating?: number;
}

export function ClientProfileTab({ totalRides, averageRating }: ClientProfileTabProps) {
  const { user, profile } = useApp();
  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name, phone })
        .eq('user_id', profile?.user_id);

      if (error) {
        toast.error('Erro ao salvar alterações');
        return;
      }

      toast.success('Perfil atualizado com sucesso');
      setEditMode(false);
    } catch (err) {
      toast.error('Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* Profile Header Card */}
      <div className="bg-card rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <img 
            src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name}`}
            alt={user?.name}
            className="w-20 h-20 rounded-full border-4 border-primary/20 shadow-lg"
          />
          <div className="flex-1">
            <h2 className="text-xl font-bold">{user?.name}</h2>
            <p className="text-muted-foreground text-sm">{user?.email}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-secondary rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Star className="w-5 h-5 text-status-searching fill-current" />
              <span className="text-2xl font-bold">{averageRating?.toFixed(1) || '-'}</span>
            </div>
            <p className="text-xs text-muted-foreground">Avaliação média</p>
          </div>
          <div className="bg-secondary rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Car className="w-5 h-5 text-primary" />
              <span className="text-2xl font-bold">{totalRides}</span>
            </div>
            <p className="text-xs text-muted-foreground">Corridas realizadas</p>
          </div>
        </div>
      </div>

      {/* Personal Info */}
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
          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        )}
      </div>
    </div>
  );
}
