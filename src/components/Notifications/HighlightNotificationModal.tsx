import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NotificationConceptIcon } from './NotificationConceptIcon';
import { Confetti } from './Confetti';
import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface HighlightNotificationModalProps {
  open: boolean;
  onClose: () => void;
  notification: {
    id: string;
    titulo: string;
    texto: string;
    imagem_url: string | null;
  } | null;
}

// Concepts that trigger celebratory confetti
const CELEBRATION_CONCEPTS = ['promocao', 'presente', 'novidade', 'avaliacao'];

export function HighlightNotificationModal({
  open,
  onClose,
  notification,
}: HighlightNotificationModalProps) {
  const concept = notification?.imagem_url || 'novidade';
  
  const showConfetti = useMemo(() => {
    return open && CELEBRATION_CONCEPTS.includes(concept);
  }, [open, concept]);

  // Custom colors based on concept
  const confettiColors = useMemo(() => {
    switch (concept) {
      case 'promocao':
        return ['#F43F5E', '#FB7185', '#FDA4AF', '#FFD700', '#FCD34D'];
      case 'presente':
        return ['#EC4899', '#F472B6', '#FBCFE8', '#A855F7', '#C084FC'];
      case 'avaliacao':
        return ['#FBBF24', '#FCD34D', '#FDE68A', '#F59E0B', '#D97706'];
      default:
        return ['#3B82F6', '#60A5FA', '#93C5FD', '#8B5CF6', '#A78BFA'];
    }
  }, [concept]);

  if (!notification) return null;

  return (
    <>
      {/* Confetti layer - outside dialog to cover full screen */}
      {showConfetti && <Confetti count={60} colors={confettiColors} />}
      
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="max-w-md w-[95vw] h-[85vh] max-h-[600px] p-0 gap-0 border-0 bg-gradient-to-b from-background to-muted/30 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            {/* Large illustration with bounce effect for celebrations */}
            <motion.div
              initial={{ scale: 0, opacity: 0, rotate: -10 }}
              animate={{ 
                scale: 1, 
                opacity: 1, 
                rotate: 0,
              }}
              transition={{ 
                delay: 0.1, 
                duration: 0.5, 
                ease: 'backOut',
                type: showConfetti ? 'spring' : 'tween',
                stiffness: showConfetti ? 200 : undefined,
                damping: showConfetti ? 15 : undefined,
              }}
              className="mb-8"
            >
              {/* Glow effect for celebration concepts */}
              {showConfetti && (
                <motion.div
                  className="absolute inset-0 rounded-2xl blur-xl opacity-30"
                  style={{ backgroundColor: confettiColors[0] }}
                  animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 0.5, 0.3],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              )}
              <NotificationConceptIcon
                concept={concept}
                size="xl"
              />
            </motion.div>

            {/* Title with stagger */}
            <motion.h2
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ 
                delay: 0.25, 
                duration: 0.5,
                ease: 'easeOut',
              }}
              className="text-2xl font-bold text-foreground mb-4 px-4"
            >
              {notification.titulo}
            </motion.h2>

            {/* Text */}
            <motion.p
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ 
                delay: 0.35, 
                duration: 0.5,
                ease: 'easeOut',
              }}
              className="text-muted-foreground text-base leading-relaxed px-4 max-w-sm"
            >
              {notification.texto}
            </motion.p>
          </div>

          {/* Action button with scale effect */}
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ 
              delay: 0.45, 
              duration: 0.4,
              ease: 'easeOut',
            }}
            className="p-6 pt-0"
          >
            <Button
              onClick={onClose}
              className="w-full h-14 text-lg font-semibold"
              size="lg"
            >
              Entendi
            </Button>
          </motion.div>
        </DialogContent>
      </Dialog>
    </>
  );
}
