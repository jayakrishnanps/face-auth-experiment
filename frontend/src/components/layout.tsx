import { Link, Outlet } from 'react-router-dom';

export function Layout() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/login" aria-label="FaceKey home">
          FaceKey<span className="brand-period">.</span>
        </Link>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="site-footer">
        Experimental face authentication. No liveness detection.
      </footer>
    </div>
  );
}
