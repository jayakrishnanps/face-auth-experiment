import { Camera, Check, LoaderCircle, ScanFace, ShieldCheck } from 'lucide-react';
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
  return (
    <section className="camera-card" aria-label="Face capture preview">
      <div className="camera-card-heading">
        <span>
          <ScanFace size={18} /> Face {mode === 'register' ? 'enrollment' : 'verification'}
        </span>
        <span className={`camera-state ${active ? 'is-live' : ''}`}>
          <i />
          {active ? 'Camera live' : 'Camera off'}
        </span>
      </div>
      <div className={`viewfinder ${active ? 'active' : ''}`}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={active ? 'video-visible' : ''}
          aria-label="Your camera preview"
        />
        <div className="frame-corners">
          <i />
          <i />
          <i />
          <i />
        </div>
        {!active && (
          <div className="camera-placeholder">
            <div className="face-orbit">
              <ScanFace size={65} strokeWidth={1.15} />
            </div>
            <h3>{phase === 'submitting' ? 'Face captured' : 'Your face. Your key.'}</h3>
            <p>
              {phase === 'submitting'
                ? 'Your camera is off. Completing your request…'
                : 'Your camera preview will appear here.'}
            </p>
          </div>
        )}
        {active && <div className="face-guide" />}
        <div className="preview-label">
          <Camera size={13} /> PRIVATE CAMERA PREVIEW
        </div>
      </div>
      <div className="capture-progress">
        <div className="progress-heading">
          <span>{mode === 'register' ? 'Enrollment samples' : 'Verification sample'}</span>
          <span>
            {progress.collected} / {progress.total}
          </span>
        </div>
        <div className="sample-bars">
          {Array.from({ length: progress.total }, (_, index) => (
            <span key={index} className={index < progress.collected ? 'filled' : ''}>
              {index < progress.collected && <Check size={12} />}
            </span>
          ))}
        </div>
        <p className="capture-hint" role="status" aria-live="polite">
          {phase === 'loading' || phase === 'submitting' ? (
            <LoaderCircle size={14} className="spin" />
          ) : (
            <span className="hint-dot" />
          )}
          {phase === 'submitting'
            ? 'Finishing securely…'
            : progress.message || 'Ready when you are. Start with your email.'}
        </p>
      </div>
      <div className="camera-privacy">
        <ShieldCheck size={16} />
        <span>Only face embeddings are saved. No photos.</span>
      </div>
    </section>
  );
}
