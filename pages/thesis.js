import { useState } from 'react'
import Link from 'next/link'

export default function Thesis() {
  const [fileUrl, setFileUrl] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [uploading, setUploading] = useState(false)
  const showDebugLink = process.env.NEXT_PUBLIC_ENABLE_THESIS_DEBUG === 'true'

  async function submit(e) {
    e.preventDefault()
    setError('')
    setStatus('')
    setFileUrl('')
    const fileInput = e.target.elements.file
    if (!fileInput.files.length) return

    const form = new FormData()
    form.append('file', fileInput.files[0])
    form.append('purpose', 'thesis')
    setUploading(true)

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        setError(data?.error || 'Upload failed. Please retry with a PDF or DOCX file.')
        return
      }

      setFileUrl(data?.url || '')
      setStatus('Upload successful. Thesis analysis can now use this thesis-scoped file.')
    } catch {
      setError('Upload failed due to a network or server error. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <main className="shell">
      <div className="bg" aria-hidden="true" />

      <header className="hero">
        <div>
          <h1>Thesis Document</h1>
          <p>Upload a thesis file for supporting analysis utilities. Primary value remains in the Sprint Planning Workspace.</p>
        </div>
        <div className="heroLinks">
          <Link href="/thesis-demo">Thesis Demo</Link>
          <Link href="/sprint-planning-workspace">Sprint Planning Workspace</Link>
          <Link href="/thesis-analyze">Thesis Analysis</Link>
          <Link href="/evaluation">Evaluation Evidence</Link>
          <Link href="/conceptual-framework">Conceptual Framework</Link>
          <Link href="/thesis-readiness-checklist">Supervisor Readiness Checklist</Link>
          <Link href="/chapter-alignment-notes">Chapter 4/5 Alignment Notes</Link>
          {showDebugLink ? <Link href="/thesis-debug">Upload Debug</Link> : null}
          <Link href="/">Home</Link>
        </div>
      </header>

      <section className="panel">
        <p className="muted">Supported formats: PDF and DOCX.</p>
        <form onSubmit={submit}>
          <input
            type="file"
            name="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            required
          />
          <button type="submit" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload'}</button>
        </form>

        <p className="hint">
          After upload, open Thesis Analysis to review extracted abstract, structure, and research signals.
        </p>

        {error ? <div className="error">{error}</div> : null}
        {status ? <div className="success">{status}</div> : null}
        {fileUrl ? (
          <div className="success fileLink">
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

        .hint {
          margin: 8px 0 0;
          color: #3f5873;
          font-size: 13px;
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

        .fileLink {
          background: #ecfdf5;
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
