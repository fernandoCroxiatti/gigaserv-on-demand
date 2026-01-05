import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import iconGuincho from '@/assets/icon-guincho.png';
import iconMecanica from '@/assets/icon-mecanica.png';
import iconBorracharia from '@/assets/icon-borracharia.png';
import iconChaveiro from '@/assets/icon-chaveiro.png';

interface AnimatedSplashScreenProps {
  onComplete: () => void;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({ onComplete }) => {
  const [stage, setStage] = useState(0);
  // Stages: 0=initial, 1-4=icons appearing, 5=circle pulse, 6=logo appears, 7=complete

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    
    // Icons appear one by one (600ms each)
    timers.push(setTimeout(() => setStage(1), 500));    // Icon 1 - Guincho
    timers.push(setTimeout(() => setStage(2), 1100));   // Icon 2 - Chaveiro
    timers.push(setTimeout(() => setStage(3), 1700));   // Icon 3 - Mecânica
    timers.push(setTimeout(() => setStage(4), 2300));   // Icon 4 - Borracharia
    
    // Circle pulse + glow
    timers.push(setTimeout(() => setStage(5), 2900));
    
    // Logo appears
    timers.push(setTimeout(() => setStage(6), 3900));
    
    // Complete
    timers.push(setTimeout(() => {
      setStage(7);
      onComplete();
    }, 5000));

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, #1b8a1b 0%, #28b840 40%, #3ed95a 100%)'
      }}
    >
      {/* Central container - centered in viewport */}
      <div className="relative flex items-center justify-center" style={{ width: 300, height: 300 }}>
        
        {/* Decorative circle arc */}
        <motion.svg
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          width="280"
          height="280"
          viewBox="0 0 280 280"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={stage >= 4 ? { 
            opacity: 0.3, 
            scale: 1,
            rotate: stage >= 5 ? 360 : 0
          } : {}}
          transition={{ 
            opacity: { duration: 0.5 },
            scale: { duration: 0.5 },
            rotate: { duration: 1.5, ease: "easeInOut" }
          }}
        >
          <circle 
            cx="140" 
            cy="140" 
            r="130" 
            fill="none" 
            stroke="rgba(255,255,255,0.25)" 
            strokeWidth="2"
            strokeDasharray="60 30"
          />
        </motion.svg>

        {/* Glow effect */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
          style={{
            width: 200,
            height: 200,
            background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)',
            filter: 'blur(15px)',
          }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={stage >= 5 ? { 
            opacity: [0, 0.8, 0.4, 0.7, 0.3, 0.5, 0.2],
            scale: [0.8, 1.1, 1, 1.1, 0.95, 1.05, 1]
          } : {}}
          transition={{ duration: 2, ease: "easeInOut" }}
        />

        {/* Icon 1: Guincho - Top (12h) */}
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2 flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={stage >= 1 ? { opacity: 1, scale: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: "backOut" }}
        >
          <img src={iconGuincho} alt="Guincho" className="w-16 h-auto drop-shadow-lg" />
        </motion.div>

        {/* Icon 2: Chaveiro - Right (3h) */}
        <motion.div
          className="absolute top-1/2 right-0 -translate-y-1/2 flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.5, x: -20 }}
          animate={stage >= 2 ? { opacity: 1, scale: 1, x: 0 } : {}}
          transition={{ duration: 0.5, ease: "backOut" }}
        >
          <img src={iconChaveiro} alt="Chaveiro" className="w-16 h-auto drop-shadow-lg" />
        </motion.div>

        {/* Icon 3: Mecânica - Bottom (6h) */}
        <motion.div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.5, y: -20 }}
          animate={stage >= 3 ? { opacity: 1, scale: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: "backOut" }}
        >
          <img src={iconMecanica} alt="Mecânica" className="w-16 h-auto drop-shadow-lg" />
        </motion.div>

        {/* Icon 4: Borracharia - Left (9h) */}
        <motion.div
          className="absolute top-1/2 left-0 -translate-y-1/2 flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.5, x: 20 }}
          animate={stage >= 4 ? { opacity: 1, scale: 1, x: 0 } : {}}
          transition={{ duration: 0.5, ease: "backOut" }}
        >
          <img src={iconBorracharia} alt="Borracharia" className="w-16 h-auto drop-shadow-lg" />
        </motion.div>

        {/* Center: Logo + Location Pin */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={stage >= 6 ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.6, ease: "backOut" }}
        >
          <LocationPinIcon />
          <h1 className="text-2xl font-bold text-white tracking-wide mt-1 whitespace-nowrap drop-shadow-lg">
            <span className="font-extrabold">GIGA</span>
            <span className="font-normal ml-1 text-xl">S.O.S</span>
          </h1>
        </motion.div>
      </div>
    </div>
  );
};

// Location Pin with cross - matches reference image style
const LocationPinIcon = () => (
  <svg width="50" height="60" viewBox="0 0 50 60" fill="none" className="drop-shadow-xl">
    {/* Pin shape */}
    <path 
      d="M25 0 C11 0 0 11 0 25 C0 43 25 58 25 58 C25 58 50 43 50 25 C50 11 39 0 25 0 Z" 
      fill="white"
    />
    {/* Inner circle */}
    <circle cx="25" cy="25" r="14" fill="#28b840"/>
    {/* Cross/Plus */}
    <path 
      d="M18 25 L32 25 M25 18 L25 32" 
      stroke="white" 
      strokeWidth="4" 
      strokeLinecap="round"
    />
  </svg>
);

export default AnimatedSplashScreen;
