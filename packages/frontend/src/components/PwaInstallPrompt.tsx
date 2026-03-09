import { useState, useEffect, useCallback } from 'react';
import { Download, Wifi, Bell, Zap, X, Share, ChevronDown, Plus } from 'lucide-react';
import { toRecord } from '@/utils/type-helpers';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa-install-dismissed';
const PERMANENT_DISMISS_KEY = 'pwa-install-never';
const VISIT_COUNT_KEY = 'pwa-visit-count';
const DISMISS_DAYS = 7;
const MIN_VISITS_BEFORE_SHOW = 3;

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if permanently dismissed
    if (localStorage.getItem(PERMANENT_DISMISS_KEY)) return;

    // Check if temporarily dismissed
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      if (Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000) return;
    }

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Track visit count - only show after MIN_VISITS_BEFORE_SHOW visits
    const visitCount = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10) + 1;
    localStorage.setItem(VISIT_COUNT_KEY, String(visitCount));
    if (visitCount < MIN_VISITS_BEFORE_SHOW) return;

    // Detect iOS Safari
    const ua = navigator.userAgent;
    const isiOS = /iPad|iPhone|iPod/.test(ua) && !toRecord(window).MSStream;
    if (isiOS) {
      setIsIOS(true);
      setShowBanner(true);
      // Trigger entrance animation after mount
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsVisible(false);
      setTimeout(() => setShowBanner(false), 300);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setIsVisible(false);
    setTimeout(() => setShowBanner(false), 300);
  }, []);

  const handleNeverShow = useCallback(() => {
    localStorage.setItem(PERMANENT_DISMISS_KEY, 'true');
    setIsVisible(false);
    setTimeout(() => setShowBanner(false), 300);
  }, []);

  if (!showBanner) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleDismiss}
      />

      {/* Install prompt card */}
      <div
        className={`fixed bottom-0 inset-x-0 z-[61] transition-all duration-300 ease-out ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
      >
        <div className="bg-nesma-dark border-t border-white/10 rounded-t-3xl shadow-2xl shadow-black/50 max-w-lg mx-auto w-full">
          {/* Drag indicator */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          <div className="px-6 pb-6 pt-2">
            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 text-white/30 hover:text-white/60 transition-colors p-1"
              aria-label="Dismiss install prompt"
            >
              <X size={20} />
            </button>

            {/* App icon and header */}
            <div className="flex items-center gap-4 mb-5">
              <div className="w-16 h-16 rounded-2xl bg-nesma-primary flex items-center justify-center shadow-lg shadow-nesma-primary/30 shrink-0">
                <span className="text-white font-bold text-2xl">N</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Install NIT Logistics</h2>
                <p className="text-sm text-gray-400 mt-0.5">Quick access from your home screen</p>
              </div>
            </div>

            {/* Benefits list */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                <div className="p-2 rounded-lg bg-nesma-secondary/20 shrink-0">
                  <Zap size={18} className="text-nesma-secondary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Instant Access</p>
                  <p className="text-xs text-gray-400">Launch directly from your home screen</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                <div className="p-2 rounded-lg bg-emerald-500/20 shrink-0">
                  <Wifi size={18} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Works Offline</p>
                  <p className="text-xs text-gray-400">Access cached data without connection</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                <div className="p-2 rounded-lg bg-amber-500/20 shrink-0">
                  <Bell size={18} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Push Notifications</p>
                  <p className="text-xs text-gray-400">Get alerts for approvals and updates</p>
                </div>
              </div>
            </div>

            {/* iOS-specific instructions */}
            {isIOS ? (
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  How to install on iOS
                </p>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-nesma-primary/30 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-nesma-secondary">1</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-300">Tap the</span>
                      <Share size={16} className="text-nesma-secondary" />
                      <span className="text-sm text-gray-300">Share button</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-nesma-primary/30 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-nesma-secondary">2</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-300">Scroll down</span>
                      <ChevronDown size={16} className="text-nesma-secondary" />
                      <span className="text-sm text-gray-300">in the share sheet</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-nesma-primary/30 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-nesma-secondary">3</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-300">Tap</span>
                      <Plus size={14} className="text-nesma-secondary" />
                      <span className="text-sm font-medium text-white">"Add to Home Screen"</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Install button for Android/Desktop */
              <button
                onClick={handleInstall}
                className="w-full bg-nesma-primary hover:bg-nesma-primary/80 text-white px-8 py-3.5 rounded-xl text-base font-semibold transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-nesma-primary/20 mb-4 active:scale-[0.98]"
              >
                <Download size={20} />
                Install App
              </button>
            )}

            {/* Dismiss options */}
            <div className="flex items-center justify-center gap-6 pb-safe">
              <button onClick={handleDismiss} className="text-sm text-gray-400 hover:text-white transition-colors py-2">
                Not now
              </button>
              <span className="text-white/10">|</span>
              <button
                onClick={handleNeverShow}
                className="text-sm text-gray-400 hover:text-gray-300 transition-colors py-2"
              >
                Don't show again
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
