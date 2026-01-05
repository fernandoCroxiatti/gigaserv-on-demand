import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface AnimatedSplashScreenProps {
  onComplete: () => void;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({ onComplete }) => {
  const [stage, setStage] = useState(0);
  // Stages: 0=initial, 1-4=icons appearing, 5=circle pulse, 6=logo appears, 7=complete

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    
    // Stage 1-4: Icons appearing one by one (600ms each)
    // Start after 500ms initial delay
    timers.push(setTimeout(() => setStage(1), 500));      // Icon 1 at 500ms
    timers.push(setTimeout(() => setStage(2), 1100));     // Icon 2 at 1100ms
    timers.push(setTimeout(() => setStage(3), 1700));     // Icon 3 at 1700ms
    timers.push(setTimeout(() => setStage(4), 2300));     // Icon 4 at 2300ms
    
    // Stage 5: Circle pulse (after all icons: 2300 + 600 = 2900ms)
    timers.push(setTimeout(() => setStage(5), 2900));
    
    // Stage 6: Logo appears (after pulse: 2900 + 1000 = 3900ms)
    timers.push(setTimeout(() => setStage(6), 3900));
    
    // Stage 7: Complete and navigate (after logo + pause: 3900 + 700 + 400 = 5000ms)
    timers.push(setTimeout(() => {
      setStage(7);
      onComplete();
    }, 5000));

    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  // Circle radius for icon positioning
  const radius = 110;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #1a7a1a 0%, #2ecc40 50%, #3dd956 100%)'
      }}
    >
      {/* Central container for positioning */}
      <div className="relative" style={{ width: radius * 2.5, height: radius * 2.5 }}>
        
        {/* Decorative circle border */}
        <motion.div
          className="absolute rounded-full border-2 border-white/20"
          style={{
            width: radius * 2 + 40,
            height: radius * 2 + 40,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)'
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={stage >= 4 ? { 
            opacity: 0.4, 
            scale: 1,
            rotate: stage >= 5 ? 360 : 0
          } : {}}
          transition={{ 
            duration: stage >= 5 ? 1 : 0.5,
            ease: "easeInOut"
          }}
        />

        {/* Tow Truck - Top (12h position) */}
        <motion.div
          className="absolute"
          style={{
            left: '50%',
            top: '50%',
            marginLeft: -32,
            marginTop: -radius - 24,
          }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={stage >= 1 ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, ease: "backOut" }}
        >
          <TowTruckIcon />
        </motion.div>

        {/* Locksmith - Right (3h position) */}
        <motion.div
          className="absolute"
          style={{
            left: '50%',
            top: '50%',
            marginLeft: radius - 8,
            marginTop: -28,
          }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={stage >= 2 ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, ease: "backOut" }}
        >
          <LocksmithIcon />
        </motion.div>

        {/* Mechanic - Bottom (6h position) */}
        <motion.div
          className="absolute"
          style={{
            left: '50%',
            top: '50%',
            marginLeft: -32,
            marginTop: radius - 8,
          }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={stage >= 3 ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, ease: "backOut" }}
        >
          <MechanicIcon />
        </motion.div>

        {/* Tire Service - Left (9h position) */}
        <motion.div
          className="absolute"
          style={{
            left: '50%',
            top: '50%',
            marginLeft: -radius - 48,
            marginTop: -28,
          }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={stage >= 4 ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, ease: "backOut" }}
        >
          <TireServiceIcon />
        </motion.div>

        {/* Center: Location Pin + Logo */}
        <motion.div
          className="absolute flex flex-col items-center"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)'
          }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={stage >= 6 ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.7, ease: "backOut" }}
        >
          <LocationPinIcon />
          <h1 className="text-3xl font-bold text-white tracking-wider mt-2 whitespace-nowrap">
            GIGA <span className="text-2xl font-normal">S.O.S</span>
          </h1>
        </motion.div>
      </div>
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
