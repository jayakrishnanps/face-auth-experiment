import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { useFaceCapture } from '../face/use-face-capture';
import { CameraPanel } from './camera-panel';
import { api } from '../lib/api';

export function AuthScreen({ mode }: { mode: 'register' | 'login' }) {
  const registering = mode === 'register';
  const location = useLocation();
  const [email, setEmail] = useState(
    typeof location.state?.email === 'string' ? location.state.email : '',
  );
  const capture = useFaceCapture(mode);
  const navigate = useNavigate();
  useEffect(() => {
    const controller = new AbortController();
    void api
      .me(controller.signal)
      .then(() => {
        if (!controller.signal.aborted) navigate('/dashboard', { replace: true });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [navigate]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = email.trim().toLowerCase();
    void capture.run(async (samples, signal) => {
      if (registering) await api.register(normalized, samples, signal);
      else await api.login(normalized, samples[0], signal);
      if (!signal.aborted) navigate('/dashboard', { replace: true });
    }, api.ready);
  }

  return (
    <div className="auth-page">
      <section className="auth-form" aria-labelledby="auth-title">
        <nav className="auth-navigation" aria-label="Account access">
          <Link to="/login" aria-current={!registering ? 'page' : undefined}>
            Log in
          </Link>
          <Link to="/register" aria-current={registering ? 'page' : undefined}>
            Register
          </Link>
        </nav>
        <h1 id="auth-title">{registering ? 'Register your face' : 'Log in to your account'}</h1>
        <p className="intro">
          {registering
            ? 'Create an account with your email and three face samples.'
            : 'Use your registered email and face to sign in.'}
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
                    ? 'Create account'
                    : 'Log in with face'}
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
        cameras={capture.cameras}
        cameraId={capture.cameraId}
        onCameraChange={capture.setCameraId}
        busy={capture.busy}
      />
    </div>
  );
}
