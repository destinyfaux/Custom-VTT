// client/src/utils/mediaUtils.js
import { SERVER_URL } from '../config';

export const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.ogg']);
export const AUDIO_EXTENSIONS = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.webm', '.aac', '.opus']);
export const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);

/**
 * Checks if a filename or URL points to a video format.
 */
export const isVideoFormat = (pathOrUrl = '') => {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return false;
  const cleanPath = pathOrUrl.split('?')[0].toLowerCase();
  const ext = cleanPath.slice(cleanPath.lastIndexOf('.'));
  return VIDEO_EXTENSIONS.has(ext);
};

/**
 * Checks if a filename or URL points to an audio format.
 */
export const isAudioFormat = (pathOrUrl = '') => {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return false;
  const cleanPath = pathOrUrl.split('?')[0].toLowerCase();
  const ext = cleanPath.slice(cleanPath.lastIndexOf('.'));
  return AUDIO_EXTENSIONS.has(ext);
};

/**
 * Checks if a filename or URL points to a static image format.
 */
export const isImageFormat = (pathOrUrl = '') => {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return false;
  const cleanPath = pathOrUrl.split('?')[0].toLowerCase();
  const ext = cleanPath.slice(cleanPath.lastIndexOf('.'));
  return IMAGE_EXTENSIONS.has(ext);
};

/**
 * Strips file extension and replaces dashes/underscores with spaces for UI titles.
 */
export const getCleanMediaLabel = (filename = '') => {
  if (!filename || typeof filename !== 'string') return '';
  return filename
    .split('?')[0]
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]/g, ' ')
    .trim();
};

/**
 * Safely resolves an asset path to a full URL.
 */
export const resolveMediaUrl = (endpoint, filename) => {
  if (!filename) return '';
  if (
    filename.startsWith('http://') ||
    filename.startsWith('https://') ||
    filename.startsWith('blob:') ||
    filename.startsWith('data:')
  ) {
    return filename;
  }
  const baseUrl = (SERVER_URL || '').replace(/\/+$/, '');
  const cleanEndpoint = endpoint.replace(/^\/+|\/+$/g, '');
  return `${baseUrl}/${cleanEndpoint}/${encodeURIComponent(filename)}`;
};

/**
 * Asynchronously probes natural dimensions for either an image or a video.
 * Returns Promise<{ width: number, height: number }>
 */
export const extractMediaDimensions = (url) => {
  return new Promise((resolve) => {
    if (!url) {
      resolve({ width: 0, height: 0 });
      return;
    }

    if (isVideoFormat(url)) {
      const video = document.createElement('video');
      video.src = url;
      video.preload = 'metadata';
      video.crossOrigin = 'anonymous';

      video.onloadedmetadata = () => {
        resolve({ width: video.videoWidth || 0, height: video.videoHeight || 0 });
      };

      video.onerror = () => {
        console.warn(`[mediaUtils] Failed to extract dimensions for video: ${url}`);
        resolve({ width: 0, height: 0 });
      };
    } else {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        resolve({ width: img.naturalWidth || 0, height: img.naturalHeight || 0 });
      };

      img.onerror = () => {
        console.warn(`[mediaUtils] Failed to load static image: ${url}`);
        resolve({ width: 0, height: 0 });
      };

      img.src = url;
    }
  });
};