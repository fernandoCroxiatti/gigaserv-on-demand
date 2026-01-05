import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import splashBackground from '@/assets/splash-background.png';

interface AnimatedSplashScreenProps {
  onComplete: () => void;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({ onComplete }) => {
  const [stage, setStage] = useState(0);
  // Stages: 0=initial green, 1=image fade in, 2=glow pulse, 3=complete

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    
    // Stage 1: Start fade in (after 300ms)
    timers.push(setTimeout(() => setStage(1), 300));
    
    // Stage 2: Glow pulse animation (after 2000ms)
    timers.push(setTimeout(() => setStage(2), 2000));
    
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
      {/* Glow effect behind image */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        initial={{ opacity: 0 }}
        animate={stage >= 2 ? { 
          opacity: [0, 0.6, 0.3, 0.6, 0.3, 0.5, 0],
        } : {}}
        transition={{ 
          duration: 3,
          times: [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1],
          ease: "easeInOut"
        }}
      >
        <div 
          className="w-80 h-80 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 40%, transparent 70%)',
            filter: 'blur(20px)',
          }}
        />
      </motion.div>

      {/* Main splash image with animation */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={stage >= 1 ? { 
          opacity: 1, 
          scale: 1,
          filter: stage >= 2 ? [
            'drop-shadow(0 0 0px rgba(255,255,255,0))',
            'drop-shadow(0 0 30px rgba(255,255,255,0.8))',
            'drop-shadow(0 0 15px rgba(255,255,255,0.4))',
            'drop-shadow(0 0 25px rgba(255,255,255,0.7))',
            'drop-shadow(0 0 10px rgba(255,255,255,0.3))',
            'drop-shadow(0 0 20px rgba(255,255,255,0.5))',
            'drop-shadow(0 0 0px rgba(255,255,255,0))',
          ] : 'drop-shadow(0 0 0px rgba(255,255,255,0))'
        } : {}}
        transition={{ 
          opacity: { duration: 1.5, ease: "easeOut" },
          scale: { duration: 1.2, ease: "easeOut" },
          filter: stage >= 2 ? { 
            duration: 3, 
            times: [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1],
            ease: "easeInOut" 
          } : { duration: 0 }
        }}
      >
        <img 
          src={splashBackground} 
          alt="GIGA S.O.S" 
          className="w-full h-full object-cover"
        />
      </motion.div>

      {/* Initial overlay that fades out */}
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
