import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnimatedSplashScreenProps {
  onComplete: () => void;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({ onComplete }) => {
  const [stage, setStage] = useState(0);
  // Stages: 0=initial, 1=icons appearing, 2=circle pulse, 3=logo appears, 4=complete

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    
    // Stage 1: Start icons appearing (after 200ms)
    timers.push(setTimeout(() => setStage(1), 200));
    
    // Stage 2: Circle pulse (after all icons appear: 200 + 4*300 = 1400ms)
    timers.push(setTimeout(() => setStage(2), 1500));
    
    // Stage 3: Logo appears (after pulse: 1500 + 700 = 2200ms)
    timers.push(setTimeout(() => setStage(3), 2200));
    
    // Stage 4: Complete and navigate (after pause: 2200 + 600 = 2800ms)
    timers.push(setTimeout(() => {
      setStage(4);
      onComplete();
    }, 2800));

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  // Service icons positions (circular arrangement)
  const iconPositions = [
    { x: 0, y: -100, delay: 0 },      // Top - Tow truck
    { x: 100, y: 0, delay: 0.3 },     // Right - Locksmith
    { x: 0, y: 100, delay: 0.6 },     // Bottom - Mechanic
    { x: -100, y: 0, delay: 0.9 },    // Left - Tire/Borracharia
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #1a7a1a 0%, #2ecc40 50%, #3dd956 100%)'
      }}
    >
      {/* Decorative circle */}
      <motion.div
        className="absolute w-72 h-72 rounded-full border border-white/20"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={stage >= 1 ? { 
          opacity: 0.3, 
          scale: 1,
          rotate: stage >= 2 ? 360 : 0
        } : {}}
        transition={{ 
          duration: stage >= 2 ? 0.8 : 0.5,
          ease: "easeOut"
        }}
      />

      {/* Service Icons */}
      <div className="relative w-72 h-72 flex items-center justify-center">
        {/* Tow Truck - Top */}
        <motion.div
          className="absolute"
          style={{ transform: `translate(${iconPositions[0].x}px, ${iconPositions[0].y}px)` }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={stage >= 1 ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: iconPositions[0].delay, duration: 0.4, ease: "backOut" }}
        >
          <TowTruckIcon />
        </motion.div>

        {/* Locksmith - Right */}
        <motion.div
          className="absolute"
          style={{ transform: `translate(${iconPositions[1].x}px, ${iconPositions[1].y}px)` }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={stage >= 1 ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: iconPositions[1].delay, duration: 0.4, ease: "backOut" }}
        >
          <LocksmithIcon />
        </motion.div>

        {/* Mechanic - Bottom */}
        <motion.div
          className="absolute"
          style={{ transform: `translate(${iconPositions[2].x}px, ${iconPositions[2].y}px)` }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={stage >= 1 ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: iconPositions[2].delay, duration: 0.4, ease: "backOut" }}
        >
          <MechanicIcon />
        </motion.div>

        {/* Tire Service - Left */}
        <motion.div
          className="absolute"
          style={{ transform: `translate(${iconPositions[3].x}px, ${iconPositions[3].y}px)` }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={stage >= 1 ? { opacity: 1, scale: 1 } : {}}
          transition={{ delay: iconPositions[3].delay, duration: 0.4, ease: "backOut" }}
        >
          <TireServiceIcon />
        </motion.div>

        {/* Center Location Pin */}
        <motion.div
          className="absolute z-10"
          initial={{ opacity: 0, scale: 0 }}
          animate={stage >= 3 ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.4, ease: "backOut" }}
        >
          <LocationPinIcon />
        </motion.div>
      </div>

      {/* Logo Text */}
      <motion.div
        className="absolute flex flex-col items-center"
        style={{ marginTop: '160px' }}
        initial={{ opacity: 0, y: 20 }}
        animate={stage >= 3 ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
      >
        <h1 className="text-4xl font-bold text-white tracking-wider">
          GIGA <span className="text-3xl font-normal">S.O.S</span>
        </h1>
      </motion.div>
    </div>
  );
};

// SVG Icons as components
const TowTruckIcon = () => (
  <svg width="64" height="48" viewBox="0 0 64 48" fill="none" className="drop-shadow-lg">
    <path d="M4 32h40V16H32l-8-8H4v24z" fill="white" stroke="white" strokeWidth="2"/>
    <path d="M44 32h8l8-8v-8h-16v16z" fill="white" stroke="white" strokeWidth="2"/>
    <circle cx="12" cy="36" r="5" fill="#2ecc40" stroke="white" strokeWidth="2"/>
    <circle cx="36" cy="36" r="5" fill="#2ecc40" stroke="white" strokeWidth="2"/>
    <path d="M48 8l8 8M52 4v16" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    <path d="M46 12l10 8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const LocksmithIcon = () => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="drop-shadow-lg">
    <ellipse cx="18" cy="20" rx="12" ry="16" fill="white" stroke="white" strokeWidth="2"/>
    <rect x="14" y="28" width="8" height="12" rx="2" fill="#2ecc40"/>
    <path d="M30 24h22M40 20v8M48 18v12" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    <circle cx="18" cy="16" r="4" fill="#2ecc40"/>
    <path d="M12 36l-4 8M24 36l4 8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const MechanicIcon = () => (
  <svg width="64" height="48" viewBox="0 0 64 48" fill="none" className="drop-shadow-lg">
    <rect x="8" y="16" width="40" height="20" rx="4" fill="white"/>
    <rect x="48" y="20" width="12" height="12" rx="2" fill="white"/>
    <circle cx="16" cy="40" r="5" fill="#2ecc40" stroke="white" strokeWidth="2"/>
    <circle cx="40" cy="40" r="5" fill="#2ecc40" stroke="white" strokeWidth="2"/>
    <path d="M24 8l16 16M32 4l-8 20" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    <circle cx="28" cy="16" r="8" fill="none" stroke="white" strokeWidth="2"/>
    <circle cx="28" cy="16" r="4" fill="white"/>
  </svg>
);

const TireServiceIcon = () => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="drop-shadow-lg">
    <rect x="20" y="16" width="28" height="24" rx="4" fill="white"/>
    <circle cx="16" cy="44" r="5" fill="#2ecc40" stroke="white" strokeWidth="2"/>
    <circle cx="40" cy="44" r="5" fill="#2ecc40" stroke="white" strokeWidth="2"/>
    <circle cx="12" cy="28" r="10" fill="white" stroke="white" strokeWidth="2"/>
    <circle cx="12" cy="28" r="5" fill="#2ecc40"/>
    <path d="M28 8l8 8M24 12l12 4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    <path d="M36 4l-4 12" stroke="white" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

const LocationPinIcon = () => (
  <svg width="48" height="56" viewBox="0 0 48 56" fill="none" className="drop-shadow-xl">
    <path 
      d="M24 0C10.745 0 0 10.745 0 24c0 18 24 32 24 32s24-14 24-32C48 10.745 37.255 0 24 0z" 
      fill="white"
    />
    <circle cx="24" cy="24" r="12" fill="#2ecc40"/>
    <path d="M18 24h12M24 18v12" stroke="white" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

export default AnimatedSplashScreen;
