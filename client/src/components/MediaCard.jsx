// client/src/components/MediaCard.jsx
import { isVideoFormat, getCleanMediaLabel } from '../utils/mediaUtils';

/**
 * Reusable Gold-Standard Media Card for all VTT Pickers and Grids.
 * Automatically handles:
 * - Videos (.mp4, .webm, .mov) vs Static Images (.png, .webp, .jpg)
 * - Aspect preservation with dark letterbox (object-contain)
 * - Hover scaling and gold accent glow
 * - Text label sanitization (strips extensions & underscores)
 */
export default function MediaCard({
  url,
  filename,
  label,
  onClick,
  onDoubleClick,
  aspect = 'aspect-square',
  showLabel = true,
  className = '',
}) {
  const isVideo = isVideoFormat(url || filename);
  const displayLabel = label || getCleanMediaLabel(filename || url);

  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`group flex flex-col items-center bg-bgCard rounded-lg border border-borderDark hover:border-accentGold transition-all hover:scale-105 focus:outline-none focus:ring-2 focus:ring-accentGold overflow-hidden ${className}`}
    >
      {/* Media Containment Frame */}
      <div className={`w-full ${aspect} bg-bgPanel flex items-center justify-center p-1 relative overflow-hidden`}>
        {isVideo ? (
          <>
            <video
              src={url}
              muted
              loop
              playsInline
              autoPlay
              crossOrigin="anonymous"
              className="w-full h-full object-contain rounded pointer-events-none"
            />
            {/* Play indicator badge */}
            <div className="absolute top-1 right-1 bg-black/60 rounded px-1 text-[8px] text-accentGold opacity-75 group-hover:opacity-100">
              ▶
            </div>
          </>
        ) : (
          <img
            src={url}
            alt={displayLabel}
            crossOrigin="anonymous"
            loading="lazy"
            className="w-full h-full object-contain rounded pointer-events-none"
          />
        )}
      </div>

      {/* Label Sub-Bar */}
      {showLabel && (
        <span className="text-[9px] text-textMuted truncate w-full text-center px-1.5 py-1 group-hover:text-white transition-colors">
          {displayLabel}
        </span>
      )}
    </button>
  );
}