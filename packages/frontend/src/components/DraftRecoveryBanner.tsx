import React from 'react';

interface DraftRecoveryBannerProps {
  savedAt: string;
  onRecover: () => void;
  onDiscard: () => void;
}

export const DraftRecoveryBanner: React.FC<DraftRecoveryBannerProps> = ({ savedAt, onRecover, onDiscard }) => {
  const timeAgo = getTimeAgo(savedAt);

  return (
    <div className="glass-card rounded-xl p-4 border border-amber-500/30 bg-amber-500/5 flex items-center justify-between mb-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <p className="text-sm text-amber-200">
          Unsaved draft found from <span className="font-medium text-white">{timeAgo}</span>
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onRecover}
          className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition-colors"
        >
          Recover Draft
        </button>
        <button
          onClick={onDiscard}
          className="text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10 transition-colors"
        >
          Discard
        </button>
      </div>
    </div>
  );
};

function getTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
