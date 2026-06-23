'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Icon } from '@/components/icons/Icon';
import { CLOUDINARY_CLOUD_NAME } from '@/lib/cloudinary';
import { preparePhoto } from '@/lib/review/photos';

interface MenuRow {
  id: string;
  label: string | null;
  cloudinary_public_id: string;
  cloudinary_version: string | null;
  width: number | null;
  height: number | null;
  file_kind: 'image' | 'pdf';
  visibility: 'public' | 'owner_only';
}

function thumbUrl(m: MenuRow): string {
  if (!CLOUDINARY_CLOUD_NAME) return '';
  const version = m.cloudinary_version ? `${m.cloudinary_version}/` : '';
  // Cloudinary auto-rasterises PDFs to a JPEG at delivery time, so the
  // image URL is the same shape for both file kinds. Page 1 only.
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${version}${m.cloudinary_public_id}`;
}

export function OwnerMenuManager({ placeId }: { placeId: string }) {
  const [menus, setMenus] = useState<MenuRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let aborted = false;
    fetch(`/api/places/${encodeURIComponent(placeId)}/menus`)
      .then((r) => (r.ok ? r.json() : { menus: [] }))
      .then((data: { menus?: MenuRow[] }) => {
        if (!aborted) {
          setMenus(data.menus ?? []);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!aborted) setLoaded(true);
      });
    return () => {
      aborted = true;
    };
  }, [placeId]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      // Images go through preparePhoto (resize + EXIF strip + HEIC convert).
      // PDFs upload as-is — Cloudinary handles them on the image/upload
      // pipeline and rasterises page 1 for display.
      const prepared = isPdf
        ? { blob: file, width: 0, height: 0, bytes: file.size }
        : await preparePhoto(file);
      const folder = `owner-menus/${placeId}`;
      const signResp = await fetch('/api/cloudinary/sign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ folder }),
      });
      if (!signResp.ok) {
        const body = (await signResp.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `sign failed (${signResp.status})`);
      }
      const sig = (await signResp.json()) as {
        signature: string;
        timestamp: number;
        api_key: string;
        cloud_name: string;
        folder: string;
        overwrite?: boolean;
        public_id?: string;
      };

      const fd = new FormData();
      fd.append('file', prepared.blob);
      fd.append('api_key', sig.api_key);
      fd.append('timestamp', String(sig.timestamp));
      fd.append('signature', sig.signature);
      fd.append('folder', sig.folder);
      if (typeof sig.overwrite === 'boolean') fd.append('overwrite', String(sig.overwrite));
      if (sig.public_id) fd.append('public_id', sig.public_id);

      const upResp = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`, {
        method: 'POST',
        body: fd,
      });
      if (!upResp.ok) throw new Error(`upload failed (${upResp.status})`);
      const result = (await upResp.json()) as {
        public_id: string;
        version: number;
        width: number;
        height: number;
        bytes: number;
      };

      const recordResp = await fetch(`/api/owner/places/${encodeURIComponent(placeId)}/menus`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cloudinary_public_id: result.public_id,
          cloudinary_version: String(result.version),
          width: result.width,
          height: result.height,
          bytes: result.bytes,
          file_kind: isPdf ? 'pdf' : 'image',
        }),
      });
      if (!recordResp.ok) {
        const body = (await recordResp.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `record failed (${recordResp.status})`);
      }
      const recorded = (await recordResp.json()) as { id: string };
      setMenus((prev) => [
        ...prev,
        {
          id: recorded.id,
          label: null,
          cloudinary_public_id: result.public_id,
          cloudinary_version: String(result.version),
          width: result.width,
          height: result.height,
          file_kind: isPdf ? 'pdf' : 'image',
          visibility: 'public',
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (menuId: string) => {
    setError(null);
    const prev = menus;
    setMenus((m) => m.filter((x) => x.id !== menuId));
    try {
      const resp = await fetch(
        `/api/owner/places/${encodeURIComponent(placeId)}/menus/${encodeURIComponent(menuId)}`,
        { method: 'DELETE' },
      );
      if (!resp.ok) throw new Error(`delete failed (${resp.status})`);
    } catch (err) {
      setMenus(prev);
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const toggleVisibility = async (menuId: string) => {
    setError(null);
    const prev = menus;
    const target = prev.find((m) => m.id === menuId);
    if (!target) return;
    const next = target.visibility === 'public' ? 'owner_only' : 'public';
    setMenus((list) => list.map((m) => (m.id === menuId ? { ...m, visibility: next } : m)));
    try {
      const resp = await fetch(
        `/api/owner/places/${encodeURIComponent(placeId)}/menus/${encodeURIComponent(menuId)}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ visibility: next }),
        },
      );
      if (!resp.ok) throw new Error(`patch failed (${resp.status})`);
    } catch (err) {
      setMenus(prev);
      setError(err instanceof Error ? err.message : 'Visibility update failed');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-(--text-primary)">
          Menus ({menus.length})
        </h2>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-xl border border-(--surface-border) bg-white px-3 py-1.5 text-[12px] font-medium text-(--text-primary) hover:bg-sys-gray-6 disabled:opacity-60"
        >
          <Icon name={busy ? 'CircleNotch' : 'Plus'} size={14} className={busy ? 'animate-spin' : ''} />
          <span>{busy ? 'Uploading…' : 'Add menu'}</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
          onChange={onFile}
          className="hidden"
        />
      </div>

      {!loaded ? (
        <div className="mt-3 rounded-2xl border border-(--surface-border) bg-white p-6 text-center text-[13px] text-(--text-secondary) shadow-card">
          Loading…
        </div>
      ) : menus.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-(--surface-border) bg-white p-6 text-center text-[13px] text-(--text-secondary) shadow-card">
          No menus yet. Tap &ldquo;Add menu&rdquo; to upload a photo of yours so
          customers can see what you serve.
        </div>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {menus.map((m) => {
            const url = thumbUrl(m);
            return (
              <li
                key={m.id}
                className="relative aspect-4/3 overflow-hidden rounded-2xl border border-(--surface-border) bg-sys-gray-6 shadow-card"
              >
                {url && (
                  <Image
                    src={url}
                    alt={m.label ?? 'Menu'}
                    fill
                    sizes="(max-width: 640px) 50vw, 33vw"
                    className="object-cover"
                  />
                )}
                {m.file_kind === 'pdf' && (
                  <span className="absolute bottom-1.5 left-1.5 z-10 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                    PDF
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => toggleVisibility(m.id)}
                  aria-label={m.visibility === 'public' ? 'Hide menu from public' : 'Make menu public'}
                  title={m.visibility === 'public' ? 'Visible to everyone — tap to hide' : 'Hidden draft — tap to publish'}
                  className={`absolute left-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full shadow-bubble ${
                    m.visibility === 'public'
                      ? 'bg-accent-green text-white hover:bg-accent-green/90'
                      : 'bg-sys-gray-3 text-white hover:bg-sys-gray-2'
                  }`}
                >
                  <Icon name={m.visibility === 'public' ? 'Eye' : 'EyeSlash'} size={13} />
                </button>
                {m.visibility === 'owner_only' && (
                  <span className="absolute inset-0 z-0 bg-black/30" />
                )}
                <button
                  type="button"
                  onClick={() => remove(m.id)}
                  aria-label="Remove menu"
                  className="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white shadow-bubble hover:bg-black/75"
                >
                  <Icon name="X" size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <div className="mt-3 rounded-xl bg-accent-red-tint p-3 text-[12px] text-accent-red">
          {error}
        </div>
      )}
    </div>
  );
}
