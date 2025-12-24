import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import gigaLogo from '@/assets/giga-logo.png';

interface ProfileSelectionScreenProps {
  onSelectClient?: () => void;
  onSelectProvider?: () => void;
  isLoading?: boolean;
}

/**
 * Welcome/Presentation Screen - Shows before login
 * Simple presentation with logo and "Começar" button
 * This is a static screen that doesn't depend on backend data
 */
export const ProfileSelectionScreen: React.FC<ProfileSelectionScreenProps> = ({
  isLoading = false,
}) => {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Logo */}
        <img 
          src={gigaLogo} 
          alt="GIGA Logo" 
          className="w-40 h-40 rounded-3xl shadow-lg mb-8"
        />

        <h1 className="text-3xl font-bold text-foreground mb-3">
          Bem-vindo ao GIGA
        </h1>
        
        <p className="text-muted-foreground text-center mb-12 max-w-xs">
          Serviços de guincho, borracharia e assistência veicular na palma da sua mão
        </p>

        {/* Start button */}
        <Button
          onClick={handleStart}
          disabled={isLoading}
          size="lg"
          className="w-full max-w-xs text-lg py-6"
        >
          Começar
        </Button>
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
