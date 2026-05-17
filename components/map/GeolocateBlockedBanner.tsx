'use client';

import { useState } from 'react';
import { Icon } from '@/components/icons/Icon';

// Persistent (not auto-dismissed) recovery instructions when the user
// taps the geolocate button while permission has been previously
// denied. Replaces the missable toast that today's `handleGeolocate`
// fires on PERMISSION_DENIED. See #71.

// iPadOS 13+ reports as Macintosh by default; we check touch + Safari to
// catch the masquerade. macOS Safari hits the same gesture-chain limit as
// iOS Safari, so we treat it the same way for the purposes of this banner.
function detectPlatform(): 'ios-safari' | 'macos-safari' | 'android-chrome' | 'desktop' | 'unknown' {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  const isSafari = /^((?!chrome|crios|android).)*safari/i.test(ua);
  if (/iP(hone|ad|od)/.test(ua)) return 'ios-safari';
  if (/Macintosh/.test(ua) && 'ontouchend' in document) return 'ios-safari'; // iPad masquerade
  if (/Android/i.test(ua)) return 'android-chrome';
  if (/Macintosh/.test(ua) && isSafari) return 'macos-safari';
  if (/Windows|Macintosh|Linux/i.test(ua)) return 'desktop';
  return 'unknown';
}

interface Step {
  text: string;
  emphasis?: string;
}

function stepsFor(platform: ReturnType<typeof detectPlatform>): Step[] {
  switch (platform) {
    case 'android-chrome':
      return [
        { text: 'Tap the lock icon left of the URL' },
        { text: 'Open', emphasis: 'Permissions' },
        { text: 'Toggle', emphasis: 'Location → Allow' },
        { text: 'Refresh this page' },
      ];
    case 'desktop':
      return [
        { text: 'Click the lock icon in the address bar' },
        { text: 'Open', emphasis: 'Site settings' },
        { text: 'Set', emphasis: 'Location → Allow' },
        { text: 'Refresh this page' },
      ];
    default:
      return [
        { text: 'Open browser settings for this site' },
        { text: 'Set', emphasis: 'Location → Allow' },
        { text: 'Refresh this page' },
      ];
  }
}

export function GeolocateBlockedBanner({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // Lazy init — detectPlatform() self-guards for SSR and the banner only
  // renders post-interaction (open), so there's no hydration mismatch.
  const [platform] = useState<ReturnType<typeof detectPlatform>>(detectPlatform);
  if (!open) return null;
  const isAppleSafari = platform === 'ios-safari' || platform === 'macos-safari';
  const settingsPath =
    platform === 'ios-safari'
      ? 'Settings → Safari → Location'
      : 'Safari → Settings → Websites → Location';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/30 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl border border-[var(--surface-border)] bg-white p-6 shadow-float sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="geolocate-blocked-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-red-tint text-accent-red">
            <Icon name="WarningCircle" size={22} weight="fill" />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sys-gray-6 text-[var(--text-secondary)] hover:bg-sys-gray-5 transition"
          >
            <Icon name="X" size={14} />
          </button>
        </div>

        <h2
          id="geolocate-blocked-title"
          className="mt-4 text-[20px] font-bold leading-tight text-[var(--text-primary)]"
        >
          Location is blocked for this site
        </h2>

        {/* Apple platforms: short, action-oriented copy. We can't deep-link
            to Settings from a non-installed PWA in Safari, but stating the
            exact path beats a 4-step list. See #104. */}
        {isAppleSafari ? (
          <>
            <p className="mt-1 text-[14px] leading-snug text-[var(--text-secondary)]">
              Safari has cached your earlier choice. We can&rsquo;t ask
              again until you re-enable location for this site.
            </p>
            <div className="mt-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--map-bg)] px-3 py-3">
              <p className="text-[13px] text-[var(--text-secondary)]">Open</p>
              <p className="mt-1 font-mono text-[13px] font-semibold text-[var(--text-primary)]">
                {settingsPath}
              </p>
              <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
                set this site to <span className="font-mono font-semibold">Allow</span>, then come
                back and tap the find-me button again.
              </p>
            </div>
          </>
        ) : (
          <>
            <p className="mt-1 text-[14px] leading-snug text-[var(--text-secondary)]">
              Your browser is rejecting the location request before it can reach us.
              Re-enable it in your browser to use the find-me button.
            </p>
            <ol className="mt-4 flex flex-col gap-2">
              {stepsFor(platform).map((s, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--map-bg)] px-3 py-2.5 text-[14px] text-[var(--text-primary)]"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
                    {i + 1}
                  </span>
                  <span className="flex-1">
                    {s.text}
                    {s.emphasis ? (
                      <>
                        {' '}
                        <span className="rounded-md bg-sys-gray-6 px-1.5 py-0.5 font-mono text-[12px] font-semibold">
                          {s.emphasis}
                        </span>
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}

        <p className="mt-4 text-[12px] text-[var(--text-tertiary)]">
          Until then the map will use the rough city-level guess from your
          IP, which is usually wrong on mobile networks.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-[var(--surface-border)] bg-white px-3 py-3 text-[14px] font-semibold text-[var(--text-primary)] hover:bg-sys-gray-6"
        >
          {isAppleSafari ? 'I’ll do it now' : 'Got it'}
        </button>
      </div>
    </div>
  );
}
