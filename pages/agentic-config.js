import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'

export default function AgenticConfigRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/administrator')
  }, [router])

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', fontFamily: "'Space Grotesk', 'Segoe UI', sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 680, border: '1px solid #d6e3f4', borderRadius: 14, background: '#fff', padding: 14 }}>
        <h1 style={{ margin: 0 }}>Persona Configuration Moved</h1>
        <p style={{ color: '#4c647e' }}>
          Persona and audit administration now lives in the Administrator Console.
        </p>
        <p>
          <Link href="/administrator" style={{ color: '#0c4b8a', fontWeight: 700, textDecoration: 'none' }}>
            Open Administrator Console
          </Link>
        </p>
      </div>
    </main>
  )
}
