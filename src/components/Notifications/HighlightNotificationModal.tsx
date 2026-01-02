import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NotificationConceptIcon } from './NotificationConceptIcon';
import { motion } from 'framer-motion';

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

export function HighlightNotificationModal({
  open,
  onClose,
  notification,
}: HighlightNotificationModalProps) {
  if (!notification) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md w-[95vw] h-[85vh] max-h-[600px] p-0 gap-0 border-0 bg-gradient-to-b from-background to-muted/30 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          {/* Large illustration */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
            className="mb-8"
          >
            <NotificationConceptIcon
              concept={notification.imagem_url || 'novidade'}
              size="xl"
            />
          </motion.div>

          {/* Title */}
          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="text-2xl font-bold text-foreground mb-4 px-4"
          >
            {notification.titulo}
          </motion.h2>

          {/* Text */}
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="text-muted-foreground text-base leading-relaxed px-4 max-w-sm"
          >
            {notification.texto}
          </motion.p>
        </div>

        {/* Action button */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
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
  );
}
