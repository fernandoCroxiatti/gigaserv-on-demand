import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { Star, User, Phone, Mail, MapPin, Car } from 'lucide-react';
import { AvatarUpload } from '@/components/Profile/AvatarUpload';

interface ProviderProfileTabProps {
  rating?: number;
  totalServices?: number;
}

export function ProviderProfileTab({ rating = 5.0, totalServices = 0 }: ProviderProfileTabProps) {
  const { user, providerData } = useApp();

  return (
    <div className="space-y-6 p-4">
      {/* Profile Header */}
      <div className="bg-card rounded-2xl p-6 text-center">
        <div className="relative inline-block mb-4">
          <AvatarUpload 
            currentAvatar={user?.avatar}
            userName={user?.name}
            size="lg"
          />
          {providerData?.is_online && (
            <div className="absolute bottom-0 right-8 w-6 h-6 bg-status-finished rounded-full border-2 border-background flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full" />
            </div>
          )}
        </div>
        <h2 className="text-2xl font-bold">{user?.name}</h2>
        
        {/* Rating */}
        <div className="flex items-center justify-center gap-2 mt-3">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star 
              key={star}
              className={`w-6 h-6 ${
                star <= Math.round(rating)
                  ? 'text-status-searching fill-current'
                  : 'text-muted'
              }`}
            />
          ))}
        </div>
        <p className="text-3xl font-bold mt-2">{rating.toFixed(1)}</p>
        <p className="text-muted-foreground text-sm">
          Baseado em {totalServices} serviços
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl p-4 text-center">
          <p className="text-4xl font-bold text-provider-primary">{totalServices}</p>
          <p className="text-sm text-muted-foreground mt-1">Total de Corridas</p>
        </div>
        <div className="bg-card rounded-2xl p-4 text-center">
          <p className="text-4xl font-bold text-provider-primary">{rating.toFixed(1)}</p>
          <p className="text-sm text-muted-foreground mt-1">Avaliação Média</p>
        </div>
      </div>

      {/* Personal Info */}
      <div className="bg-card rounded-2xl p-6 space-y-4">
        <h3 className="font-semibold text-lg">Informações Pessoais</h3>
        
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-3 bg-secondary rounded-xl">
            <User className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Nome</p>
              <p className="font-medium">{user?.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-3 bg-secondary rounded-xl">
            <Phone className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Telefone</p>
              <p className="font-medium">{user?.phone || 'Não informado'}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-3 bg-secondary rounded-xl">
            <Mail className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">E-mail</p>
              <p className="font-medium">{user?.email}</p>
            </div>
          </div>

          {providerData?.vehicle_plate && (
            <div className="flex items-center gap-4 p-3 bg-secondary rounded-xl">
              <Car className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Placa do Veículo</p>
                <p className="font-medium">{providerData.vehicle_plate}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}