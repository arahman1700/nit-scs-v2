import { useRegisterSW } from 'virtual:pwa-register/react';

export const PwaUpdatePrompt: React.FC = () => {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed top-4 inset-x-4 z-50 flex justify-center pointer-events-none">
      <div className="bg-nesma-dark/95 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 shadow-2xl pointer-events-auto max-w-md w-full">
        <div className="flex items-center justify-between gap-3">
          <p className="text-white/80 text-sm">New version available</p>
          <button
            onClick={() => updateServiceWorker(true)}
            className="bg-nesma-primary hover:bg-nesma-primary/70 text-white text-sm rounded-lg px-4 py-1.5 transition-colors font-medium shrink-0"
          >
            Reload
          </button>
        </div>
      </div>
    </div>
  );
};
