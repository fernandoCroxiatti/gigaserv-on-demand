import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '../ui/button';
import { Star, Check, ThumbsUp, ThumbsDown, Clock } from 'lucide-react';

type FeedbackTag = 'excelente' | 'pontual' | 'melhorar';

export function ClientFinishedView() {
  const { chamado, availableProviders, submitReview, resetChamado } = useApp();
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [selectedTags, setSelectedTags] = useState<FeedbackTag[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!chamado) return null;

  const provider = availableProviders.find(p => p.id === chamado.prestadorId);

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

  const handleSkip = () => {
    resetChamado();
  };

  return (
    <div className="h-full bg-gradient-to-b from-primary/5 to-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm animate-scale-in">
        {/* Success icon - compact */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="w-16 h-16 bg-status-finished rounded-full flex items-center justify-center shadow-lg">
              <Check className="w-8 h-8 text-white" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-status-finished/30 animate-ping" />
          </div>
        </div>

        {/* Title - compact */}
        <div className="text-center mb-5">
          <h1 className="text-xl font-bold mb-1">Serviço finalizado!</h1>
          <p className="text-sm text-muted-foreground">Como foi sua experiência?</p>
        </div>

        {/* Provider card - compact and premium */}
        <div className="bg-card rounded-xl shadow-card p-4 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <img 
              src={provider?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=Provider`} 
              alt={provider?.name || 'Prestador'}
              className="w-12 h-12 rounded-full shadow-sm"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{provider?.name || 'Prestador'}</h3>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="w-3 h-3 text-status-searching fill-current" />
                <span>{provider?.rating?.toFixed(1) || '5.0'}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total pago</p>
              <p className="text-lg font-bold text-primary">R$ {chamado.valor?.toFixed(2)}</p>
            </div>
          </div>

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
                      ? 'text-status-searching fill-current' 
                      : 'text-muted'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Quick feedback tags - compact */}
          <div className="flex justify-center gap-2 mb-4 flex-wrap">
            <button 
              onClick={() => toggleTag('excelente')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${
                selectedTags.includes('excelente')
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              <ThumbsUp className="w-3 h-3" />
              Excelente
            </button>
            <button 
              onClick={() => toggleTag('pontual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${
                selectedTags.includes('pontual')
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              <Clock className="w-3 h-3" />
              Pontual
            </button>
            <button 
              onClick={() => toggleTag('melhorar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${
                selectedTags.includes('melhorar')
                  ? 'bg-destructive text-destructive-foreground shadow-sm'
                  : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              <ThumbsDown className="w-3 h-3" />
              Melhorar
            </button>
          </div>

          {/* Comment input - compact */}
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Deixe um comentário (opcional)"
            className="w-full bg-secondary/80 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
            rows={2}
          />
        </div>

        {/* Submit button - wider */}
        <Button 
          className="w-full h-11" 
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Enviando...' : 'Enviar avaliação'}
        </Button>

        <button 
          className="w-full text-center text-xs text-muted-foreground mt-3 hover:text-foreground transition-colors"
          onClick={handleSkip}
          disabled={isSubmitting}
        >
          Pular
        </button>
      </div>
    </div>
  );
}
