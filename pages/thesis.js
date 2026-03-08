import { useState } from 'react'
import Link from 'next/link'

export default function Thesis() {
  const [fileUrl, setFileUrl] = useState('')
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    const fileInput = e.target.elements.file
    if (!fileInput.files.length) return

    const form = new FormData()
    form.append('file', fileInput.files[0])
    setUploading(true)

    const res = await fetch('/api/upload', { method: 'POST', body: form })
    setUploading(false)

    if (res.ok) {
      const data = await res.json()
      setFileUrl(data.url)
    } else {
      setError('Upload failed')
    }
  }

  return (
    <main className="shell">
      <div className="bg" aria-hidden="true" />

      <header className="hero">
        <div>
          <h1>Thesis Document</h1>
          <p>Upload your thesis file for parsing, analysis, and reference workflows.</p>
        </div>
        <div className="heroLinks">
          <Link href="/">Home</Link>
          <Link href="/thesis-analyze">Thesis Analysis</Link>
          <Link href="/thesis-debug">Upload Debug</Link>
        </div>
      </header>

      <section className="panel">
        <p className="muted">Supported format: PDF.</p>
        <form onSubmit={submit}>
          <input type="file" name="file" accept=".pdf,application/pdf" required />
          <button type="submit" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload'}</button>
        </form>

        {error ? <div className="error">{error}</div> : null}
        {fileUrl ? (
          <div className="success">
            Uploaded successfully. File available <a href={fileUrl} target="_blank" rel="noreferrer">here</a>.
          </div>
        ) : null}
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

        .muted {
          color: #4d647e;
          font-size: 13px;
          margin-top: 0;
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

        .error {
          margin-top: 8px;
          color: #991b1b;
          font-size: 13px;
        }

        .success {
          margin-top: 8px;
          color: #14532d;
          background: #dcfce7;
          border: 1px solid #86efac;
          border-radius: 10px;
          padding: 8px 10px;
          font-size: 13px;
        }

        .success :global(a) {
          color: #166534;
          font-weight: 700;
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
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600;700&family=Space+Grotesk:wght@400;600;700&display=swap');
      `}</style>
    </main>
  )
}
