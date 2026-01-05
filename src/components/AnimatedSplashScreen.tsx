import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import splashBackground from '@/assets/splash-background.png';

interface AnimatedSplashScreenProps {
  onComplete: () => void;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({ onComplete }) => {
  const [stage, setStage] = useState(0);
  // Stages: 0=initial green, 1=image fade in, 2=pulse, 3=complete

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    
    // Stage 1: Start fade in (after 300ms)
    timers.push(setTimeout(() => setStage(1), 300));
    
    // Stage 2: Pulse animation (after 2500ms)
    timers.push(setTimeout(() => setStage(2), 2500));
    
    // Stage 3: Complete and navigate (after 5000ms total)
    timers.push(setTimeout(() => {
      setStage(3);
      onComplete();
    }, 5000));

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #1a7a1a 0%, #2ecc40 50%, #3dd956 100%)'
      }}
    >
      {/* Main splash image with animation */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={stage >= 1 ? { 
          opacity: 1, 
          scale: stage >= 2 ? [1, 1.02, 1] : 1 
        } : {}}
        transition={{ 
          opacity: { duration: 1.5, ease: "easeOut" },
          scale: stage >= 2 
            ? { duration: 1.5, times: [0, 0.5, 1], ease: "easeInOut" }
            : { duration: 1.2, ease: "easeOut" }
        }}
      >
        <img 
          src={splashBackground} 
          alt="GIGA S.O.S" 
          className="w-full h-full object-cover"
        />
      </motion.div>

      {/* Optional subtle overlay for better fade effect */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, #1a7a1a 0%, #2ecc40 50%, #3dd956 100%)'
        }}
        initial={{ opacity: 1 }}
        animate={stage >= 1 ? { opacity: 0 } : {}}
        transition={{ duration: 1.5, ease: "easeOut" }}
      />
    </div>
  );
};

export default AnimatedSplashScreen;
