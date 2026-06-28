'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  function makeSlug(n: string): string {
    return n.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').substring(0, 50);
  }
  
  function handleNameChange(v: string) {
    setName(v);
    setSlug(makeSlug(v));
  }
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Senhas diferentes'); return; }
    if (password.length < 8) { setError('Senha min 8 chars'); return; }
    setLoading(true);
    try {
      const resp = await fetch('/api/v1/tenants/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: name, slug: slug, admin_email: email, admin_password: password })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || data.error || 'Erro');
      router.push('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '20px' }}>
      <Link href="/" style={{ color: '#6b7280' }}>Voltar</Link>
      <div style={{ maxWidth: '480px', margin: '40px auto', backgroundColor: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', textAlign: 'center', marginBottom: '8px' }}>Criar conta gratuita</h1>
        <p style={{ textAlign: 'center', color: '#6b7280', marginBottom: '24px' }}>Comece a usar o GTSoftHub</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>Nome da Empresa</label>
            <input type="text" value={name} onChange={e => handleNameChange(e.target.value)} required style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>URL da loja</label>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #d1d5db', borderRadius: '8px', padding: '0 12px', backgroundColor: '#f9fafb' }}>
              <span style={{ color: '#9ca3af', fontSize: '14px', whiteSpace: 'nowrap' }}>gtsofthub.com.br/</span>
              <input type="text" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} required style={{ flex: 1, padding: '12px 8px', border: 'none', backgroundColor: 'transparent', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>Senha (min 8)</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>Confirmar senha</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box' }} />
          </div>
          {error && <div style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '12px', borderRadius: '8px', fontSize: '14px' }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '12px', backgroundColor: '#1a1814', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1 }}>
            {loading ? 'Criando...' : 'Criar conta gratuita'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '24px', color: '#6b7280' }}>Ja tem conta? <Link href="/login" style={{ color: '#2563eb' }}>Faca login</Link></p>
      </div>
    </div>
  );
}
