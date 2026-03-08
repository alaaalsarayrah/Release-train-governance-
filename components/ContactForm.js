import { useState } from 'react'

export default function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  function submitMail(e) {
    e.preventDefault()
    const subject = encodeURIComponent('Thesis site contact from ' + name)
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${message}`)
    window.location.href = `mailto:you@example.com?subject=${subject}&body=${body}`
  }

  return (
    <form onSubmit={submitMail} style={{ display: 'grid', gap: 8 }}>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label>
        Message
        <textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} required />
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit">Send via email</button>
        <button type="button" onClick={() => { setName(''); setEmail(''); setMessage('') }}>Clear</button>
      </div>
    </form>
  )
}
