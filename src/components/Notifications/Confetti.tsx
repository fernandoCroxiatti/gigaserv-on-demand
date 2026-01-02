import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface ConfettiProps {
  count?: number;
  colors?: string[];
}

export function Confetti({ count = 50, colors }: ConfettiProps) {
  const defaultColors = [
    '#FFD700', // Gold
    '#FF6B6B', // Coral
    '#4ECDC4', // Teal
    '#A78BFA', // Purple
    '#F472B6', // Pink
    '#34D399', // Green
    '#60A5FA', // Blue
  ];

  const confettiColors = colors || defaultColors;

  const confettiPieces = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 0.5,
      duration: 2 + Math.random() * 2,
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      size: 6 + Math.random() * 8,
      rotation: Math.random() * 360,
      type: Math.random() > 0.5 ? 'circle' : 'rect',
    }));
  }, [count, confettiColors]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {confettiPieces.map((piece) => (
        <motion.div
          key={piece.id}
          initial={{
            opacity: 1,
            x: `${piece.x}vw`,
            y: -20,
            rotate: 0,
            scale: 1,
          }}
          animate={{
            opacity: [1, 1, 0],
            y: '110vh',
            rotate: piece.rotation + 720,
            x: `${piece.x + (Math.random() - 0.5) * 20}vw`,
          }}
          transition={{
            duration: piece.duration,
            delay: piece.delay,
            ease: 'easeOut',
          }}
          style={{
            position: 'absolute',
            width: piece.size,
            height: piece.type === 'rect' ? piece.size * 0.6 : piece.size,
            backgroundColor: piece.color,
            borderRadius: piece.type === 'circle' ? '50%' : '2px',
          }}
        />
      ))}
    </div>
  );
}
