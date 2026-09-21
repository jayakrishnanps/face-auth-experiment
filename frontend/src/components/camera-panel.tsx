import { Camera, Check, LoaderCircle } from 'lucide-react';
import type { RefObject } from 'react';
import type { CapturePhase } from '../face/use-face-capture';
import type { CaptureProgress } from '../face/face-engine';

export function CameraPanel({
  videoRef,
  phase,
  progress,
  mode,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  phase: CapturePhase;
  progress: CaptureProgress;
  mode: 'register' | 'login';
}) {
  const active = phase === 'capturing';
  const pending = phase === 'loading' || phase === 'submitting';
  const showProgress = active || pending || progress.collected > 0;
  return (
    <section className="camera-panel" aria-label="Face capture preview">
      <div className={`viewfinder ${active ? 'active' : ''}`}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={active ? 'video-visible' : ''}
          aria-label="Your camera preview"
          aria-hidden={!active}
        />
        {!active && (
          <div className="camera-placeholder">
            {phase === 'submitting' ? (
              <Check size={28} strokeWidth={1.5} />
            ) : (
              <Camera size={28} strokeWidth={1.5} />
            )}
            <span>{phase === 'submitting' ? 'Face captured' : 'Camera off'}</span>
          </div>
        )}
        {active && (
          <>
            <span className="live-label">
              <i /> Live
            </span>
            <div className="face-guide" />
          </>
        )}
      </div>
      <div className="camera-caption">
        <span>{active ? 'Keep your face centered.' : 'Camera preview'}</span>
        {showProgress && (
          <span className="sample-count">
            {progress.collected} / {progress.total} {mode === 'register' ? 'samples' : 'sample'}
          </span>
        )}
      </div>
      {showProgress && (
        <div className="sample-bars" aria-hidden="true">
          {Array.from({ length: progress.total }, (_, index) => (
            <span key={index} className={index < progress.collected ? 'filled' : ''} />
          ))}
        </div>
      )}
      <p className="capture-hint" role="status" aria-live="polite">
        {pending && <LoaderCircle size={14} className="spin" />}
        {phase === 'submitting'
          ? 'Finishing…'
          : showProgress
            ? progress.message
            : 'Use good lighting. No photos are saved.'}
      </p>
    </section>
  );
}
