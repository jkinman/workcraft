import Link from 'next/link';

export function WelcomeHero({ greeting, name, primaryAction }) {
  return (
    <section className="welcome-hero">
      <div className="welcome-text">
        <div className="muted">{greeting}{name ? `, ${name}` : ''}</div>
        <h2 className="welcome-headline">{primaryAction.headline}</h2>
        <p className="muted">{primaryAction.detail}</p>
      </div>
      <Link className="btn btn-success btn-lg" href={primaryAction.href}>
        {primaryAction.cta}
      </Link>
    </section>
  );
}
