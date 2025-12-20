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
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo de veículo</p>
      <div 
        ref={scrollRef}
        className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory"
      >
        {VEHICLE_TYPE_ORDER.map((type) => {
          const config = VEHICLE_TYPES[type];
          const isSelected = value === type;
          
          return (
            <button
              key={type}
              ref={isSelected ? selectedRef : undefined}
              onClick={() => onChange(type)}
              className={`flex-shrink-0 snap-center flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-all min-w-[68px] ${
                isSelected 
                  ? 'bg-primary/8 shadow-sm' 
                  : 'bg-secondary/40 hover:bg-secondary/70'
              }`}
            >
              <div className="relative">
                <span className="text-lg">{config.icon}</span>
                {isSelected && (
                  <div className="absolute -top-0.5 -right-1 w-3.5 h-3.5 bg-primary rounded-full flex items-center justify-center">
                    <Check className="w-2 h-2 text-primary-foreground" />
                  </div>
                )}
              </div>
              <span className={`text-[10px] font-medium text-center leading-tight ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                {config.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}