import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
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
      navigate('/login', { replace: true, state: { email: user?.email } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign out. Please retry.');
    } finally {
      setLeaving(false);
    }
  }

  return (
    <section className="dashboard-page">
      <h1>{user ? 'Your account' : 'Checking your session…'}</h1>
      <div className="dashboard-card">
        {user ? (
          <>
            <p className="signed-in-label">Signed in as</p>
            <p className="user-email">{user.email}</p>
            <button className="primary-button" onClick={() => void logout()} disabled={leaving}>
              {leaving && <LoaderCircle size={17} className="spin" />}
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
