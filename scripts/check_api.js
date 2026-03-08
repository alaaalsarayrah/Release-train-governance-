(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/business-request')
    const j = await res.json()
    console.log('GET /api/business-request status:', res.status)
    console.log('Requests count:', (j.requests || []).length)
    console.log('Sample:', (j.requests || [])[0] || 'none')
  } catch (e) {
    console.error('Error calling API:', e)
    process.exit(1)
  }
})()
