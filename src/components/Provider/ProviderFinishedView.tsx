import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '../ui/button';
import { Check, DollarSign, Clock, Navigation, TrendingUp, Star, ThumbsUp, ThumbsDown, MessageCircle } from 'lucide-react';

type FeedbackTag = 'educado' | 'comunicativo' | 'problematico';

export function ProviderFinishedView() {
  const { chamado, user, submitReview, resetChamado } = useApp();
  const [showRating, setShowRating] = useState(false);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [selectedTags, setSelectedTags] = useState<FeedbackTag[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!chamado) return null;

  const toggleTag = (tag: FeedbackTag) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await submitReview(rating, selectedTags, feedback);
    setIsSubmitting(false);
  };

  const handleBackToMap = () => {
    if (showRating) {
      resetChamado();
    } else {
      setShowRating(true);
    }
  };

  if (showRating) {
    return (
      <div className="h-full bg-gradient-to-b from-provider-primary/5 to-background flex flex-col items-center justify-center p-4 provider-theme">
        <div className="w-full max-w-sm animate-scale-in">
          {/* Title - compact */}
          <div className="text-center mb-5">
            <h1 className="text-xl font-bold mb-1">Avaliar cliente</h1>
            <p className="text-sm text-muted-foreground">Como foi a experiência?</p>
          </div>

          {/* Rating card - compact */}
          <div className="bg-card rounded-xl shadow-card p-4 mb-4">
            {/* Rating stars - compact */}
            <div className="flex justify-center gap-1.5 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="transition-transform hover:scale-110 active:scale-95"
                >
                  <Star 
                    className={`w-8 h-8 ${
                      star <= rating 
                        ? 'text-provider-primary fill-current' 
                        : 'text-muted'
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Quick feedback tags - compact */}
            <div className="flex justify-center gap-2 mb-4 flex-wrap">
              <button 
                onClick={() => toggleTag('educado')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${
                  selectedTags.includes('educado')
                    ? 'bg-provider-primary text-white shadow-sm'
                    : 'bg-secondary hover:bg-secondary/80'
                }`}
              >
                <ThumbsUp className="w-3 h-3" />
                Educado
              </button>
              <button 
                onClick={() => toggleTag('comunicativo')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${
                  selectedTags.includes('comunicativo')
                    ? 'bg-provider-primary text-white shadow-sm'
                    : 'bg-secondary hover:bg-secondary/80'
                }`}
              >
                <MessageCircle className="w-3 h-3" />
                Comunicativo
              </button>
              <button 
                onClick={() => toggleTag('problematico')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${
                  selectedTags.includes('problematico')
                    ? 'bg-destructive text-destructive-foreground shadow-sm'
                    : 'bg-secondary hover:bg-secondary/80'
                }`}
              >
                <ThumbsDown className="w-3 h-3" />
                Problemático
              </button>
            </div>

            {/* Comment input - compact */}
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Deixe um comentário (opcional)"
              className="w-full bg-secondary/80 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-provider-primary/50"
              rows={2}
            />
          </div>

          {/* Submit button - wider */}
          <Button 
            variant="provider"
            className="w-full h-11" 
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Enviando...' : 'Enviar avaliação'}
          </Button>

          <button 
            className="w-full text-center text-xs text-muted-foreground mt-3 hover:text-foreground transition-colors"
            onClick={resetChamado}
            disabled={isSubmitting}
          >
            Pular
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gradient-to-b from-provider-primary/5 to-background flex flex-col items-center justify-center p-4 provider-theme">
      <div className="w-full max-w-sm animate-scale-in">
        {/* Success icon - compact */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="w-16 h-16 bg-provider-primary rounded-full flex items-center justify-center shadow-lg">
              <Check className="w-8 h-8 text-white" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-provider-primary/30 animate-ping" />
          </div>
        </div>

        {/* Title - compact */}
        <div className="text-center mb-5">
          <h1 className="text-xl font-bold mb-1">Serviço finalizado!</h1>
          <p className="text-sm text-muted-foreground">Parabéns pelo trabalho</p>
        </div>

        {/* Earnings card - compact and premium */}
        <div className="bg-card rounded-xl shadow-card p-4 mb-4">
          <div className="text-center mb-4">
            <p className="text-xs text-muted-foreground mb-0.5">Você ganhou</p>
            <div className="flex items-center justify-center gap-1.5">
              <DollarSign className="w-6 h-6 text-provider-primary" />
              <span className="text-3xl font-bold">R$ {chamado.valor?.toFixed(2)}</span>
            </div>
          </div>

          {/* Service stats - compact */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center mx-auto mb-1">
                <Navigation className="w-4 h-4 text-provider-primary" />
              </div>
              <p className="text-sm font-semibold">--</p>
              <p className="text-[10px] text-muted-foreground">Percorrido</p>
            </div>
            <div className="text-center">
              <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center mx-auto mb-1">
                <Clock className="w-4 h-4 text-provider-primary" />
              </div>
              <p className="text-sm font-semibold">--</p>
              <p className="text-[10px] text-muted-foreground">Duração</p>
            </div>
            <div className="text-center">
              <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center mx-auto mb-1">
                <TrendingUp className="w-4 h-4 text-provider-primary" />
              </div>
              <p className="text-sm font-semibold">{user?.providerData?.totalServices || 0}</p>
              <p className="text-[10px] text-muted-foreground">Total</p>
            </div>
          </div>
        </div>

        {/* Continue button - wider */}
        <Button variant="provider" className="w-full h-11" onClick={handleBackToMap}>
          Avaliar cliente
        </Button>

        <button 
          className="w-full text-center text-xs text-muted-foreground mt-3 hover:text-foreground transition-colors"
          onClick={resetChamado}
        >
          Pular avaliação
        </button>
      </div>
    </div>
  );
}
