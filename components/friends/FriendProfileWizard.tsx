'use client';

import { useState } from 'react';
import { Icon, type PhosphorIconName } from '@/components/icons/Icon';
import { Section } from '@/components/ui/Section';
import { Chip } from '@/components/ui/Chip';

export interface FriendProfileInitial {
  occupation: string | null;
  work_style: WorkStyle | null;
  looking_for: string[];
  industry: string[];
  gender: Gender | null;
  open_to: string[];
  bio: string | null;
}

type WorkStyle = 'quiet_focus' | 'brainstormer' | 'idea_bouncer' | 'company_only';
type Gender = 'woman' | 'man' | 'prefer_not_to_say';

type Step = 'occupation' | 'work_style' | 'looking_for' | 'industry' | 'identity' | 'bio';

const STEPS: { id: Step; title: string }[] = [
  { id: 'occupation', title: 'Occupation' },
  { id: 'work_style', title: 'Work style' },
  { id: 'looking_for', title: 'Looking for' },
  { id: 'industry', title: 'Industry' },
  { id: 'identity', title: 'Identity' },
  { id: 'bio', title: 'About you' },
];

const OCCUPATIONS = [
  'Entrepreneur',
  'Employee',
  'Freelancer',
  'Student',
  'Creative',
  'IT / Engineering',
  'Arts',
  'Other',
];

const WORK_STYLES: { value: WorkStyle; label: string; icon: PhosphorIconName; hint: string }[] = [
  { value: 'quiet_focus', label: 'Quiet focus', icon: 'Brain', hint: 'Heads-down work; minimal chat' },
  { value: 'brainstormer', label: 'Brainstormer', icon: 'Lightbulb', hint: 'I think out loud' },
  { value: 'idea_bouncer', label: 'Idea bouncer', icon: 'ChatsCircle', hint: 'Talk through problems together' },
  { value: 'company_only', label: 'Just need company', icon: 'Coffee', hint: 'Body double, working alongside' },
];

const LOOKING_FOR = [
  { value: 'cowork', label: 'Cowork partner' },
  { value: 'brainstorm', label: 'Brainstorm' },
  { value: 'project', label: 'Project collab' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'mentee', label: 'Mentee' },
  { value: 'social', label: 'Social' },
];

const INDUSTRIES = [
  'Tech',
  'Design',
  'Writing',
  'Finance',
  'Marketing',
  'Education',
  'Health',
  'Other',
];

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const OPEN_TO = [
  { value: 'women', label: 'Women' },
  { value: 'men', label: 'Men' },
  { value: 'anyone', label: 'Anyone' },
];

export function FriendProfileWizard({
  initial,
  onSubmitted,
  compact = false,
}: {
  initial: FriendProfileInitial;
  onSubmitted: () => void;
  compact?: boolean;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  const [occupation, setOccupation] = useState<string | null>(initial.occupation);
  const [workStyle, setWorkStyle] = useState<WorkStyle | null>(initial.work_style);
  const [lookingFor, setLookingFor] = useState<string[]>(initial.looking_for);
  const [industry, setIndustry] = useState<string[]>(initial.industry);
  const [gender, setGender] = useState<Gender | null>(initial.gender);
  const [openTo, setOpenTo] = useState<string[]>(initial.open_to);
  const [bio, setBio] = useState(initial.bio ?? '');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleArr = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const goNext = () => {
    if (submitting) return;
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
  };
  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const resp = await fetch('/api/friend-profiles', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          occupation,
          work_style: workStyle,
          looking_for: lookingFor,
          industry,
          gender,
          open_to: openTo,
          bio,
        }),
      });
      if (resp.status === 401) {
        window.location.assign('/auth?next=' + encodeURIComponent(window.location.pathname));
        return;
      }
      if (!resp.ok && resp.status !== 503) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error ?? `request failed (${resp.status})`);
      }
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className={
        compact
          ? 'flex h-full min-h-0 w-full flex-1 flex-col bg-white'
          : 'flex min-h-dvh flex-col bg-[var(--map-bg)] pb-28'
      }
    >
      <header
        className={
          compact
            ? 'shrink-0 border-b border-[var(--surface-border)] bg-white/95 backdrop-blur-ios'
            : 'sticky top-0 z-10 border-b border-[var(--surface-border)] bg-white/90 backdrop-blur-ios'
        }
      >
        <div className={`mx-auto flex max-w-2xl items-center justify-between ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
          <div className={compact ? 'w-8' : 'w-9'} />
          <div className="flex flex-col items-center text-center">
            <div
              className={`font-medium uppercase tracking-wide text-[var(--text-tertiary)] ${
                compact ? 'text-[10px]' : 'text-[11px]'
              }`}
            >
              Step {stepIndex + 1} of {STEPS.length}
            </div>
            <div className={`font-semibold text-[var(--text-primary)] ${compact ? 'text-[13px]' : 'text-[14px]'}`}>
              {step.title}
            </div>
          </div>
          <div className={compact ? 'w-8' : 'w-9'} />
        </div>
        <div className={`mx-auto flex max-w-2xl gap-1 ${compact ? 'px-3 pb-2' : 'px-4 pb-3'}`}>
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

      <div className={`mx-auto w-full max-w-2xl ${compact ? 'min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4' : 'flex-1 px-5 pt-5'}`}>
        {step.id === 'occupation' && (
          <Section title="What do you do?">
            <div className="flex flex-wrap gap-2">
              {OCCUPATIONS.map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  active={occupation === opt}
                  onClick={() => setOccupation(opt)}
                />
              ))}
            </div>
          </Section>
        )}

        {step.id === 'work_style' && (
          <Section title="How do you work?">
            <div className="space-y-2">
              {WORK_STYLES.map((opt) => {
                const active = workStyle === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setWorkStyle(opt.value)}
                    className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
                      active
                        ? 'border-accent bg-accent-tint'
                        : 'border-[var(--surface-border)] bg-white hover:bg-sys-gray-6'
                    }`}
                    aria-pressed={active}
                  >
                    <Icon
                      name={active ? 'CheckCircle' : 'Circle'}
                      weight={active ? 'fill' : 'regular'}
                      size={20}
                      className={active ? 'text-accent' : 'text-[var(--text-tertiary)]'}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Icon name={opt.icon} size={16} className="text-[var(--text-secondary)]" />
                        <span className="text-[14px] font-semibold text-[var(--text-primary)]">{opt.label}</span>
                      </div>
                      <div className="mt-0.5 text-[12px] text-[var(--text-secondary)]">{opt.hint}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {step.id === 'looking_for' && (
          <Section title="Looking for" subtitle="Pick everything that applies — multiple ok.">
            <div className="flex flex-wrap gap-2">
              {LOOKING_FOR.map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  active={lookingFor.includes(opt.value)}
                  onClick={() => setLookingFor(toggleArr(lookingFor, opt.value))}
                />
              ))}
            </div>
          </Section>
        )}

        {step.id === 'industry' && (
          <Section title="Industry" subtitle="What field(s) do you work in?">
            <div className="flex flex-wrap gap-2">
              {INDUSTRIES.map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  active={industry.includes(opt)}
                  onClick={() => setIndustry(toggleArr(industry, opt))}
                />
              ))}
            </div>
          </Section>
        )}

        {step.id === 'identity' && (
          <>
            <Section title="You are">
              <div className="flex flex-wrap gap-2">
                {GENDERS.map((opt) => (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    active={gender === opt.value}
                    onClick={() => setGender(opt.value)}
                  />
                ))}
              </div>
            </Section>
            <Section title="Open to working with" subtitle="Pick all you're open to.">
              <div className="flex flex-wrap gap-2">
                {OPEN_TO.map((opt) => (
                  <Chip
                    key={opt.value}
                    label={opt.label}
                    active={openTo.includes(opt.value)}
                    onClick={() => setOpenTo(toggleArr(openTo, opt.value))}
                  />
                ))}
              </div>
            </Section>
          </>
        )}

        {step.id === 'bio' && (
          <Section title="A line about you" subtitle="Optional — what should others know?">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 280))}
              rows={4}
              placeholder="e.g. Building a startup, looking for someone to bounce ideas with."
              className="w-full resize-none rounded-xl border border-[var(--surface-border)] bg-white px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <div className="mt-1 text-right text-[10px] text-[var(--text-tertiary)]">
              {bio.length}/280
            </div>
          </Section>
        )}
      </div>

      <div
        className={
          compact
            ? 'shrink-0 border-t border-[var(--surface-border)] bg-white/95 px-4 py-3 backdrop-blur-ios'
            : 'fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--surface-border)] bg-white/95 p-4 backdrop-blur-ios'
        }
      >
        <div className={`mx-auto flex max-w-2xl items-center ${compact ? 'gap-2' : 'gap-3'}`}>
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
            {error && (
              <div className="mb-2 rounded-xl bg-accent-red-tint p-2 text-center text-[12px] text-accent-red">
                {error}
              </div>
            )}
            {isLast ? (
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-2xl bg-accent py-3.5 text-[15px] font-semibold text-white hover:opacity-90 disabled:bg-sys-gray-4 disabled:cursor-not-allowed transition"
              >
                {submitting ? 'Saving…' : 'Save profile'}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                disabled={submitting}
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
