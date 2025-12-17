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
      <div className="h-full bg-gradient-to-b from-provider-primary/10 to-background flex flex-col items-center justify-center p-6 provider-theme">
        <div className="w-full max-w-md animate-scale-in">
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">Avaliar cliente</h1>
            <p className="text-muted-foreground">Como foi a experiência com este cliente?</p>
          </div>

          {/* Rating card */}
          <div className="bg-card rounded-2xl shadow-uber p-6 mb-6">
            {/* Rating stars */}
            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="transition-transform hover:scale-110 active:scale-95"
                >
                  <Star 
                    className={`w-10 h-10 ${
                      star <= rating 
                        ? 'text-provider-primary fill-current' 
                        : 'text-muted'
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Quick feedback tags */}
            <div className="flex justify-center gap-3 mb-6 flex-wrap">
              <button 
                onClick={() => toggleTag('educado')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all ${
                  selectedTags.includes('educado')
                    ? 'bg-provider-primary text-white'
                    : 'bg-secondary hover:bg-secondary/80'
                }`}
              >
                <ThumbsUp className="w-4 h-4" />
                Educado
              </button>
              <button 
                onClick={() => toggleTag('comunicativo')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all ${
                  selectedTags.includes('comunicativo')
                    ? 'bg-provider-primary text-white'
                    : 'bg-secondary hover:bg-secondary/80'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                Comunicativo
              </button>
              <button 
                onClick={() => toggleTag('problematico')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all ${
                  selectedTags.includes('problematico')
                    ? 'bg-destructive text-destructive-foreground'
                    : 'bg-secondary hover:bg-secondary/80'
                }`}
              >
                <ThumbsDown className="w-4 h-4" />
                Problemático
              </button>
            </div>

            {/* Comment input */}
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Deixe um comentário (opcional)"
              className="w-full bg-secondary rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-provider-primary"
              rows={3}
            />
          </div>

          {/* Submit button */}
          <Button 
            variant="provider"
            className="w-full" 
            size="lg"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Enviando...' : 'Enviar avaliação'}
          </Button>

          <button 
            className="w-full text-center text-sm text-muted-foreground mt-4 hover:text-foreground transition-colors"
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
    <div className="h-full bg-gradient-to-b from-provider-primary/10 to-background flex flex-col items-center justify-center p-6 provider-theme">
      <div className="w-full max-w-md animate-scale-in">
        {/* Success icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-24 h-24 bg-provider-primary rounded-full flex items-center justify-center">
              <Check className="w-12 h-12 text-white" />
            </div>
            <div className="absolute inset-0 rounded-full border-4 border-provider-primary/30 animate-ping" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Serviço finalizado!</h1>
          <p className="text-muted-foreground">Parabéns pelo trabalho concluído</p>
        </div>

        {/* Earnings card */}
        <div className="bg-card rounded-2xl shadow-uber p-6 mb-6">
          <div className="text-center mb-6">
            <p className="text-sm text-muted-foreground mb-1">Você ganhou</p>
            <div className="flex items-center justify-center gap-2">
              <DollarSign className="w-8 h-8 text-provider-primary" />
              <span className="text-4xl font-bold">R$ {chamado.valor?.toFixed(2)}</span>
            </div>
          </div>

          {/* Service stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center mx-auto mb-2">
                <Navigation className="w-5 h-5 text-provider-primary" />
              </div>
              <p className="text-lg font-semibold">--</p>
              <p className="text-xs text-muted-foreground">Percorrido</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center mx-auto mb-2">
                <Clock className="w-5 h-5 text-provider-primary" />
              </div>
              <p className="text-lg font-semibold">--</p>
              <p className="text-xs text-muted-foreground">Duração</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center mx-auto mb-2">
                <TrendingUp className="w-5 h-5 text-provider-primary" />
              </div>
              <p className="text-lg font-semibold">{user?.providerData?.totalServices || 0}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </div>

        {/* Continue button */}
        <Button variant="provider" className="w-full" size="lg" onClick={handleBackToMap}>
          Avaliar cliente
        </Button>

        <button 
          className="w-full text-center text-sm text-muted-foreground mt-4 hover:text-foreground transition-colors"
          onClick={resetChamado}
        >
          Pular avaliação
        </button>
      </div>
    </div>
  );
}
