import React from 'react';
import { getConceptConfig, type NotificationConcept } from '@/lib/notificationConcepts';
import { cn } from '@/lib/utils';

interface NotificationConceptIconProps {
  concept: NotificationConcept | string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-10 h-10',
  md: 'w-14 h-14',
  lg: 'w-16 h-16',
};

const iconSizeClasses = {
  sm: 'h-5 w-5',
  md: 'h-7 w-7',
  lg: 'h-8 w-8',
};

export function NotificationConceptIcon({ 
  concept, 
  size = 'md',
  className 
}: NotificationConceptIconProps) {
  const config = getConceptConfig(concept);
  const IconComponent = config.icon;

  return (
    <div 
      className={cn(
        'rounded-lg flex items-center justify-center flex-shrink-0',
        sizeClasses[size],
        config.bgColor,
        className
      )}
    >
      <IconComponent className={cn(iconSizeClasses[size], config.iconColor)} />
    </div>
  );
}
