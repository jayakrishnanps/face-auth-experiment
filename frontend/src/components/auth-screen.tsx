import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
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
      <section className="auth-form" aria-labelledby="auth-title">
        <h1 id="auth-title">{registering ? 'Create an account' : 'Sign in'}</h1>
        <p className="intro">Enter your email, then look at the camera.</p>
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
              ? 'We’ll take three face samples to set up your account.'
              : 'Use the email you registered with.'}
          </p>
          {capture.error && (
            <div className="error-message" role="alert">
              {capture.error}
            </div>
          )}
          <button className="primary-button" type="submit" disabled={capture.busy}>
            {capture.busy && <LoaderCircle size={17} className="spin" />}
            {capture.phase === 'loading'
              ? 'Preparing camera…'
              : capture.phase === 'capturing'
                ? 'Capturing…'
                : capture.phase === 'submitting'
                  ? registering
                    ? 'Creating account…'
                    : 'Verifying…'
                  : registering
                    ? 'Register Face'
                    : 'Unlock with Face'}
          </button>
          {capture.busy && capture.phase !== 'submitting' && (
            <button type="button" className="cancel-button" onClick={capture.cancel}>
              Cancel capture
            </button>
          )}
          <p className="permission-note">Camera access is only used during capture.</p>
        </form>
        <p className="form-bottom">
          {registering ? 'Already registered?' : 'Don’t have an account?'}{' '}
          <Link to={registering ? '/login' : '/register'}>
            {registering ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </section>
      <CameraPanel
        videoRef={capture.videoRef}
        phase={capture.phase}
        progress={capture.progress}
        mode={mode}
      />
    </div>
  );
}
