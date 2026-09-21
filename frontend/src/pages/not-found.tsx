import { Link } from 'react-router-dom';
export function NotFound() {
  return (
    <section className="not-found">
      <p className="page-label">404</p>
      <h1>Page not found</h1>
      <p className="intro">This address doesn’t lead to a page.</p>
      <Link className="text-link" to="/login">
        Back to sign in
      </Link>
    </section>
  );
}
