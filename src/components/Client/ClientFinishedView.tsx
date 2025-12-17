import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '../ui/button';
import { Star, Check, ThumbsUp, ThumbsDown, MessageCircle, Clock } from 'lucide-react';

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
    <div className="h-full bg-gradient-to-b from-primary/10 to-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md animate-scale-in">
        {/* Success icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-24 h-24 bg-status-finished rounded-full flex items-center justify-center">
              <Check className="w-12 h-12 text-white" />
            </div>
            <div className="absolute inset-0 rounded-full border-4 border-status-finished/30 animate-ping" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Serviço finalizado!</h1>
          <p className="text-muted-foreground">Como foi sua experiência?</p>
        </div>

        {/* Provider card */}
        <div className="bg-card rounded-2xl shadow-uber p-6 mb-6">
          <div className="flex items-center gap-4 mb-6">
            <img 
              src={provider?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=Provider`} 
              alt={provider?.name || 'Prestador'}
              className="w-16 h-16 rounded-full"
            />
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{provider?.name || 'Prestador'}</h3>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Star className="w-4 h-4 text-status-searching fill-current" />
                <span>{provider?.rating?.toFixed(1) || '5.0'}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Total pago</p>
              <p className="text-2xl font-bold">R$ {chamado.valor?.toFixed(2)}</p>
            </div>
          </div>

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
                      ? 'text-status-searching fill-current' 
                      : 'text-muted'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Quick feedback tags */}
          <div className="flex justify-center gap-3 mb-6 flex-wrap">
            <button 
              onClick={() => toggleTag('excelente')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all ${
                selectedTags.includes('excelente')
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              <ThumbsUp className="w-4 h-4" />
              Excelente
            </button>
            <button 
              onClick={() => toggleTag('pontual')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all ${
                selectedTags.includes('pontual')
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              <Clock className="w-4 h-4" />
              Pontual
            </button>
            <button 
              onClick={() => toggleTag('melhorar')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all ${
                selectedTags.includes('melhorar')
                  ? 'bg-destructive text-destructive-foreground'
                  : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              <ThumbsDown className="w-4 h-4" />
              Melhorar
            </button>
          </div>

          {/* Comment input */}
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Deixe um comentário (opcional)"
            className="w-full bg-secondary rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            rows={3}
          />
        </div>

        {/* Submit button */}
        <Button 
          className="w-full" 
          size="lg"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Enviando...' : 'Enviar avaliação'}
        </Button>

        <button 
          className="w-full text-center text-sm text-muted-foreground mt-4 hover:text-foreground transition-colors"
          onClick={handleSkip}
          disabled={isSubmitting}
        >
          Pular
        </button>
      </div>
    </div>
  );
}
