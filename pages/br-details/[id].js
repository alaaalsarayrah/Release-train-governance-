import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'

export default function BRDetails() {
  const router = useRouter()
  const { id } = router.query
  const [br, setBr] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    fetch('/api/business-request')
      .then(r => r.json())
      .then(j => {
        const found = (j.requests || []).find(req => req.id === id)
        setBr(found)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [id])

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>
  if (!br) return <div style={{ padding: 40 }}>Business Request not found.</div>

  let requirementDetails = null
  try {
    if (br.requirement_details) {
      requirementDetails = JSON.parse(br.requirement_details)
    }
  } catch (e) {
    console.error('Failed to parse requirement details', e)
  }

  return (
    <div style={{ maxWidth: 900, margin: '40px auto', padding: '0 20px' }}>
      <header style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Business Request Details</h1>
        <Link href="/dashboard">← Back to Dashboard</Link>
      </header>

      <section style={{ background: '#fff', padding: 24, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: 20 }}>
        <h2 style={{ marginTop: 0, color: '#0052cc' }}>Business Request Information</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '12px 8px', fontWeight: 600, width: '30%' }}>BR ID</td>
              <td style={{ padding: '12px 8px' }}>{br.id}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '12px 8px', fontWeight: 600 }}>Description</td>
              <td style={{ padding: '12px 8px' }}>{br.description}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '12px 8px', fontWeight: 600 }}>Business Unit</td>
              <td style={{ padding: '12px 8px' }}>{br.unit}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '12px 8px', fontWeight: 600 }}>Urgency</td>
              <td style={{ padding: '12px 8px' }}>{br.urgency}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '12px 8px', fontWeight: 600 }}>Desired Date</td>
              <td style={{ padding: '12px 8px' }}>{br.date || '-'}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '12px 8px', fontWeight: 600 }}>Justification</td>
              <td style={{ padding: '12px 8px' }}>{br.justif || '-'}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '12px 8px', fontWeight: 600 }}>Status</td>
              <td style={{ padding: '12px 8px' }}>
                <span style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  borderRadius: 12,
                  color: '#fff',
                  background: br.status === 'Approved' ? '#16a34a' : br.status === 'Rejected' ? '#ef4444' : '#f59e0b'
                }}>
                  {br.status || 'Pending'}
                </span>
              </td>
            </tr>
            {br.decision_reason && (
              <tr style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '12px 8px', fontWeight: 600 }}>Decision Reason</td>
                <td style={{ padding: '12px 8px' }}>{br.decision_reason}</td>
              </tr>
            )}
            <tr>
              <td style={{ padding: '12px 8px', fontWeight: 600 }}>Created At</td>
              <td style={{ padding: '12px 8px' }}>{br.created_at ? new Date(br.created_at).toLocaleString() : '-'}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {br.requirement_created && (
        <section style={{ background: '#fff', padding: 24, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: 20 }}>
          <h2 style={{ marginTop: 0, color: '#0052cc' }}>Requirements</h2>
          {requirementDetails ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {requirementDetails.demand && (
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 600, width: '30%' }}>Demand Information</td>
                    <td style={{ padding: '12px 8px' }}>{requirementDetails.demand}</td>
                  </tr>
                )}
                {requirementDetails.resourcePlanning && (
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 600 }}>Resource Planning</td>
                    <td style={{ padding: '12px 8px' }}>{requirementDetails.resourcePlanning}</td>
                  </tr>
                )}
                {requirementDetails.budget && (
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 600 }}>Budget</td>
                    <td style={{ padding: '12px 8px' }}>{requirementDetails.budget}</td>
                  </tr>
                )}
                {requirementDetails.deliveryMethod && (
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px 8px', fontWeight: 600 }}>Delivery Method</td>
                    <td style={{ padding: '12px 8px' }}>{requirementDetails.deliveryMethod}</td>
                  </tr>
                )}
                {requirementDetails.details && (
                  <tr>
                    <td style={{ padding: '12px 8px', fontWeight: 600 }}>Additional Details</td>
                    <td style={{ padding: '12px 8px' }}>{requirementDetails.details}</td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <p>Requirements information available.</p>
          )}
        </section>
      )}

      {br.requirement_doc && (
        <section style={{ background: '#fff', padding: 24, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginTop: 0, color: '#0052cc' }}>BRD Document</h2>
          <a
            href={br.requirement_doc}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              background: '#0052cc',
              color: '#fff',
              textDecoration: 'none',
              borderRadius: 6,
              fontWeight: 600
            }}
          >
            📄 View/Download Document
          </a>
        </section>
      )}

      {!br.requirement_created && br.status === 'Approved' && (
        <section style={{ background: '#fff3cd', padding: 24, borderRadius: 8, border: '1px solid #ffc107', marginTop: 20 }}>
          <p style={{ margin: 0, color: '#856404' }}>
            ⚠️ Requirements have not been added yet. Go to the <Link href="/dashboard">Dashboard</Link> to add requirements for this approved request.
          </p>
        </section>
      )}
    </div>
  )
}
