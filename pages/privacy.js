import Link from 'next/link'

export default function PrivacyPage() {
  const updatedOn = 'March 9, 2026'

  return (
    <main className="shell">
      <header className="hero">
        <h1>Privacy Policy</h1>
        <p>Thesis prototype for AI-assisted SAFe sprint planning (web and iOS wrapper)</p>
        <p className="muted">Last updated: {updatedOn}</p>
        <div className="links">
          <Link href="/thesis-demo">Thesis Demo</Link>
          <Link href="/sprint-planning-workspace">Sprint Planning Workspace</Link>
          <Link href="/">Home</Link>
          <Link href="/support">Support</Link>
          <Link href="/contact">Contact</Link>
        </div>
      </header>

      <section className="card">
        <h2>Overview</h2>
        <p>
          This thesis prototype provides AI-assisted sprint planning support with supporting upstream
          workflow modules. We are committed to handling data responsibly and transparently.
        </p>
      </section>

      <section className="card">
        <h2>Information We Process</h2>
        <ul>
          <li>Account and session information required for sign-in and role-based access.</li>
          <li>Project content uploaded by authorized users, such as BRD and thesis files.</li>
          <li>Operational metadata such as timestamps and audit logs for workflow actions.</li>
        </ul>
      </section>

      <section className="card">
        <h2>How We Use Information</h2>
        <ul>
          <li>To provide sprint planning support, backlog analysis, and governance evidence features.</li>
          <li>To maintain system security, reliability, and traceability.</li>
          <li>To improve product quality and support troubleshooting.</li>
        </ul>
      </section>

      <section className="card">
        <h2>Data Sharing</h2>
        <p>
          We do not sell personal data. Data may be transmitted to integrated platforms such as
          Azure DevOps only when configured by authorized administrators.
        </p>
      </section>

      <section className="card">
        <h2>Data Retention</h2>
        <p>
          Data is retained only as long as needed for operational and compliance requirements. You
          may request deletion or correction of your data using the support contact below.
        </p>
      </section>

      <section className="card">
        <h2>Contact</h2>
        <p>
          For privacy requests, contact: <a href="mailto:alaa59@hotmail.com">alaa59@hotmail.com</a>
        </p>
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

        .muted {
          color: #5d738b;
          font-size: 13px;
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
