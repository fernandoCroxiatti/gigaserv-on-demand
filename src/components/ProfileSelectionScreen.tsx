import React from 'react';
import { User, Truck } from 'lucide-react';

interface ProfileSelectionScreenProps {
  onSelectClient: () => void;
  onSelectProvider: () => void;
  isLoading?: boolean;
}

/**
 * Profile Selection Screen - Shows before any session verification
 * Allows user to choose between Client and Provider modes
 * This is a static screen that doesn't depend on backend data
 */
export const ProfileSelectionScreen: React.FC<ProfileSelectionScreenProps> = ({
  onSelectClient,
  onSelectProvider,
  isLoading = false,
}) => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Logo/branding */}
        <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center shadow-lg mb-6">
          <svg 
            className="w-12 h-12 text-primary-foreground" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" 
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          Bem-vindo ao GigaServ
        </h1>
        
        <p className="text-muted-foreground text-center mb-10">
          Como você deseja usar o app?
        </p>

        {/* Profile selection cards */}
        <div className="w-full max-w-sm space-y-4">
          {/* Client option */}
          <button
            onClick={onSelectClient}
            disabled={isLoading}
            className="w-full p-6 bg-card border border-border rounded-xl flex items-center gap-4 hover:bg-accent transition-colors disabled:opacity-50"
          >
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-7 h-7 text-primary" />
            </div>
            <div className="text-left flex-1">
              <h2 className="text-lg font-semibold text-foreground">
                Sou Cliente
              </h2>
              <p className="text-sm text-muted-foreground">
                Preciso de guincho, borracharia ou outro serviço
              </p>
            </div>
          </button>

          {/* Provider option */}
          <button
            onClick={onSelectProvider}
            disabled={isLoading}
            className="w-full p-6 bg-card border border-border rounded-xl flex items-center gap-4 hover:bg-accent transition-colors disabled:opacity-50"
          >
            <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Truck className="w-7 h-7 text-amber-500" />
            </div>
            <div className="text-left flex-1">
              <h2 className="text-lg font-semibold text-foreground">
                Sou Prestador
              </h2>
              <p className="text-sm text-muted-foreground">
                Ofereço serviços de guincho, mecânica ou outros
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 text-center">
        <p className="text-xs text-muted-foreground">
          Ao continuar, você concorda com nossos{' '}
          <a href="/terms" className="text-primary underline">Termos de Uso</a>
          {' '}e{' '}
          <a href="/privacy" className="text-primary underline">Política de Privacidade</a>
        </p>
      </div>
    </div>
  );
};

export default ProfileSelectionScreen;
