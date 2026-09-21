import { useEffect, useRef, useState } from 'react';
import {
  captureEnrollmentSamples,
  captureLoginSample,
  loadModels,
  startCamera,
  stopCamera,
  type CaptureProgress,
} from './face-engine';

export type CapturePhase = 'idle' | 'loading' | 'capturing' | 'submitting' | 'error';

export function useFaceCapture(mode: 'register' | 'login') {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<CapturePhase>('idle');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<CaptureProgress>({
    collected: 0,
    total: mode === 'register' ? 3 : 1,
    message: '',
  });
  const busy = phase === 'loading' || phase === 'capturing' || phase === 'submitting';

  useEffect(() => {
    const video = videoRef.current;
    return () => {
      controller.current?.abort();
      if (video) stopCamera(video);
    };
  }, []);

  function cancel() {
    controller.current?.abort();
    controller.current = null;
    if (videoRef.current) stopCamera(videoRef.current);
    setPhase('idle');
    setError('');
    setProgress({ collected: 0, total: mode === 'register' ? 3 : 1, message: '' });
  }

  async function run(submit: (samples: number[][], signal: AbortSignal) => Promise<void>) {
    if (controller.current) return;
    const video = videoRef.current;
    if (!video) return;
    const attempt = new AbortController();
    controller.current = attempt;
    setError('');
    setPhase('loading');
    setProgress({
      collected: 0,
      total: mode === 'register' ? 3 : 1,
      message: 'Preparing face models…',
    });
    try {
      await loadModels();
      attempt.signal.throwIfAborted();
      setProgress((current) => ({ ...current, message: 'Allow camera access to continue.' }));
      await startCamera(video, attempt.signal);
      attempt.signal.throwIfAborted();
      setPhase('capturing');
      const update = (value: CaptureProgress) => {
        if (!attempt.signal.aborted) setProgress(value);
      };
      const samples =
        mode === 'register'
          ? await captureEnrollmentSamples(video, update, attempt.signal)
          : [await captureLoginSample(video, update, attempt.signal)];
      stopCamera(video);
      attempt.signal.throwIfAborted();
      setPhase('submitting');
      await submit(samples, attempt.signal);
    } catch (caught) {
      if (!attempt.signal.aborted) {
        setError(caught instanceof Error ? caught.message : 'Something went wrong. Please retry.');
        setPhase('error');
      }
    } finally {
      if (controller.current === attempt) {
        stopCamera(video);
        controller.current = null;
      }
    }
  }
  return { videoRef, phase, error, progress, busy, run, cancel };
}
