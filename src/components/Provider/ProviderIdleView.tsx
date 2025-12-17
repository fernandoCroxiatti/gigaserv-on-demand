import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { MapView } from '../Map/MapView';
import { Button } from '../ui/button';
import { Power, Radar, Star, TrendingUp, Clock, DollarSign } from 'lucide-react';
import { Slider } from '../ui/slider';

export function ProviderIdleView() {
  const { user, toggleProviderOnline, setProviderRadarRange } = useApp();
  const isOnline = user.providerData?.online || false;
  const radarRange = user.providerData?.radarRange || 15;

  return (
    <div className="relative h-full provider-theme">
      {/* Map */}
      <MapView className="absolute inset-0" />

      {/* Radar range indicator */}
      {isOnline && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div 
            className="rounded-full border-2 border-provider-primary/30 bg-provider-primary/5 animate-pulse"
            style={{ 
              width: `${radarRange * 10}px`, 
              height: `${radarRange * 10}px`,
              maxWidth: '300px',
              maxHeight: '300px'
            }}
          />
        </div>
      )}

      {/* Status card */}
      <div className="absolute top-24 left-4 right-4 z-10 animate-slide-down">
        <div className={`glass-card rounded-2xl p-4 ${isOnline ? 'border-2 border-provider-primary' : ''}`}>
          <div className="flex items-center gap-4">
            <div className="relative">
              <img 
                src={user.avatar} 
                alt={user.name}
                className={`w-14 h-14 rounded-full border-2 ${isOnline ? 'border-provider-primary' : 'border-muted'}`}
              />
              {isOnline && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-provider-primary rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">{user.name}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Star className="w-4 h-4 text-status-searching fill-current" />
                <span>{user.providerData?.rating}</span>
                <span>•</span>
                <span>{user.providerData?.totalServices} serviços</span>
              </div>
            </div>
            <span className={`status-badge ${
              isOnline 
                ? 'bg-provider-primary/10 text-provider-primary' 
                : 'bg-muted text-muted-foreground'
            }`}>
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      {isOnline && (
        <div className="absolute top-44 left-4 right-4 z-10 grid grid-cols-3 gap-2 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="glass-card rounded-xl p-3 text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-provider-primary" />
            <p className="text-lg font-bold">12</p>
            <p className="text-xs text-muted-foreground">Hoje</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <Clock className="w-5 h-5 mx-auto mb-1 text-provider-primary" />
            <p className="text-lg font-bold">4.5h</p>
            <p className="text-xs text-muted-foreground">Online</p>
          </div>
          <div className="glass-card rounded-xl p-3 text-center">
            <DollarSign className="w-5 h-5 mx-auto mb-1 text-provider-primary" />
            <p className="text-lg font-bold">R$340</p>
            <p className="text-xs text-muted-foreground">Ganhos</p>
          </div>
        </div>
      )}

      {/* Bottom control panel */}
      <div className="absolute bottom-0 left-0 right-0 z-10 animate-slide-up">
        <div className="bg-card rounded-t-3xl shadow-uber-lg p-6 space-y-6">
          {/* Online toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Power className={`w-6 h-6 ${isOnline ? 'text-provider-primary' : 'text-muted-foreground'}`} />
              <div>
                <p className="font-semibold">{isOnline ? 'Você está online' : 'Você está offline'}</p>
                <p className="text-sm text-muted-foreground">
                  {isOnline ? 'Recebendo chamados' : 'Ative para receber chamados'}
                </p>
              </div>
            </div>
            <Button
              variant={isOnline ? 'provider' : 'outline'}
              onClick={toggleProviderOnline}
              size="lg"
            >
              {isOnline ? 'Ficar offline' : 'Ficar online'}
            </Button>
          </div>

          {/* Radar range slider */}
          {isOnline && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radar className="w-5 h-5 text-provider-primary" />
                  <span className="font-medium">Raio de busca</span>
                </div>
                <span className="text-lg font-bold text-provider-primary">{radarRange} km</span>
              </div>
              <Slider
                value={[radarRange]}
                onValueChange={(value) => setProviderRadarRange(value[0])}
                max={100}
                min={5}
                step={5}
                className="provider-theme"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>5 km</span>
                <span>100 km</span>
              </div>
            </div>
          )}

          {/* Tips when offline */}
          {!isOnline && (
            <div className="bg-secondary rounded-xl p-4">
              <p className="text-sm text-muted-foreground text-center">
                💡 Fique online para começar a receber chamados de clientes na sua região
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
