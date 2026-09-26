import { Link, Outlet } from 'react-router-dom';
import { ScanFace } from 'lucide-react';

export function Layout() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/login" aria-label="FaceKey home">
          <span className="brand-symbol" aria-hidden="true">
            <ScanFace size={23} strokeWidth={1.6} />
          </span>
          <span>
            FaceKey<span className="brand-period">.</span>
          </span>
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
