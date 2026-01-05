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
      {/* Central container */}
      <div className="relative flex items-center justify-center" style={{ width: 320, height: 400 }}>
        
        {/* Decorative circle arc */}
        <motion.svg
          className="absolute"
          width="280"
          height="280"
          viewBox="0 0 280 280"
          style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
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
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 200,
            height: 200,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
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
          className="absolute"
          style={{ top: 0, left: '50%', transform: 'translateX(-50%)' }}
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={stage >= 1 ? { opacity: 1, scale: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: "backOut" }}
        >
          <GuinchoIcon />
        </motion.div>

        {/* Icon 2: Chaveiro - Right (3h) */}
        <motion.div
          className="absolute"
          style={{ right: -10, top: '45%', transform: 'translateY(-50%)' }}
          initial={{ opacity: 0, scale: 0.5, x: -20 }}
          animate={stage >= 2 ? { opacity: 1, scale: 1, x: 0 } : {}}
          transition={{ duration: 0.5, ease: "backOut" }}
        >
          <ChaveiroIcon />
        </motion.div>

        {/* Icon 3: Mecânica - Bottom (6h) */}
        <motion.div
          className="absolute"
          style={{ bottom: 20, left: '50%', transform: 'translateX(-50%)' }}
          initial={{ opacity: 0, scale: 0.5, y: -20 }}
          animate={stage >= 3 ? { opacity: 1, scale: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: "backOut" }}
        >
          <MecanicaIcon />
        </motion.div>

        {/* Icon 4: Borracharia - Left (9h) */}
        <motion.div
          className="absolute"
          style={{ left: -10, top: '45%', transform: 'translateY(-50%)' }}
          initial={{ opacity: 0, scale: 0.5, x: 20 }}
          animate={stage >= 4 ? { opacity: 1, scale: 1, x: 0 } : {}}
          transition={{ duration: 0.5, ease: "backOut" }}
        >
          <BorrachariaIcon />
        </motion.div>

        {/* Center: Logo + Location Pin */}
        <motion.div
          className="absolute flex flex-col items-center"
          style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
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

// Guincho (Tow Truck) - matches reference image style
const GuinchoIcon = () => (
  <svg width="100" height="65" viewBox="0 0 100 65" fill="none" className="drop-shadow-lg">
    {/* Truck cab */}
    <path 
      d="M10 45 L10 25 L35 25 L35 45 Z" 
      fill="white" 
      stroke="white" 
      strokeWidth="1"
    />
    {/* Truck bed */}
    <path 
      d="M35 45 L35 30 L70 30 L70 45 Z" 
      fill="white" 
      stroke="white" 
      strokeWidth="1"
    />
    {/* Crane arm */}
    <path 
      d="M55 30 L55 10 L58 10 L58 30" 
      fill="white" 
      stroke="white" 
      strokeWidth="2"
    />
    {/* Crane boom */}
    <path 
      d="M58 12 L85 25" 
      stroke="white" 
      strokeWidth="3" 
      strokeLinecap="round"
    />
    {/* Hook */}
    <path 
      d="M85 25 L85 35 M82 35 L88 35 M85 35 L85 42 C85 46 82 48 80 46" 
      stroke="white" 
      strokeWidth="2.5" 
      strokeLinecap="round"
      fill="none"
    />
    {/* Wheels */}
    <circle cx="22" cy="50" r="8" fill="white" stroke="white" strokeWidth="1"/>
    <circle cx="22" cy="50" r="4" fill="#28b840"/>
    <circle cx="58" cy="50" r="8" fill="white" stroke="white" strokeWidth="1"/>
    <circle cx="58" cy="50" r="4" fill="#28b840"/>
    {/* Window */}
    <rect x="15" y="28" width="12" height="10" rx="1" fill="#28b840"/>
  </svg>
);

// Chaveiro (Locksmith/Keys) - matches reference image style
const ChaveiroIcon = () => (
  <svg width="90" height="80" viewBox="0 0 90 80" fill="none" className="drop-shadow-lg">
    {/* Key fob body */}
    <ellipse cx="25" cy="30" rx="18" ry="24" fill="white"/>
    {/* Key fob ring */}
    <circle cx="25" cy="10" r="6" fill="none" stroke="white" strokeWidth="3"/>
    {/* Lock icon on fob */}
    <rect x="20" y="35" width="10" height="12" rx="2" fill="#28b840"/>
    <circle cx="25" cy="28" r="5" fill="none" stroke="#28b840" strokeWidth="2"/>
    {/* Car silhouette on fob */}
    <path 
      d="M18 50 Q25 45 32 50 L30 55 L20 55 Z" 
      fill="#28b840"
    />
    {/* Main key shaft */}
    <path 
      d="M43 35 L80 35" 
      stroke="white" 
      strokeWidth="5" 
      strokeLinecap="round"
    />
    {/* Key teeth */}
    <path 
      d="M55 35 L55 42 M62 35 L62 45 M69 35 L69 40 M76 35 L76 43" 
      stroke="white" 
      strokeWidth="3" 
      strokeLinecap="round"
    />
    {/* Key ring */}
    <circle cx="83" cy="35" r="5" fill="none" stroke="white" strokeWidth="3"/>
  </svg>
);

// Mecânica (Mobile Mechanic Van) - matches reference image style
const MecanicaIcon = () => (
  <svg width="100" height="70" viewBox="0 0 100 70" fill="none" className="drop-shadow-lg">
    {/* Van body */}
    <path 
      d="M15 50 L15 25 C15 22 18 20 22 20 L70 20 C75 20 78 22 78 25 L78 50 Z" 
      fill="white"
    />
    {/* Van front window area */}
    <path 
      d="M60 20 L75 20 L80 30 L80 45 L60 45 L60 20" 
      fill="white"
      stroke="white"
      strokeWidth="1"
    />
    {/* Windows */}
    <rect x="22" y="25" width="15" height="12" rx="2" fill="#28b840"/>
    <rect x="42" y="25" width="15" height="12" rx="2" fill="#28b840"/>
    {/* Gear icon */}
    <circle cx="35" cy="35" r="12" fill="none" stroke="#28b840" strokeWidth="3"/>
    <circle cx="35" cy="35" r="5" fill="#28b840"/>
    {/* Gear teeth (simplified) */}
    <path 
      d="M35 22 L35 18 M35 52 L35 48 M22 35 L18 35 M52 35 L48 35 M26 26 L23 23 M44 44 L47 47 M26 44 L23 47 M44 26 L47 23" 
      stroke="#28b840" 
      strokeWidth="2.5" 
      strokeLinecap="round"
    />
    {/* Wrench across */}
    <path 
      d="M20 15 L55 55" 
      stroke="white" 
      strokeWidth="5" 
      strokeLinecap="round"
    />
    <circle cx="20" cy="15" r="6" fill="white"/>
    <circle cx="55" cy="55" r="5" fill="white"/>
    {/* Wheels */}
    <circle cx="28" cy="55" r="8" fill="white"/>
    <circle cx="28" cy="55" r="4" fill="#28b840"/>
    <circle cx="68" cy="55" r="8" fill="white"/>
    <circle cx="68" cy="55" r="4" fill="#28b840"/>
  </svg>
);

// Borracharia (Tire Service Van) - matches reference image style
const BorrachariaIcon = () => (
  <svg width="100" height="80" viewBox="0 0 100 80" fill="none" className="drop-shadow-lg">
    {/* Large tire */}
    <circle cx="25" cy="45" r="22" fill="white" stroke="white" strokeWidth="2"/>
    <circle cx="25" cy="45" r="14" fill="#28b840"/>
    <circle cx="25" cy="45" r="6" fill="white"/>
    {/* Tire treads */}
    <path 
      d="M25 23 L25 28 M25 62 L25 67 M3 45 L8 45 M42 45 L47 45 M10 30 L14 33 M36 57 L40 60 M10 60 L14 57 M36 33 L40 30" 
      stroke="white" 
      strokeWidth="2" 
      strokeLinecap="round"
    />
    {/* Van body */}
    <path 
      d="M45 60 L45 30 C45 27 48 25 52 25 L88 25 C92 25 95 27 95 30 L95 60 Z" 
      fill="white"
    />
    {/* Van window */}
    <rect x="50" y="30" width="18" height="12" rx="2" fill="#28b840"/>
    {/* Tools icon - crossed wrench and screwdriver */}
    <path 
      d="M55 20 L75 50" 
      stroke="white" 
      strokeWidth="4" 
      strokeLinecap="round"
    />
    <path 
      d="M75 20 L55 50" 
      stroke="white" 
      strokeWidth="4" 
      strokeLinecap="round"
    />
    <circle cx="55" cy="20" r="4" fill="white"/>
    <circle cx="75" cy="20" r="4" fill="white"/>
    {/* Wheels */}
    <circle cx="55" cy="65" r="7" fill="white"/>
    <circle cx="55" cy="65" r="3.5" fill="#28b840"/>
    <circle cx="85" cy="65" r="7" fill="white"/>
    <circle cx="85" cy="65" r="3.5" fill="#28b840"/>
  </svg>
);

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
