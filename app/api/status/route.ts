import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// The network is chosen by host, never by a path segment, and every EVM answers
// on the same path: /v1/bc/C/rpc. Hanzo is a sovereign L1 with its own gateway —
// it is not reachable as a blockchain-ID path on api.lux.network any more.
const RPC = '/v1/bc/C/rpc'
const GATEWAY = {
  mainnet: process.env.MAINNET_GATEWAY || 'https://api.hanzo.network',
  testnet: process.env.TESTNET_GATEWAY || 'https://api.hanzo-test.network',
  devnet: process.env.DEVNET_GATEWAY || 'https://api.hanzo-dev.network',
}

const CHAINS: Record<string, { name: string; path: Record<string, string>; chainId: Record<string, number> }> = {
  hanzo: {
    name: 'Hanzo',
    path: { mainnet: RPC, testnet: RPC, devnet: RPC },
    chainId: { mainnet: 36963, testnet: 36964, devnet: 36964 },
  },
}

const SERVICES = [
  // Core infrastructure
  { name: 'API Gateway', url: 'https://api.hanzo.ai' },
  { name: 'LLM Gateway', url: 'https://llm.hanzo.ai' },
  { name: 'Chat', url: 'https://chat.hanzo.ai' },
  { name: 'Console', url: 'https://console.hanzo.ai' },
  { name: 'Cloud', url: 'https://cloud.hanzo.ai' },
  { name: 'Platform', url: 'https://platform.hanzo.ai' },
  // Identity & security
  { name: 'IAM', url: 'https://hanzo.id' },
  { name: 'KMS', url: 'https://kms.hanzo.ai' },
  // Developer tools
  { name: 'Docs', url: 'https://docs.hanzo.ai' },
  { name: 'Search', url: 'https://search.hanzo.ai' },
  // Web properties
  { name: 'Website', url: 'https://hanzo.ai' },
  { name: 'App', url: 'https://hanzo.app' },
  // Blockchain
  { name: 'Explorer (Hanzo)', url: 'https://explore-hanzo.lux.network' },
  { name: 'Hanzo RPC', url: 'https://api.hanzo.network/v1/bc/C/rpc' },
]

const CONTRACTS: Record<string, Record<string, { address: string; name: string }[]>> = {
  'Hanzo Mainnet (36963)': {
    'Core Tokens': [
      { address: '0x548f54dfb32ea6ce4fa3515236696cf3d1b7d26a', name: 'WLUX' },
      { address: '0xe0f7e9a0cb1688cca453995fd6e19ae4fbd9cbfd', name: 'LETH' },
      { address: '0xab95c8b59f68ce922f2f334dfc8bb8f5b0525326', name: 'StakedLUX (sLUX)' },
    ],
    'AMM': [
      { address: '0x84cf0a13db1be8e1f0676405cfcbc8b09692fd1c', name: 'AMMV2Factory' },
      { address: '0x2382f7a49fa48e1f91bec466c32e1d7f13ec8206', name: 'AMMV2Router' },
    ],
  },
}

async function rpcCall(url: string, method: string, params: unknown[] = []): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
      signal: controller.signal,
    })
    const data = await res.json()
    return data.result
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function checkService(url: string): Promise<{ status: string; latency: number }> {
  const start = Date.now()
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const isRpc = url.endsWith('/rpc')
    const res = await fetch(url, {
      method: isRpc ? 'POST' : 'GET',
      headers: isRpc ? { 'Content-Type': 'application/json' } : undefined,
      body: isRpc ? JSON.stringify({ jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 }) : undefined,
      signal: controller.signal,
      redirect: 'follow',
    })
    clearTimeout(timeout)
    return { status: res.ok ? 'up' : 'degraded', latency: Date.now() - start }
  } catch {
    return { status: 'down', latency: Date.now() - start }
  }
}

export async function GET() {
  const networks = ['mainnet', 'testnet', 'devnet'] as const

  // Fetch all chain statuses in parallel
  const chainResults: Record<string, Record<string, { block: number | null; chainId: number; status: string }>> = {}

  const promises: Promise<void>[] = []

  for (const [key, chain] of Object.entries(CHAINS)) {
    chainResults[key] = {}
    for (const net of networks) {
      const url = GATEWAY[net] + chain.path[net]
      promises.push(
        rpcCall(url, 'eth_blockNumber').then((result) => {
          const block = result ? parseInt(result as string, 16) : null
          chainResults[key][net] = {
            block,
            chainId: chain.chainId[net],
            status: block !== null ? 'operational' : 'down',
          }
        })
      )
    }
  }

  // Fetch service statuses in parallel
  const serviceResults: Record<string, { status: string; latency: number }> = {}
  for (const svc of SERVICES) {
    promises.push(
      checkService(svc.url).then((r) => {
        serviceResults[svc.name] = r
      })
    )
  }

  await Promise.all(promises)

  // Build response
  const chains = Object.entries(CHAINS).map(([key, chain]) => ({
    id: key,
    name: chain.name,
    networks: Object.fromEntries(
      networks.map((net) => [net, chainResults[key][net]])
    ),
  }))

  const services = SERVICES.map((svc) => ({
    name: svc.name,
    url: svc.url,
    ...serviceResults[svc.name],
  }))

  const allOperational = chains.every((c) =>
    Object.values(c.networks).every((n) => n.status === 'operational')
  )
  const allServicesUp = services.every((s) => s.status === 'up')

  return NextResponse.json({
    overall: allOperational && allServicesUp ? 'operational' : 'degraded',
    timestamp: new Date().toISOString(),
    version: 'v5.0.0',
    chains,
    services,
    contracts: CONTRACTS,
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
