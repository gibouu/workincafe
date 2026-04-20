/**
 * Browser decibel test. Samples microphone RMS for `duration_seconds` seconds
 * and returns an approximate SPL in dB. Never uploads raw audio.
 *
 * The calculation is approximate — browser mic gains vary. We assume 0 dBFS maps
 * roughly to ~94 dB SPL at a typical laptop mic; callers treat results as relative.
 */

export interface DecibelResult {
  avg_db: number;
  peak_db: number;
  duration_seconds: number;
  samples: number;
}

interface AudioContextCtor {
  new (): AudioContext;
}

type AudioWindow = Window & {
  webkitAudioContext?: AudioContextCtor;
};

function getAudioContextCtor(): AudioContextCtor {
  if (typeof AudioContext !== 'undefined') return AudioContext;
  const w = window as AudioWindow;
  if (w.webkitAudioContext) return w.webkitAudioContext;
  throw new Error('AudioContext not supported');
}

function rmsDb(buffer: Float32Array): number {
  let sumSq = 0;
  for (let i = 0; i < buffer.length; i++) sumSq += buffer[i] * buffer[i];
  const rms = Math.sqrt(sumSq / buffer.length);
  if (rms === 0) return -Infinity;
  // Convert FS (0–1) to dB, then shift by a rough headroom constant to
  // approximate real-world SPL for display buckets.
  return 20 * Math.log10(rms) + 94;
}

export async function runDecibelTest(durationSeconds = 10): Promise<DecibelResult> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  const Ctor = getAudioContextCtor();
  const ctx = new Ctor();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  const buffer = new Float32Array(analyser.fftSize);
  const samples: number[] = [];
  const intervalMs = 100;
  const totalSamples = Math.floor((durationSeconds * 1000) / intervalMs);

  await new Promise<void>((resolve) => {
    let count = 0;
    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(buffer);
      const db = rmsDb(buffer);
      if (Number.isFinite(db)) samples.push(db);
      count++;
      if (count >= totalSamples) {
        clearInterval(timer);
        resolve();
      }
    }, intervalMs);
  });

  stream.getTracks().forEach((t) => t.stop());
  ctx.close().catch(() => null);

  if (samples.length === 0) {
    return { avg_db: 0, peak_db: 0, duration_seconds: durationSeconds, samples: 0 };
  }

  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const peak = Math.max(...samples);
  return {
    avg_db: Math.round(avg * 10) / 10,
    peak_db: Math.round(peak * 10) / 10,
    duration_seconds: durationSeconds,
    samples: samples.length,
  };
}
