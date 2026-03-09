import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Check, ChevronLeft, ChevronRight, Save, Loader2 } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────

export interface WizardStep {
  id: string;
  label: string;
  icon?: React.FC<{ size?: number; className?: string }>;
  content: React.ReactNode;
  validate?: () => boolean;
}

export interface FormWizardProps {
  steps: WizardStep[];
  onSubmit: () => void;
  submitting?: boolean;
  currentStep?: number;
  onStepChange?: (step: number) => void;
}

// ── Component ────────────────────────────────────────────────────────────

export const FormWizard: React.FC<FormWizardProps> = ({
  steps,
  onSubmit,
  submitting = false,
  currentStep: controlledStep,
  onStepChange,
}) => {
  const [internalStep, setInternalStep] = useState(0);
  const currentStep = controlledStep ?? internalStep;

  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const goToStep = useCallback(
    (step: number, dir: 'forward' | 'backward') => {
      setDirection(dir);
      setIsTransitioning(true);

      // Small delay for CSS transition
      setTimeout(() => {
        if (onStepChange) {
          onStepChange(step);
        } else {
          setInternalStep(step);
        }
        setIsTransitioning(false);
      }, 150);
    },
    [onStepChange],
  );

  const handleNext = useCallback(() => {
    if (isLastStep) return;

    const step = steps[currentStep];
    if (step.validate && !step.validate()) return;

    setCompletedSteps(prev => new Set(prev).add(currentStep));
    goToStep(currentStep + 1, 'forward');
  }, [currentStep, isLastStep, steps, goToStep]);

  const handlePrevious = useCallback(() => {
    if (isFirstStep) return;
    goToStep(currentStep - 1, 'backward');
  }, [currentStep, isFirstStep, goToStep]);

  const handleStepClick = useCallback(
    (stepIndex: number) => {
      // Allow clicking on completed steps or the next step
      if (stepIndex === currentStep) return;
      if (completedSteps.has(stepIndex) || stepIndex === currentStep + 1) {
        // Validate current step before advancing
        if (stepIndex > currentStep) {
          const step = steps[currentStep];
          if (step.validate && !step.validate()) return;
          setCompletedSteps(prev => new Set(prev).add(currentStep));
        }
        goToStep(stepIndex, stepIndex > currentStep ? 'forward' : 'backward');
      }
    },
    [currentStep, completedSteps, steps, goToStep],
  );

  const handleSubmitClick = useCallback(() => {
    const step = steps[currentStep];
    if (step.validate && !step.validate()) return;
    setCompletedSteps(prev => new Set(prev).add(currentStep));
    onSubmit();
  }, [currentStep, steps, onSubmit]);

  // Keyboard navigation: Enter to advance
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const target = e.target as HTMLElement;
        // Don't intercept Enter in textareas or buttons
        if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON' || target.tagName === 'SELECT') return;
        e.preventDefault();
        if (isLastStep) {
          handleSubmitClick();
        } else {
          handleNext();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handleSubmitClick, isLastStep]);

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-center">
          {steps.map((step, idx) => {
            const isCompleted = completedSteps.has(idx);
            const isCurrent = idx === currentStep;
            const StepIcon = step.icon;

            return (
              <React.Fragment key={step.id}>
                {/* Step circle + label */}
                <button
                  type="button"
                  onClick={() => handleStepClick(idx)}
                  className={`flex flex-col items-center gap-2 group transition-all duration-300 ${
                    isCompleted || isCurrent || completedSteps.has(idx - 1) || idx === currentStep + 1
                      ? 'cursor-pointer'
                      : 'cursor-default'
                  }`}
                  aria-label={`Step ${idx + 1}: ${step.label}`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {/* Circle */}
                  <div className="relative">
                    {isCurrent && (
                      <div className="absolute -inset-1.5 rounded-full bg-nesma-primary/30 animate-pulse" />
                    )}
                    <div
                      className={`relative w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                        isCompleted
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                          : isCurrent
                            ? 'bg-nesma-primary text-white shadow-lg shadow-nesma-primary/30'
                            : 'bg-white/10 text-gray-500'
                      }`}
                    >
                      {isCompleted ? (
                        <Check size={18} />
                      ) : StepIcon ? (
                        <StepIcon size={18} className={isCurrent ? 'text-white' : 'text-gray-500'} />
                      ) : (
                        idx + 1
                      )}
                    </div>
                  </div>
                  {/* Label - hidden on mobile */}
                  <span
                    className={`hidden md:block text-xs transition-all duration-300 max-w-[100px] text-center leading-tight ${
                      isCurrent ? 'text-white font-medium' : isCompleted ? 'text-emerald-400' : 'text-gray-500'
                    }`}
                  >
                    {step.label}
                  </span>
                </button>

                {/* Connector line */}
                {idx < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 md:mx-4 rounded-full transition-all duration-500 max-w-[120px] ${
                      isCompleted ? 'bg-emerald-500' : isCurrent ? 'bg-nesma-primary/50' : 'bg-white/10'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Mobile step counter */}
        <div className="md:hidden text-center mt-3">
          <span className="text-xs text-gray-400">
            Step {currentStep + 1} of {steps.length}
          </span>
          <span className="text-xs text-white font-medium block mt-0.5">{steps[currentStep]?.label}</span>
        </div>
      </div>

      {/* Step Content */}
      <div ref={contentRef} className="relative min-h-[200px]">
        <div
          className={`transition-all duration-300 ease-in-out ${
            isTransitioning
              ? direction === 'forward'
                ? 'opacity-0 translate-x-8'
                : 'opacity-0 -translate-x-8'
              : 'opacity-100 translate-x-0'
          }`}
        >
          {steps[currentStep]?.content}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-white/10">
        {/* Previous Button */}
        <div>
          {!isFirstStep && (
            <button
              type="button"
              onClick={handlePrevious}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-300 hover:bg-white/10 hover:text-white font-medium transition-all duration-300"
            >
              <ChevronLeft size={16} />
              Previous
            </button>
          )}
        </div>

        {/* Step counter + Next/Submit */}
        <div className="flex items-center gap-4">
          <span className="hidden md:block text-xs text-gray-500">
            Step {currentStep + 1} of {steps.length}
          </span>

          {isLastStep ? (
            <button
              type="button"
              onClick={handleSubmitClick}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none disabled:hover:shadow-emerald-500/20"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save & Submit
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-2.5 bg-nesma-primary hover:bg-nesma-primary/80 text-white rounded-xl font-bold shadow-lg shadow-nesma-primary/20 hover:shadow-nesma-primary/40 transition-all duration-300 transform hover:-translate-y-0.5"
            >
              Next Step
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
