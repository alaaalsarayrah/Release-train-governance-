import Link from 'next/link'

export default function SupportPage() {
  return (
    <main className="shell">
      <header className="hero">
        <h1>Support</h1>
        <p>Get help for Agentic SDLC mobile and web app usage.</p>
        <div className="links">
          <Link href="/">Home</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/contact">Contact</Link>
        </div>
      </header>

      <section className="card">
        <h2>Support Contact</h2>
        <p>
          Email: <a href="mailto:alaa59@hotmail.com">alaa59@hotmail.com</a>
        </p>
        <p>Typical response time: 1-2 business days.</p>
      </section>

      <section className="card">
        <h2>What to Include in Your Request</h2>
        <ul>
          <li>Your device model and iOS version.</li>
          <li>App version and approximate time of issue.</li>
          <li>A short description and screenshot of the problem.</li>
        </ul>
      </section>

      <section className="card">
        <h2>Core Features</h2>
        <ul>
          <li>BRD upload and requirement extraction.</li>
          <li>Agentic sprint planning and workflow orchestration.</li>
          <li>Azure DevOps backlog synchronization.</li>
        </ul>
      </section>

      <style jsx>{`
        .shell {
          max-width: 920px;
          margin: 0 auto;
          padding: 24px;
          color: #11253d;
          font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
        }

        .hero h1 {
          margin: 0;
          font-size: 36px;
        }

        .hero p {
          margin: 8px 0 0;
          color: #3d536d;
        }

        .links {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .links :global(a) {
          text-decoration: none;
          border: 1px solid #c9dcf1;
          border-radius: 999px;
          background: #fff;
          color: #0d3a64;
          padding: 7px 12px;
          font-weight: 700;
        }

        .card {
          margin-top: 12px;
          border: 1px solid #d6e3f4;
          border-radius: 16px;
          background: #fff;
          box-shadow: 0 14px 30px rgba(17, 24, 39, 0.06);
          padding: 14px;
        }

        .card h2 {
          margin: 0 0 8px;
        }

        .card p,
        .card li {
          color: #3e5671;
          line-height: 1.55;
        }

        @media (max-width: 900px) {
          .shell {
            padding: 14px;
          }
        }
      `}</style>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap');
      `}</style>
    </main>
  )
}
