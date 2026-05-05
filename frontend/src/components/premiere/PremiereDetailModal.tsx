import React, { useState, useEffect } from 'react';
import { Premiere } from '../../types/premiere';
import premiereService from '../../services/premiereService';
import { formatVideoDuration } from '../../utils/videoUtils';

interface PremiereDetailModalProps {
  premiere: Premiere;
  onClose: () => void;
  onJoin?: () => void;
}

const PremiereDetailModal: React.FC<PremiereDetailModalProps> = ({ premiere, onClose, onJoin }) => {
  const [now, setNow] = useState(Date.now());

  // Tick every second so the countdown stays live while the modal is open.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const posterUrl = premiere.video?.processedFiles?.poster
    ? premiereService.getPosterUrl(premiere.video)
    : '';

  const isLive = premiereService.isPremiereLive(premiere);
  const isScheduled = premiereService.isPremiereScheduled(premiere);
  const isEnded = premiere.status === 'ended';

  const formatCountdown = (): string => {
    const ms = new Date(premiere.startTime).getTime() - now;
    if (ms <= 0) return 'Starting now';
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const formatStartAt = (): string => {
    const date = new Date(premiere.startTime);
    return date.toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusBadge = () => {
    if (isLive) {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-600 text-white">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span>LIVE</span>
        </span>
      );
    }
    if (isScheduled) {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-600 text-white">
          SCHEDULED
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-600 text-white">
        ENDED
      </span>
    );
  };

  const actionButton = () => {
    if (isLive) {
      return (
        <button
          onClick={() => {
            onJoin?.();
            onClose();
          }}
          className="w-full px-4 py-3 rounded-lg font-semibold transition-colors hover:opacity-90"
          style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
        >
          Join Premiere Now
        </button>
      );
    }
    if (isScheduled) {
      return (
        <button
          disabled
          className="w-full px-4 py-3 rounded-lg font-semibold opacity-60 cursor-not-allowed"
          style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text)' }}
        >
          Starts in {formatCountdown()}
        </button>
      );
    }
    return (
      <button
        disabled
        className="w-full px-4 py-3 rounded-lg font-semibold opacity-60 cursor-not-allowed"
        style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text)' }}
      >
        This premiere has ended
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--color-secondary)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Poster */}
        <div className="relative aspect-video" style={{ backgroundColor: 'var(--color-hover)' }}>
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={premiere.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl">🎬</div>
          )}
          <div className="absolute top-3 left-3">{statusBadge()}</div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-black bg-opacity-60 text-white hover:bg-opacity-80"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
              {premiere.title}
            </h2>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Created by {premiere.createdBy?.username ?? 'unknown'}
            </p>
          </div>

          <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text)' }}>
            {premiere.description || 'No description provided.'}
          </p>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                {isLive ? 'Started at' : 'Scheduled for'}
              </div>
              <div style={{ color: 'var(--color-text)' }}>{formatStartAt()}</div>
            </div>
            {isScheduled && (
              <div>
                <div className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Starts in
                </div>
                <div style={{ color: 'var(--color-text)' }}>{formatCountdown()}</div>
              </div>
            )}
            {premiere.video?.duration && (
              <div>
                <div className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Duration
                </div>
                <div style={{ color: 'var(--color-text)' }}>
                  {formatVideoDuration(premiere.video.duration)}
                </div>
              </div>
            )}
            {isLive && (
              <div>
                <div className="font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Viewers
                </div>
                <div style={{ color: 'var(--color-text)' }}>{premiere.totalViewers ?? 0}</div>
              </div>
            )}
          </div>

          {/* Action */}
          <div className="pt-2">{actionButton()}</div>
          {!isEnded && !isLive && (
            <p className="text-xs opacity-75" style={{ color: 'var(--color-text-secondary)' }}>
              This dialog will auto-open the premiere when it goes live.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PremiereDetailModal;
