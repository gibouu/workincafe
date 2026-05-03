'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon, type PhosphorIconName } from '@/components/icons/Icon';
import { Section } from '@/components/ui/Section';
import { Chip } from '@/components/ui/Chip';
import { categoryMeta } from '@/lib/categories';
import type { DemoPlace } from '@/lib/demo/paris-places';
import { preparePhoto, type PreparedPhoto } from '@/lib/review/photos';
import { createClient as createBrowserClient } from '@/lib/supabase/client';

type Role = 'owner' | 'manager' | 'authorized_rep';
type ProofType = 'storefront_photo' | 'business_doc' | 'website_email' | 'other';

interface ClaimWizardProps {
  place: DemoPlace;
  defaultEmail?: string;
}

type Step = 'place' | 'role' | 'email' | 'proof' | 'review' | 'submit';

const STEPS: { id: Step; title: string }[] = [
  { id: 'place', title: 'Confirm place' },
  { id: 'role', title: 'Your role' },
  { id: 'email', title: 'Contact' },
  { id: 'proof', title: 'Proof' },
  { id: 'review', title: 'Review' },
];

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'authorized_rep', label: 'Authorized rep' },
];

const PROOF_OPTIONS: { value: ProofType; label: string; icon: PhosphorIconName }[] = [
  { value: 'storefront_photo', label: 'Storefront photo with note', icon: 'Storefront' },
  { value: 'business_doc', label: 'Business registration document', icon: 'FileText' },
  { value: 'website_email', label: 'Email at the place’s domain', icon: 'EnvelopeSimple' },
  { value: 'other', label: 'Something else', icon: 'Question' },
];

export function ClaimWizard({ place, defaultEmail }: ClaimWizardProps) {
  const meta = categoryMeta(place.category);
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex] ?? { id: 'submit' as Step, title: 'Done' };
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  const [role, setRole] = useState<Role | null>(null);
  const [email, setEmail] = useState(defaultEmail ?? '');
  const [name, setName] = useState('');
  const [proofType, setProofType] = useState<ProofType | null>(null);
  const [proofPhoto, setProofPhoto] = useState<PreparedPhoto | null>(null);
  const [proofNotes, setProofNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const blockedReason: string | null =
    step.id === 'role' && !role
      ? 'Pick your role to continue'
      : step.id === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
        ? 'Enter a valid email'
        : step.id === 'proof' && !proofType
          ? 'Pick a proof type'
          : null;
  const canAdvance = blockedReason === null && !submitting;

  const goNext = () => {
    if (!canAdvance) return;
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
  };
  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));

  const onPhotoFile = async (file: File) => {
    setSubmitError(null);
    try {
      const prepared = await preparePhoto(file);
      setProofPhoto(prepared);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not read photo');
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let proofPath: string | null = null;
      if (proofPhoto) {
        const supabase = createBrowserClient();
        const path = `${Date.now()}/${place.id}.jpg`;
        const { error } = await supabase.storage
          .from('claim-proofs')
          .upload(path, proofPhoto.blob, { contentType: 'image/jpeg', upsert: true });
        if (!error) proofPath = path;
      }

      const resp = await fetch('/api/place-claims', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          place_id: place.id,
          claimant_email: email.trim(),
          claimant_name: name.trim() || null,
          proof_type: proofType,
          proof_path: proofPath,
          proof_notes: `Role: ${role}${proofNotes ? `\n\n${proofNotes}` : ''}`,
        }),
      });
      if (resp.status === 401) {
        window.location.assign(
          `/auth?next=${encodeURIComponent(`/place/${place.id}/claim`)}`,
        );
        return;
      }
      if (!resp.ok && resp.status !== 503 && resp.status !== 404) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error ?? `request failed (${resp.status})`);
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--map-bg)] px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-green-tint">
          <Icon name="CheckCircle" weight="fill" size={44} className="text-accent-green" />
        </div>
        <h1 className="mt-5 text-[28px] font-bold text-[var(--text-primary)]">Submitted</h1>
        <p className="mt-2 max-w-xs text-[14px] text-[var(--text-secondary)]">
          We&apos;ll review your claim and email <strong>{email}</strong> with the result.
        </p>
        <Link
          href="/"
          className="mt-8 rounded-2xl bg-accent px-6 py-3 text-[15px] font-semibold text-white hover:opacity-90 transition"
        >
          Back to map
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex min-h-dvh flex-col bg-[var(--map-bg)] pb-28">
      <header className="sticky top-0 z-10 border-b border-[var(--surface-border)] bg-white/90 backdrop-blur-ios">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-sys-gray-6"
            aria-label="Back to map"
          >
            <Icon name="X" size={18} />
          </Link>
          <div className="flex flex-col items-center text-center">
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
              Step {stepIndex + 1} of {STEPS.length}
            </div>
            <div className="text-[14px] font-semibold text-[var(--text-primary)]">{step.title}</div>
          </div>
          <div className="w-9" />
        </div>
        <div className="mx-auto flex max-w-2xl gap-1 px-4 pb-3">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= stepIndex ? 'bg-accent' : 'bg-sys-gray-5'
              }`}
            />
          ))}
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-5 pt-5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-bubble"
            style={{ background: meta.color }}
          >
            <Icon name={meta.icon} size={18} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-[var(--text-primary)]">
              {place.name}
            </div>
            <div className="truncate text-[11px] text-[var(--text-secondary)]">
              {place.address} · {place.neighborhood}
            </div>
          </div>
        </div>

        {step.id === 'place' && (
          <Section title="Is this your place?" subtitle="If something looks wrong, contact us before submitting.">
            <p className="text-[13px] text-[var(--text-secondary)]">
              You&apos;re claiming <strong>{place.name}</strong> at {place.address}, {place.neighborhood}.
            </p>
          </Section>
        )}

        {step.id === 'role' && (
          <Section title="Your role at the place">
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  active={role === opt.value}
                  onClick={() => setRole(opt.value)}
                />
              ))}
            </div>
          </Section>
        )}

        {step.id === 'email' && (
          <Section title="Where should we email you?">
            <label className="block">
              <div className="text-[12px] font-medium text-[var(--text-secondary)]">Email</div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@cafe.com"
                className="mt-1 w-full rounded-xl border border-[var(--surface-border)] bg-white px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
            <label className="mt-3 block">
              <div className="text-[12px] font-medium text-[var(--text-secondary)]">
                Your name (optional)
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First Last"
                className="mt-1 w-full rounded-xl border border-[var(--surface-border)] bg-white px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
          </Section>
        )}

        {step.id === 'proof' && (
          <>
            <Section title="How will you prove ownership?">
              <div className="space-y-2">
                {PROOF_OPTIONS.map((opt) => {
                  const active = proofType === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setProofType(opt.value)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                        active
                          ? 'border-accent bg-accent-tint'
                          : 'border-[var(--surface-border)] bg-white hover:bg-sys-gray-6'
                      }`}
                    >
                      <Icon
                        name={opt.icon}
                        size={18}
                        className={active ? 'text-accent' : 'text-[var(--text-secondary)]'}
                      />
                      <span className="text-[14px] text-[var(--text-primary)]">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </Section>
            <Section
              title="Photo (optional)"
              subtitle="A storefront photo with a handwritten note showing your name + today’s date works great."
            >
              <ProofPhotoSlot photo={proofPhoto} onPick={onPhotoFile} onClear={() => setProofPhoto(null)} />
            </Section>
            <Section title="Notes (optional)">
              <textarea
                value={proofNotes}
                onChange={(e) => setProofNotes(e.target.value.slice(0, 500))}
                placeholder="Anything else we should know?"
                rows={3}
                className="w-full resize-none rounded-xl border border-[var(--surface-border)] bg-white px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <div className="mt-1 text-right text-[10px] text-[var(--text-tertiary)]">
                {proofNotes.length}/500
              </div>
            </Section>
          </>
        )}

        {step.id === 'review' && (
          <Section title="Review your claim">
            <dl className="space-y-2 text-[13px]">
              <ReviewRow label="Place" value={`${place.name} · ${place.neighborhood}`} />
              <ReviewRow label="Role" value={ROLE_OPTIONS.find((o) => o.value === role)?.label ?? '—'} />
              <ReviewRow label="Email" value={email} />
              {name && <ReviewRow label="Name" value={name} />}
              <ReviewRow
                label="Proof"
                value={PROOF_OPTIONS.find((o) => o.value === proofType)?.label ?? '—'}
              />
              <ReviewRow label="Photo attached" value={proofPhoto ? 'Yes' : 'No'} />
              {proofNotes && <ReviewRow label="Notes" value={proofNotes} />}
            </dl>
          </Section>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--surface-border)] bg-white/95 p-4 backdrop-blur-ios">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          {!isFirst && (
            <button
              type="button"
              onClick={goBack}
              disabled={submitting}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[var(--surface-border)] bg-white text-[var(--text-primary)] hover:bg-sys-gray-6 disabled:opacity-60"
              aria-label="Back"
            >
              <Icon name="ArrowLeft" size={20} />
            </button>
          )}
          <div className="flex-1">
            {submitError && (
              <div className="mb-2 rounded-xl bg-accent-red-tint p-2 text-center text-[12px] text-accent-red">
                {submitError}
              </div>
            )}
            {blockedReason && (
              <div className="mb-2 text-center text-[11px] text-[var(--text-tertiary)]">
                {blockedReason}
              </div>
            )}
            {isLast ? (
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-2xl bg-accent py-3.5 text-[15px] font-semibold text-white hover:opacity-90 disabled:bg-sys-gray-4 disabled:cursor-not-allowed transition"
              >
                {submitting ? 'Submitting…' : 'Submit claim'}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                disabled={!canAdvance}
                className="w-full rounded-2xl bg-accent py-3.5 text-[15px] font-semibold text-white hover:opacity-90 disabled:bg-sys-gray-4 disabled:cursor-not-allowed transition"
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-[var(--text-tertiary)]">{label}</dt>
      <dd className="text-right font-medium text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}

function ProofPhotoSlot({
  photo,
  onPick,
  onClear,
}: {
  photo: PreparedPhoto | null;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--surface-border)] bg-[var(--map-bg)]">
      {photo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={URL.createObjectURL(photo.blob)}
            alt="Proof"
            className="aspect-[4/3] w-full object-cover"
          />
          <button
            type="button"
            onClick={onClear}
            aria-label="Remove photo"
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
          >
            <Icon name="X" size={14} />
          </button>
        </>
      ) : (
        <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center px-4 text-center">
          <Icon name="Camera" size={28} className="text-[var(--text-secondary)]" />
          <div className="mt-2 text-[13px] font-semibold text-[var(--text-primary)]">
            Add a photo
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
            Storefront with a handwritten note works best.
          </div>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick(f);
              e.target.value = '';
            }}
          />
        </label>
      )}
    </div>
  );
}
