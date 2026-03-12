import * as StellarSdk from '@stellar/stellar-sdk'
import { requestAccess, getAddress, signTransaction } from '@stellar/freighter-api'

const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID
const NETWORK_PASSPHRASE = import.meta.env.VITE_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015'
const SOROBAN_RPC_URL = import.meta.env.VITE_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org'

export const rpc = new StellarSdk.rpc.Server(SOROBAN_RPC_URL)

export async function connectWallet() {
  await requestAccess()
  const { address } = await getAddress()
  return address
}

async function simulateAndSend(tx) {
  const sim = await rpc.simulateTransaction(tx)
  if (StellarSdk.rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`)
  }
  const prepared = StellarSdk.rpc.assembleTransaction(tx, sim).build()
  const signed = await signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE })
  const final = StellarSdk.TransactionBuilder.fromXDR(signed.signedTxXdr, NETWORK_PASSPHRASE)
  const result = await rpc.sendTransaction(final)
  return result
}

async function pollTx(hash) {
  for (let i = 0; i < 30; i++) {
    const r = await rpc.getTransaction(hash)
    if (r.status === 'SUCCESS') return r
    if (r.status === 'FAILED') throw new Error('Transaction failed')
    await new Promise(res => setTimeout(res, 2000))
  }
  throw new Error('Transaction timed out')
}

// ── Paint a pixel ──────────────────────────────────────────────────────────
export async function paintPixel(painterAddress, x, y, colorHex) {
  const colorInt = parseInt(colorHex.replace('#', ''), 16)
  const account = await rpc.getAccount(painterAddress)
  const contract = new StellarSdk.Contract(CONTRACT_ID)

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(
      'paint_pixel',
      StellarSdk.Address.fromString(painterAddress).toScVal(),
      StellarSdk.xdr.ScVal.scvU32(x),
      StellarSdk.xdr.ScVal.scvU32(y),
      StellarSdk.xdr.ScVal.scvU32(colorInt),
    ))
    .setTimeout(30)
    .build()

  const sendResult = await simulateAndSend(tx)
  await pollTx(sendResult.hash)
  return { txHash: sendResult.hash }
}

// ── Read a single pixel ────────────────────────────────────────────────────
export async function getPixel(x, y) {
  const dummy = new StellarSdk.Account('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN', '0')
  const contract = new StellarSdk.Contract(CONTRACT_ID)
  const tx = new StellarSdk.TransactionBuilder(dummy, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(
      'get_pixel',
      StellarSdk.xdr.ScVal.scvU32(x),
      StellarSdk.xdr.ScVal.scvU32(y),
    ))
    .setTimeout(30)
    .build()

  const result = await rpc.simulateTransaction(tx)
  const native = StellarSdk.scValToNative(result.result.retval)
  return native // null or { color, owner, painted_at, paint_count }
}

// ── Read a 16x16 region ────────────────────────────────────────────────────
export async function getRegion(xStart, yStart, w, h) {
  const dummy = new StellarSdk.Account('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN', '0')
  const contract = new StellarSdk.Contract(CONTRACT_ID)
  const tx = new StellarSdk.TransactionBuilder(dummy, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(
      'get_region',
      StellarSdk.xdr.ScVal.scvU32(xStart),
      StellarSdk.xdr.ScVal.scvU32(yStart),
      StellarSdk.xdr.ScVal.scvU32(w),
      StellarSdk.xdr.ScVal.scvU32(h),
    ))
    .setTimeout(30)
    .build()

  const result = await rpc.simulateTransaction(tx)
  return StellarSdk.scValToNative(result.result.retval) // u32[]
}

// ── Stats ──────────────────────────────────────────────────────────────────
export async function getStats() {
  const dummy = new StellarSdk.Account('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN', '0')
  const contract = new StellarSdk.Contract(CONTRACT_ID)

  const makeTx = (fn) => new StellarSdk.TransactionBuilder(dummy, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  }).addOperation(contract.call(fn)).setTimeout(30).build()

  try {
    const [r1, r2] = await Promise.all([
      rpc.simulateTransaction(makeTx('painted_count')),
      rpc.simulateTransaction(makeTx('total_paints')),
    ])
    return {
      paintedCount: Number(StellarSdk.scValToNative(r1.result.retval)),
      totalPaints: Number(StellarSdk.scValToNative(r2.result.retval)),
    }
  } catch {
    return { paintedCount: 0, totalPaints: 0 }
  }
}

// ── Load full canvas (4 quadrants of 16x16) ────────────────────────────────
export async function loadFullCanvas() {
  // 32x32 = 4 regions of 16x16
  const regions = [
    { x: 0, y: 0 }, { x: 16, y: 0 },
    { x: 0, y: 16 }, { x: 16, y: 16 },
  ]

  const results = await Promise.allSettled(
    regions.map(r => getRegion(r.x, r.y, 16, 16))
  )

  // Assemble into flat 32x32 array (row-major)
  const canvas = new Array(32 * 32).fill(0)
  regions.forEach(({ x: rx, y: ry }, qi) => {
    const result = results[qi]
    if (result.status !== 'fulfilled') return
    const colors = result.value
    for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 16; col++) {
        const srcIdx = row * 16 + col
        const dstIdx = (ry + row) * 32 + (rx + col)
        canvas[dstIdx] = colors[srcIdx] || 0
      }
    }
  })
  return canvas
}

export { CONTRACT_ID, NETWORK_PASSPHRASE }
