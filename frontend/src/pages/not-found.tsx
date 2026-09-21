import { Link } from 'react-router-dom';
import { ArrowLeft, ScanFace } from 'lucide-react';
export function NotFound() {
  return (
    <section className="not-found">
      <span className="eyebrow">404 / NOT FOUND</span>
      <ScanFace size={65} strokeWidth={1.2} />
      <h1>This page looks unfamiliar.</h1>
      <p>The link may have changed. Let’s get you back to a familiar place.</p>
      <Link className="primary-button" to="/login">
        <ArrowLeft size={18} />
        Back to sign in
      </Link>
    </section>
  );
}
