import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, LoaderCircle, LogOut, ShieldCheck, ScanFace } from 'lucide-react';
import { api, ApiError, type User } from '../lib/api';

export function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const navigate = useNavigate();
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setInterval>;
    async function refresh() {
      try {
        const { user } = await api.me(controller.signal);
        if (!controller.signal.aborted) {
          setUser(user);
          setError('');
        }
      } catch (caught) {
        if (controller.signal.aborted) return;
        setUser(null);
        if (caught instanceof ApiError && caught.status === 401)
          navigate('/login', { replace: true });
        else setError(caught instanceof Error ? caught.message : 'Could not load your session.');
      }
    }
    void refresh();
    const checkVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    window.addEventListener('focus', checkVisibility);
    document.addEventListener('visibilitychange', checkVisibility);
    timer = setInterval(checkVisibility, 60_000);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener('focus', checkVisibility);
      document.removeEventListener('visibilitychange', checkVisibility);
    };
  }, [navigate, revision]);

  async function logout() {
    setLeaving(true);
    setError('');
    try {
      await api.logout();
      setUser(null);
      navigate('/login', { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign out. Please retry.');
    } finally {
      setLeaving(false);
    }
  }

  return (
    <section className="dashboard-page">
      <span className="eyebrow">
        <span /> YOUR PERSONAL SPACE
      </span>
      <h1>{user ? 'You’re in. Welcome home.' : 'Checking your session…'}</h1>
      <p className="page-subtitle">A simple dashboard. A successful connection.</p>
      <div className="dashboard-card">
        {user ? (
          <>
            <div className="success-symbol">
              <ScanFace size={42} />
              <span>
                <Check size={14} />
              </span>
            </div>
            <span className="session-badge">
              <span className="tiny-dot" /> Session active
            </span>
            <h2>Good to see you.</h2>
            <p className="signed-in-label">You’re signed in as</p>
            <p className="user-email">{user.email}</p>
            <div className="session-detail">
              <ShieldCheck size={18} />
              <span>Your session is verified by the server.</span>
            </div>
            <button className="primary-button" onClick={() => void logout()} disabled={leaving}>
              {leaving ? <LoaderCircle size={18} className="spin" /> : <LogOut size={18} />}
              {leaving ? 'Signing out…' : 'Log out'}
            </button>
          </>
        ) : (
          !error && <LoaderCircle size={28} className="spin" aria-label="Loading session" />
        )}
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}
        {!user && error && (
          <button
            className="primary-button"
            onClick={() => {
              setError('');
              setRevision((value) => value + 1);
            }}
          >
            Retry
          </button>
        )}
      </div>
    </section>
  );
}
