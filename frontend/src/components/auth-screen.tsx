import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Camera,
  Check,
  CircleHelp,
  Fingerprint,
  LoaderCircle,
  LockKeyhole,
  ScanFace,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { useFaceCapture } from '../face/use-face-capture';
import { CameraPanel } from './camera-panel';
import { api } from '../lib/api';

export function AuthScreen({ mode }: { mode: 'register' | 'login' }) {
  const registering = mode === 'register';
  const [email, setEmail] = useState('');
  const capture = useFaceCapture(mode);
  const navigate = useNavigate();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    void capture.run(async (samples, signal) => {
      if (registering) await api.register(normalized, samples, signal);
      else await api.login(normalized, samples[0], signal);
      if (!signal.aborted) navigate('/dashboard', { replace: true });
    });
  }

  return (
    <div className="auth-page">
      <div className="page-intro">
        <span className="eyebrow">
          <span /> PASSWORDLESS, PERSONAL
        </span>
        <h1>{registering ? 'A familiar face. A fresh start.' : 'Welcome back. Look this way.'}</h1>
        <p>
          {registering
            ? 'Create your account with a glance. Your face takes it from here.'
            : 'Your account is one glance away. Let’s make sure it’s you.'}
        </p>
      </div>
      <div className="auth-grid">
        <section className="form-card">
          <div className="form-icon">
            {registering ? <Fingerprint size={25} /> : <LockKeyhole size={24} />}
          </div>
          <h2>{registering ? 'Create your account' : 'Sign in to your account'}</h2>
          <p className="form-description">
            {registering
              ? 'One email. Three quick face samples. You’re in.'
              : 'Enter your email, then unlock with your face.'}
          </p>
          <form onSubmit={submit}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              maxLength={254}
              required
              value={email}
              disabled={capture.busy}
              onChange={(event) => setEmail(event.target.value)}
            />
            <p className="field-hint">
              {registering
                ? 'You’ll use this email every time you sign in.'
                : 'Use the email you registered with.'}
            </p>
            <div className="capture-instructions">
              <div className="instructions-title">
                <Camera size={17} />
                <strong>
                  {registering ? 'Let’s get to know your face' : 'Get ready for your close-up'}
                </strong>
              </div>
              <p>
                {registering
                  ? 'We’ll capture three face samples automatically. It only takes a few seconds.'
                  : 'We’ll compare your face with the samples saved to your account.'}
              </p>
              <div className="instruction-chips">
                <span>
                  <Sun size={14} /> Good lighting
                </span>
                <span>
                  <ScanFace size={14} /> Look straight ahead
                </span>
              </div>
            </div>
            {capture.error && (
              <div className="error-message" role="alert">
                {capture.error}
              </div>
            )}
            <button className="primary-button" type="submit" disabled={capture.busy}>
              {capture.busy ? <LoaderCircle size={18} className="spin" /> : <ScanFace size={19} />}
              {capture.phase === 'loading'
                ? 'Preparing camera…'
                : capture.phase === 'capturing'
                  ? 'Capturing your face…'
                  : capture.phase === 'submitting'
                    ? registering
                      ? 'Creating account…'
                      : 'Verifying your face…'
                    : registering
                      ? 'Register Face'
                      : 'Unlock with Face'}
              {!capture.busy && <ArrowRight className="button-arrow" size={18} />}
            </button>
            {capture.busy && capture.phase !== 'submitting' && (
              <button type="button" className="cancel-button" onClick={capture.cancel}>
                Cancel capture
              </button>
            )}
            <div className="permission-note">
              <LockKeyhole size={12} /> Camera access is only used during capture.
            </div>
          </form>
          <div className="form-bottom">
            {registering ? 'Already have an account?' : 'New to FaceKey?'}{' '}
            <Link to={registering ? '/login' : '/register'}>
              {registering ? 'Sign in' : 'Create an account'} <ArrowRight size={13} />
            </Link>
          </div>
        </section>
        <div className="camera-column">
          <CameraPanel
            videoRef={capture.videoRef}
            phase={capture.phase}
            progress={capture.progress}
            mode={mode}
          />
          <div className="camera-tip">
            <CircleHelp size={16} />
            <p>
              For the best result, keep your face centered, remove anything covering it, and use a
              well-lit space.
            </p>
          </div>
        </div>
      </div>
      <section className="trust-row" aria-label="How FaceKey works">
        <div>
          <span className="trust-icon">
            <ShieldCheck size={20} />
          </span>
          <span>
            <strong>No photos stored</strong>
            <small>Just a numerical face signature.</small>
          </span>
        </div>
        <div>
          <span className="trust-icon">
            <ScanFace size={20} />
          </span>
          <span>
            <strong>One-to-one verification</strong>
            <small>Your face, matched to your account.</small>
          </span>
        </div>
        <div>
          <span className="trust-icon">
            <Check size={20} />
          </span>
          <span>
            <strong>A real, private session</strong>
            <small>Sign in, stay connected, sign out.</small>
          </span>
        </div>
      </section>
      <p className="experiment-note">
        An experiment in face authentication. Liveness and anti-spoofing are not enabled.
      </p>
    </div>
  );
}
