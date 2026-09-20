export type DeviceMode = 'mobile' | 'tablet' | 'pc';
export type LayoutPreference = 'auto' | 'pc' | 'tablet' | 'mobile';

/**
 * Accurately detects whether the current device is mobile, tablet, or PC/desktop.
 * Uses a combination of viewport resolution, aspect ratio, touch/pointer capabilities,
 * orientation, and platform signatures.
 */
export function detectDeviceMode(): DeviceMode {
  if (typeof window === 'undefined') return 'pc';

  const width = window.innerWidth;
  const height = window.innerHeight;
  const minDim = Math.min(width, height);
  const maxDim = Math.max(width, height);

  // Check hardware & pointer capabilities
  const maxTouchPoints = typeof navigator !== 'undefined' ? (navigator.maxTouchPoints || 0) : 0;
  const hasTouch = ('ontouchstart' in window) || maxTouchPoints > 0;
  const isFinePointer = window.matchMedia?.('(pointer: fine)')?.matches ?? false;
  const isCoarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  const hasHover = window.matchMedia?.('(hover: hover)')?.matches ?? false;

  // Check user agent / platform heuristics
  const ua = (typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '').toLowerCase();
  const isPhoneUA = /iphone|ipod|windows phone|blackberry/i.test(ua) || (/android/i.test(ua) && /mobile/i.test(ua));
  const isTabletUA = /ipad|tablet|silk|kindle|playbook/i.test(ua) ||
    (/android/i.test(ua) && !/mobile/i.test(ua)) ||
    // iPadOS 13+ reports as Macintosh on Safari, but has touch points
    (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && maxTouchPoints > 1);

  // 1. Definite mobile phone:
  // - Narrow screen width (< 640px)
  // - Smallest screen dimension < 500px (e.g. phone in landscape: 844x390, 896x414, 915x412)
  // - User agent is specifically phone with width <= 768px
  if (width < 640 || minDim < 500 || (isPhoneUA && width <= 768)) {
    return 'mobile';
  }

  // 2. Definite tablet:
  // - Explicit tablet UA with screen <= 1366px
  // - Touchscreen device with width between 640px and 1080px (e.g. iPad, Galaxy Tab)
  // - Width between 640px and 1024px without pure desktop fine mouse/hover
  if (
    isTabletUA ||
    (hasTouch && width >= 640 && width <= 1080) ||
    (!isPhoneUA && width >= 640 && width < 1024 && (!hasHover || isCoarsePointer))
  ) {
    // Large tablet in landscape with high-end desktop-like screen width (>= 1200px) and mouse/trackpad
    if (width >= 1200 && isFinePointer && hasHover && !isTabletUA) {
      return 'pc';
    }
    return 'tablet';
  }

  // 3. PC / Desktop:
  // - Large screens (>= 1024px) with mouse/trackpad or desktop browsers
  return 'pc';
}
