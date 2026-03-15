import { useState, useEffect, useRef, useCallback } from 'react'
import {
  connectWallet, paintPixel, getPixel,
  loadFullCanvas, getStats, CONTRACT_ID,
} from './lib/stellar'

// ── Neon palette presets ───────────────────────────────────────────────────
const PALETTE = [
  '#ff0055', '#ff3300', '#ff6600', '#ffaa00',
  '#ffff00', '#aaff00', '#00ff41', '#00ffcc',
  '#00ccff', '#0066ff', '#6600ff', '#cc00ff',
  '#ff00cc', '#ffffff', '#aaaaaa', '#333333',
]

// ── Color utils ────────────────────────────────────────────────────────────
function numToHex(n) {
  if (!n) return null
  return '#' + n.toString(16).padStart(6, '0')
}

function shortAddr(addr) {
  if (!addr) return ''
  const s = addr.toString()
  return s.slice(0, 4) + '…' + s.slice(-4)
}

// ── Scanline overlay ───────────────────────────────────────────────────────
function Scanlines() {
  return <div className="scanlines" aria-hidden="true" />
}

// ── Pixel grid canvas ──────────────────────────────────────────────────────
function PixelGrid({ canvas, selectedPixel, onSelectPixel, loading }) {
  const [hovered, setHovered] = useState(null)

  return (
    <div className="canvas-wrap">
      <div className="canvas-grid">
        {canvas.map((color, idx) => {
          const x = idx % 32
          const y = Math.floor(idx / 32)
          const isSelected = selectedPixel && selectedPixel.x === x && selectedPixel.y === y
          const isHovered = hovered && hovered.x === x && hovered.y === y
          const hex = numToHex(color)

          return (
            <div
              key={idx}
              className={`pixel ${isSelected ? 'pixel-selected' : ''} ${isHovered ? 'pixel-hovered' : ''} ${!hex ? 'pixel-empty' : ''}`}
              style={hex ? { background: hex } : {}}
              onClick={() => onSelectPixel({ x, y, color: hex })}
              onMouseEnter={() => setHovered({ x, y })}
              onMouseLeave={() => setHovered(null)}
            />
          )
        })}
      </div>
      {hovered && (
        <div className="coord-display">
          [{hovered.x.toString().padStart(2, '0')}, {hovered.y.toString().padStart(2, '0')}]
        </div>
      )}
    </div>
  )
}

// ── Color palette picker ───────────────────────────────────────────────────
function ColorPicker({ value, onChange }) {
  return (
    <div className="color-picker">
      <div className="palette-grid">
        {PALETTE.map(c => (
          <button
            key={c}
            className={`swatch ${value === c ? 'swatch-active' : ''}`}
            style={{ background: c }}
            onClick={() => onChange(c)}
            title={c}
          />
        ))}
      </div>
      <div className="custom-row">
        <label className="custom-label">CUSTOM</label>
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="custom-input"
        />
        <span className="hex-display">{value.toUpperCase()}</span>
      </div>
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [wallet, setWallet] = useState(null)
  const [canvas, setCanvas] = useState(new Array(1024).fill(0))
  const [canvasLoading, setCanvasLoading] = useState(true)
  const [selectedPixel, setSelectedPixel] = useState(null)
  const [selectedColor, setSelectedColor] = useState('#00ff41')
  const [stats, setStats] = useState({ paintedCount: 0, totalPaints: 0 })
  const [txStatus, setTxStatus] = useState(null) // null | 'pending' | 'success' | 'error'
  const [lastTx, setLastTx] = useState(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [pixelInfo, setPixelInfo] = useState(null) // on-chain detail for selected pixel
  const [pixelLoading, setPixelLoading] = useState(false)

  // Load canvas on mount
  useEffect(() => {
    setCanvasLoading(true)
    loadFullCanvas()
      .then(setCanvas)
      .catch(console.error)
      .finally(() => setCanvasLoading(false))

    getStats().then(setStats)
  }, [])

  const handleConnect = async () => {
    try {
      const addr = await connectWallet()
      setWallet(addr)
    } catch (e) {
      setStatusMsg('⚠ ' + e.message)
    }
  }

  const handleSelectPixel = async (pixel) => {
    setSelectedPixel(pixel)
    setPixelInfo(null)
    if (pixel.color) {
      setPixelLoading(true)
      try {
        const info = await getPixel(pixel.x, pixel.y)
        setPixelInfo(info)
      } catch {}
      setPixelLoading(false)
    }
  }

  const handlePaint = async () => {
    if (!wallet || !selectedPixel) return
    try {
      setTxStatus('pending')
      setStatusMsg('> SIGNING TX...')
      const result = await paintPixel(wallet, selectedPixel.x, selectedPixel.y, selectedColor)
      setLastTx(result.txHash)
      setTxStatus('success')
      setStatusMsg(`> PIXEL [${selectedPixel.x},${selectedPixel.y}] PAINTED ON-CHAIN ✓`)

      // Update canvas locally
      const idx = selectedPixel.y * 32 + selectedPixel.x
      const colorInt = parseInt(selectedColor.replace('#', ''), 16)
      setCanvas(prev => {
        const next = [...prev]
        next[idx] = colorInt
        return next
      })
      setSelectedPixel(p => ({ ...p, color: selectedColor }))
      setStats(s => ({
        paintedCount: s.paintedCount + (selectedPixel.color ? 0 : 1),
        totalPaints: s.totalPaints + 1,
      }))
    } catch (e) {
      setTxStatus('error')
      setStatusMsg('> ERROR: ' + e.message.slice(0, 80))
    }
  }

  const progress = Math.round((stats.paintedCount / 1024) * 100)

  return (
    <div className="app">
      <Scanlines />

      {/* ── Header ── */}
      <header className="header">
        <div className="header-left">
          <h1 className="title">PIXEL<span className="title-accent">STAKE</span></h1>
          <p className="subtitle">32×32 ON-CHAIN CANVAS // STELLAR TESTNET</p>
        </div>
        <div className="header-right">
          {wallet ? (
            <div className="wallet-pill">
              <span className="wallet-dot" />
              <span>{shortAddr(wallet)}</span>
            </div>
          ) : (
            <button className="btn-connect" onClick={handleConnect}>
              CONNECT_WALLET
            </button>
          )}
        </div>
      </header>

      {/* ── Stats bar ── */}
      <div className="stats-bar">
        <div className="stat">
          <span className="stat-label">PIXELS CLAIMED</span>
          <span className="stat-value">{stats.paintedCount}<span className="stat-total">/1024</span></span>
        </div>
        <div className="progress-wrap">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
          <span className="progress-pct">{progress}%</span>
        </div>
        <div className="stat">
          <span className="stat-label">TOTAL PAINTS</span>
          <span className="stat-value">{stats.totalPaints}</span>
        </div>
        <div className="stat stat-contract">
          <span className="stat-label">CONTRACT</span>
          <a
            href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`}
            target="_blank"
            rel="noreferrer"
            className="stat-link"
          >{CONTRACT_ID ? CONTRACT_ID.slice(0, 10) + '…' : 'DEPLOY FIRST'}</a>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="main-layout">

        {/* Canvas */}
        <div className="canvas-section">
          {canvasLoading ? (
            <div className="canvas-loading">
              <div className="loading-text">LOADING CANVAS FROM CHAIN</div>
              <div className="loading-bar">
                <div className="loading-fill" />
              </div>
            </div>
          ) : (
            <PixelGrid
              canvas={canvas}
              selectedPixel={selectedPixel}
              onSelectPixel={handleSelectPixel}
            />
          )}
          <p className="canvas-hint">CLICK ANY PIXEL TO SELECT // HOVER FOR COORDS</p>
        </div>

        {/* Sidebar */}
        <div className="sidebar">

          {/* Selected pixel info */}
          <div className="panel">
            <div className="panel-title">// SELECTED PIXEL</div>
            {selectedPixel ? (
              <div className="pixel-info">
                <div className="pixel-coords">
                  <span className="info-label">COORDS</span>
                  <span className="info-val">[{selectedPixel.x}, {selectedPixel.y}]</span>
                </div>
                <div className="pixel-preview-row">
                  <div
                    className="pixel-preview"
                    style={{ background: selectedPixel.color || '#111' }}
                  />
                  <div className="pixel-current-color">
                    <span className="info-label">CURRENT COLOR</span>
                    <span className="info-val mono">{selectedPixel.color || 'UNCLAIMED'}</span>
                  </div>
                </div>
                {pixelLoading && <div className="info-loading">READING CHAIN...</div>}
                {pixelInfo && (
                  <div className="pixel-chain-info">
                    <div className="info-row">
                      <span className="info-label">OWNER</span>
                      <span className="info-val mono">{shortAddr(pixelInfo.owner?.toString())}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">PAINTS</span>
                      <span className="info-val">{pixelInfo.paint_count?.toString()}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="no-selection">SELECT A PIXEL ON THE CANVAS</p>
            )}
          </div>

          {/* Color picker */}
          <div className="panel">
            <div className="panel-title">// PAINT COLOR</div>
            <ColorPicker value={selectedColor} onChange={setSelectedColor} />
          </div>

          {/* Paint button */}
          <button
            className={`btn-paint ${txStatus === 'pending' ? 'btn-painting' : ''}`}
            onClick={handlePaint}
            disabled={!wallet || !selectedPixel || txStatus === 'pending'}
          >
            {txStatus === 'pending'
              ? '> WRITING TO CHAIN...'
              : !wallet
                ? '> CONNECT WALLET FIRST'
                : !selectedPixel
                  ? '> SELECT A PIXEL'
                  : `> PAINT [${selectedPixel?.x ?? '?'}, ${selectedPixel?.y ?? '?'}]`}
          </button>

          {/* TX status terminal */}
          {statusMsg && (
            <div className={`terminal ${txStatus === 'error' ? 'terminal-error' : txStatus === 'success' ? 'terminal-success' : 'terminal-pending'}`}>
              <div className="terminal-line">{statusMsg}</div>
              {lastTx && txStatus === 'success' && (
                <div className="terminal-line">
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${lastTx}`}
                    target="_blank"
                    rel="noreferrer"
                    className="terminal-link"
                  >> VIEW TX ON STELLAR EXPERT ↗</a>
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="panel panel-sm">
            <div className="panel-title">// HOW IT WORKS</div>
            <div className="legend">
              <div className="legend-item"><span className="legend-dot dot-empty" />UNCLAIMED PIXEL</div>
              <div className="legend-item"><span className="legend-dot dot-painted" />CLAIMED ON-CHAIN</div>
              <div className="legend-item"><span className="legend-dot dot-selected" />YOUR SELECTION</div>
            </div>
            <p className="legend-note">Each paint = 1 on-chain Soroban transaction. Your wallet address is permanently linked to every pixel you claim.</p>
          </div>

        </div>
      </div>

      <footer className="footer">
        <span>PIXELSTAKE — ON-CHAIN PIXEL CANVAS</span>
        <a href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`} target="_blank" rel="noreferrer">
          CONTRACT ↗
        </a>
      </footer>
    </div>
  )
}
