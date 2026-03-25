'use client'

import { useEffect, useState, useCallback } from 'react'

interface ChainNetwork {
  block: number | null
  chainId: number
  status: string
}

interface Chain {
  id: string
  name: string
  networks: Record<string, ChainNetwork>
}

interface Service {
  name: string
  url: string
  status: string
  latency: number
}

interface Contract {
  address: string
  name: string
}

interface StatusData {
  overall: string
  timestamp: string
  version: string
  chains: Chain[]
  services: Service[]
  contracts: Record<string, Record<string, Contract[]>>
}

const STATUS_COLORS: Record<string, string> = {
  operational: '#22c55e',
  up: '#22c55e',
  degraded: '#f59e0b',
  down: '#ef4444',
}

const STATUS_LABELS: Record<string, string> = {
  operational: 'Operational',
  up: 'Operational',
  degraded: 'Degraded',
  down: 'Down',
}

function StatusDot({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || '#6b7280'
  return (
    <span style={{
      display: 'inline-block',
      width: 8,
      height: 8,
      borderRadius: '50%',
      backgroundColor: color,
      boxShadow: `0 0 6px ${color}`,
      marginRight: 8,
    }} />
  )
}

function formatBlock(block: number | null): string {
  if (block === null) return '--'
  return block.toLocaleString()
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s ago`
  return `${Math.floor(secs / 60)}m ago`
}

export default function StatusPage() {
  const [data, setData] = useState<StatusData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<string>('')

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setLastFetch(new Date().toISOString())
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  if (!data && !error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ color: '#888', fontSize: 18 }}>Loading status...</div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>
            Hanzo Network Status
          </h1>
          <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
            Node {data?.version} &middot; Updated {lastFetch ? timeAgo(lastFetch) : '--'}
          </div>
        </div>
        <div style={{
          padding: '8px 16px',
          borderRadius: 8,
          backgroundColor: data?.overall === 'operational' ? '#052e16' : '#451a03',
          border: `1px solid ${data?.overall === 'operational' ? '#166534' : '#92400e'}`,
          color: data?.overall === 'operational' ? '#22c55e' : '#f59e0b',
          fontWeight: 600,
          fontSize: 14,
        }}>
          {data?.overall === 'operational' ? 'All Systems Operational' : 'Partial Degradation'}
        </div>
      </div>

      {error && (
        <div style={{ padding: 16, background: '#1c0a0a', border: '1px solid #7f1d1d', borderRadius: 8, marginBottom: 24, color: '#ef4444' }}>
          Error fetching status: {error}
        </div>
      )}

      {/* Chains */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#ccc' }}>Blockchain Networks</h2>
        <div style={{ background: '#111', borderRadius: 12, border: '1px solid #222', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #222' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#888', fontWeight: 500 }}>Chain</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', color: '#888', fontWeight: 500 }}>Mainnet</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', color: '#888', fontWeight: 500 }}>Testnet</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', color: '#888', fontWeight: 500 }}>Devnet</th>
              </tr>
            </thead>
            <tbody>
              {data?.chains.map((chain) => (
                <tr key={chain.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                  <td style={{ padding: '14px 16px', fontWeight: 500 }}>{chain.name}</td>
                  {['mainnet', 'testnet', 'devnet'].map((net) => {
                    const n = chain.networks[net]
                    return (
                      <td key={net} style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <StatusDot status={n?.status || 'down'} />
                        <span style={{ color: n?.block !== null ? '#e5e5e5' : '#555', fontVariantNumeric: 'tabular-nums' }}>
                          {formatBlock(n?.block ?? null)}
                        </span>
                        <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                          Chain {n?.chainId}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Services */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#ccc' }}>Services</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {data?.services.map((svc) => (
            <div key={svc.name} style={{
              background: '#111',
              borderRadius: 10,
              border: '1px solid #222',
              padding: '16px 20px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 500 }}>{svc.name}</span>
                <span style={{
                  fontSize: 12,
                  color: STATUS_COLORS[svc.status] || '#888',
                  fontWeight: 500,
                }}>
                  {STATUS_LABELS[svc.status] || svc.status}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#555', marginTop: 6 }}>
                {svc.latency}ms &middot;{' '}
                <a href={svc.url} target="_blank" rel="noopener" style={{ color: '#555', textDecoration: 'none' }}>
                  {svc.url.replace('https://', '')}
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contracts */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: '#ccc' }}>Deployed Contracts</h2>
        {data?.contracts && Object.entries(data.contracts).map(([network, groups]) => (
          <div key={network} style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 500, color: '#999', marginBottom: 8 }}>{network}</h3>
            {Object.entries(groups).map(([group, contracts]) => (
              <div key={group} style={{
                background: '#111',
                borderRadius: 10,
                border: '1px solid #222',
                padding: '12px 16px',
                marginBottom: 8,
              }}>
                <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>{group}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 6 }}>
                  {contracts.map((c) => (
                    <div key={c.address} style={{ fontSize: 13, fontFamily: 'monospace' }}>
                      <span style={{ color: '#ccc' }}>{c.name}</span>
                      <span style={{ color: '#555', marginLeft: 8 }}>
                        {c.address.slice(0, 10)}...{c.address.slice(-6)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* Footer */}
      <div style={{ textAlign: 'center', color: '#444', fontSize: 12, padding: '20px 0' }}>
        Hanzo Network &middot; Auto-refreshes every 30s &middot;{' '}
        <a href="https://hanzo.network" style={{ color: '#555' }}>hanzo.network</a>
      </div>
    </div>
  )
}
