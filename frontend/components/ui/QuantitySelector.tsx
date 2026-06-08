'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuantitySelectorProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function QuantitySelector({
  value,
  onValueChange,
  min = 1,
  max = 99,
  className,
  size = 'md',
}: QuantitySelectorProps) {
  const handleIncrement = () => {
    if (value < max) {
      onValueChange(value + 1);
    }
  };

  const handleDecrement = () => {
    if (value > min) {
      onValueChange(value - 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value) || min;
    const clampedValue = Math.max(min, Math.min(max, newValue));
    onValueChange(clampedValue);
  };

  const sizeClasses = {
    sm: 'h-8 w-16 text-sm',
    md: 'h-10 w-20',
    lg: 'h-12 w-24 text-lg',
  };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Button
        variant="outline"
        size="icon"
        onClick={handleDecrement}
        disabled={value <= min}
        className="h-8 w-8"
      >
        <Minus className="h-4 w-4" />
      </Button>

      <input
        type="number"
        value={value}
        onChange={handleInputChange}
        min={min}
        max={max}
        className={cn(
          'flex w-16 items-center justify-center border-y border-gray-200 text-center',
          sizeClasses[size]
        )}
        style={{ MozAppearance: 'textfield' }}
      />

      <Button
        variant="outline"
        size="icon"
        onClick={handleIncrement}
        disabled={value >= max}
        className="h-8 w-8"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}