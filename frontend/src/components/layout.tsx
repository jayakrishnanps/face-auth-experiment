import { Link, NavLink, Outlet } from 'react-router-dom';
import { ScanFace, ArrowUpRight } from 'lucide-react';

export function Layout() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/login" aria-label="FaceKey home">
          <span className="brand-icon">
            <ScanFace size={23} />
          </span>
          FaceKey<span className="experiment-tag">EXPERIMENT</span>
        </Link>
        <nav aria-label="Main navigation">
          <NavLink to="/login">Sign in</NavLink>
          <NavLink className="nav-register" to="/register">
            Create account <ArrowUpRight size={15} />
          </NavLink>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="site-footer">
        <span>
          FaceKey <span className="footer-divider">/</span> A face authentication experiment
        </span>
        <span className="footer-note">
          <span className="tiny-dot" /> Built around your privacy
        </span>
      </footer>
    </div>
  );
}
