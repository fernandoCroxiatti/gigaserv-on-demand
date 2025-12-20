import React, { useRef, useEffect } from 'react';
import { VehicleType, VEHICLE_TYPES, VEHICLE_TYPE_ORDER } from '@/types/vehicleTypes';
import { Check } from 'lucide-react';

interface VehicleTypeSelectorProps {
  value: VehicleType | null;
  onChange: (type: VehicleType) => void;
}

export function VehicleTypeSelector({ value, onChange }: VehicleTypeSelectorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Scroll to selected item when mounted
  useEffect(() => {
    if (value && selectedRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const element = selectedRef.current;
      const containerWidth = container.offsetWidth;
      const elementLeft = element.offsetLeft;
      const elementWidth = element.offsetWidth;
      
      container.scrollTo({
        left: elementLeft - (containerWidth / 2) + (elementWidth / 2),
        behavior: 'smooth'
      });
    }
  }, [value]);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">🚗 Tipo de veículo</p>
      <div 
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {VEHICLE_TYPE_ORDER.map((type) => {
          const config = VEHICLE_TYPES[type];
          const isSelected = value === type;
          
          return (
            <button
              key={type}
              ref={isSelected ? selectedRef : undefined}
              onClick={() => onChange(type)}
              className={`flex-shrink-0 snap-center flex flex-col items-center gap-1 p-3 rounded-xl transition-all min-w-[80px] ${
                isSelected 
                  ? 'bg-primary/10 border-2 border-primary' 
                  : 'bg-secondary border-2 border-transparent hover:border-border'
              }`}
            >
              <div className="relative">
                <span className="text-2xl">{config.icon}</span>
                {isSelected && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <span className={`text-xs font-medium text-center leading-tight ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                {config.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
