import { useRef, useCallback } from 'react';

interface SwipeableStepsProps {
  currentStep: number;
  onStepChange: (step: number) => void;
  totalSteps: number;
  children: React.ReactNode;
}

const SWIPE_THRESHOLD = 50;

export function SwipeableSteps({ currentStep, onStepChange, totalSteps, children }: SwipeableStepsProps) {
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const deltaXRef = useRef(0);
  const deltaYRef = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    deltaXRef.current = 0;
    deltaYRef.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    deltaXRef.current = touch.clientX - startXRef.current;
    deltaYRef.current = touch.clientY - startYRef.current;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const dx = deltaXRef.current;
    const dy = deltaYRef.current;

    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0 && currentStep < totalSteps - 1) {
        // Swipe left → next step
        onStepChange(currentStep + 1);
      } else if (dx > 0 && currentStep > 0) {
        // Swipe right → prev step
        onStepChange(currentStep - 1);
      }
    }
  }, [currentStep, totalSteps, onStepChange]);

  return (
    <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      {children}

      {/* Step dots */}
      <div className="flex justify-center gap-2 mt-4">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all ${
              i === currentStep ? 'bg-nesma-secondary w-6' : 'bg-white/20 w-2'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
