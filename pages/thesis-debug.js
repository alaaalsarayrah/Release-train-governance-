import { useState } from 'react'
import Link from 'next/link'

export async function getServerSideProps() {
  if (process.env.NEXT_PUBLIC_ENABLE_THESIS_DEBUG !== 'true') {
    return { notFound: true }
  }
  return { props: {} }
}

export default function ThesisDebug() {
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  async function upload(e) {
    e.preventDefault()
    setError('')
    setStatus('')
    const fileInput = e.target.elements.file
    if (!fileInput.files.length) return setError('No file chosen')

    const file = fileInput.files[0]
    const form = new FormData()
    form.append('file', file)
    form.append('purpose', 'thesis')

    setUploading(true)
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: form
      })
      const text = await res.text()
      setStatus(`HTTP ${res.status} - ${text}`)
    } catch (err) {
      setError(String(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <main className="shell">
      <div className="bg" aria-hidden="true" />

      <header className="hero">
        <div>
          <h1>Thesis Upload Debugger</h1>
          <p>Development troubleshooting utility for raw upload responses.</p>
        </div>
        <div className="heroLinks">
          <Link href="/">Home</Link>
          <Link href="/thesis">Thesis Upload</Link>
          <Link href="/thesis-analyze">Thesis Analysis</Link>
        </div>
      </header>

      <section className="panel">
        <form onSubmit={upload}>
          <input
            type="file"
            name="file"
            accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          />
          <button type="submit" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload (debug)'}</button>
        </form>

        {status ? <pre className="status">{status}</pre> : null}
        {error ? <div className="error">{error}</div> : null}
      </section>

      <style jsx>{`
        .shell {
          min-height: 100vh;
          max-width: 980px;
          margin: 0 auto;
          padding: 24px;
          color: #11253d;
          position: relative;
          font-family: 'Space Grotesk', 'Segoe UI', sans-serif;
        }

        .bg {
          position: fixed;
          inset: 0;
          z-index: -1;
          background:
            radial-gradient(circle at 10% 10%, rgba(20, 143, 180, 0.12), transparent 40%),
            radial-gradient(circle at 84% 10%, rgba(57, 118, 218, 0.14), transparent 44%),
            linear-gradient(180deg, #f8fbff, #edf4ff);
        }

        .hero {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .hero h1 {
          margin: 0;
          font-size: 33px;
        }

        .hero p {
          margin: 8px 0 0;
          color: #3d536d;
        }

        .heroLinks {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .heroLinks :global(a) {
          text-decoration: none;
          color: #0d3a64;
          border: 1px solid #c9dcf1;
          border-radius: 999px;
          background: #fff;
          padding: 7px 13px;
          font-weight: 700;
        }

        .panel {
          border: 1px solid #d6e3f4;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 16px 38px rgba(17, 24, 39, 0.07);
          padding: 14px;
        }

        form {
          display: grid;
          gap: 8px;
        }

        input[type='file'] {
          padding: 8px;
          border: 1px solid #bfd2e9;
          border-radius: 10px;
          font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
          background: #fff;
        }

        button {
          width: fit-content;
          border: none;
          border-radius: 9px;
          padding: 7px 11px;
          color: #fff;
          font-weight: 700;
          cursor: pointer;
          background: linear-gradient(135deg, #1f5fbc, #148fb4);
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .status {
          margin-top: 10px;
          border: 1px solid #d7e4f5;
          border-radius: 10px;
          background: #f8fbff;
          padding: 8px;
          white-space: pre-wrap;
          font-size: 12px;
          color: #3f5873;
          font-family: 'IBM Plex Mono', Consolas, monospace;
        }

        .error {
          margin-top: 8px;
          color: #991b1b;
          font-size: 13px;
        }

        @media (max-width: 900px) {
          .shell {
            padding: 14px;
          }

          .hero {
            flex-direction: column;
          }
        }
      `}</style>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;600;700&family=Space+Grotesk:wght@400;600;700&display=swap');
      `}</style>
    </main>
  )
}
