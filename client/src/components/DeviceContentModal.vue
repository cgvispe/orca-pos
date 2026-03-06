<template>
  <Teleport to="body">
    <div class="content-overlay" @click.self="$emit('close')">
      <div class="content-modal">

        <!-- Header -->
        <div class="modal-header">
          <div class="header-left">
            <span class="header-icon">🏧</span>
            <div>
              <h2 class="modal-title">Contenido de Efectivo</h2>
              <p class="modal-subtitle">{{ device?.name }} · {{ device?.ip }}:{{ device?.port }}</p>
            </div>
          </div>
          <div class="header-right">
            <button class="refresh-btn" :class="{ spinning: loading }" @click="loadContents" :disabled="loading">
              ↻
            </button>
            <button class="close-btn" @click="$emit('close')">✕</button>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="loading-state">
          <div class="pulse-ring"></div>
          <p>Consultando dispositivo…</p>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="error-state">
          <span class="error-icon">⚠</span>
          <p class="error-msg">{{ error }}</p>
          <button class="retry-btn" @click="loadContents">Reintentar</button>
        </div>

        <!-- Content -->
        <div v-else-if="contents" class="modal-body">

          <!-- Summary Cards -->
          <div class="summary-row">
            <div class="summary-card total-card">
              <span class="summary-label">Total en Máquina</span>
              <span class="summary-value">{{ fmt(grandTotal) }}</span>
            </div>
            <div class="summary-card recycling-card">
              <span class="summary-label">♻ Reciclaje</span>
              <span class="summary-value accent-teal">{{ fmt(recyclingTotal) }}</span>
              <span class="summary-sub">{{ recyclingCount }} billetes</span>
            </div>
            <div class="summary-card deposit-card">
              <span class="summary-label">🗃 Depósito</span>
              <span class="summary-value accent-amber">{{ fmt(depositTotal) }}</span>
              <span class="summary-sub">{{ depositCount }} billetes</span>
            </div>
            <div class="summary-card reject-card">
              <span class="summary-label">⛔ Rechazo</span>
              <span class="summary-value accent-red">{{ fmt(rejectTotal) }}</span>
              <span class="summary-sub">{{ rejectCount }} billetes</span>
            </div>
          </div>

          <!-- Stacked bar overview -->
          <div class="chart-section">
            <h3 class="section-title">Distribución por valor</h3>
            <div class="chart-bars">
              <template v-for="denom in allDenominations" :key="denom.value">
                <div class="bar-group">
                  <span class="denom-label">{{ denomLabel(denom.value) }}</span>
                  <div class="bar-track">
                    <div
                      class="bar-segment recycling"
                      :style="{ width: barWidth(denom.recycling, denom.maxCount) }"
                      :title="`♻ ${denom.recycling} billetes`"
                    >
                      <span v-if="denom.recycling > 0" class="bar-count">{{ denom.recycling }}</span>
                    </div>
                    <div
                      class="bar-segment deposit"
                      :style="{ width: barWidth(denom.deposit, denom.maxCount) }"
                      :title="`🗃 ${denom.deposit} billetes`"
                    >
                      <span v-if="denom.deposit > 0" class="bar-count">{{ denom.deposit }}</span>
                    </div>
                    <div
                      class="bar-segment reject"
                      :style="{ width: barWidth(denom.reject, denom.maxCount) }"
                      :title="`⛔ ${denom.reject} billetes`"
                    >
                      <span v-if="denom.reject > 0" class="bar-count">{{ denom.reject }}</span>
                    </div>
                  </div>
                  <span class="denom-total">{{ fmt(denom.totalValue) }}</span>
                </div>
              </template>
            </div>
            <!-- Legend -->
            <div class="chart-legend">
              <span class="legend-dot recycling"></span><span>Reciclaje</span>
              <span class="legend-dot deposit"></span><span>Depósito</span>
              <span class="legend-dot reject"></span><span>Rechazo</span>
            </div>
          </div>

          <!-- Currency tabs if multi-currency -->
          <div v-if="currencies.length > 1" class="currency-tabs">
            <button
              v-for="cur in currencies"
              :key="cur"
              class="currency-tab"
              :class="{ active: activeCurrency === cur }"
              @click="activeCurrency = cur"
            >{{ cur }}</button>
          </div>

          <!-- Denomination breakdown grid -->
          <div class="breakdown-section">
            <h3 class="section-title">Desglose por denominación</h3>
            <div class="cassette-tabs">
              <button
                v-for="type in cassetteTabs"
                :key="type.key"
                class="cassette-tab"
                :class="[{ active: activeCassette === type.key }, type.cls]"
                @click="activeCassette = type.key"
              >
                {{ type.icon }} {{ type.label }}
                <span class="cassette-count">{{ type.count }}</span>
              </button>
            </div>

            <div class="denomination-grid">
              <div
                v-for="item in activeDenominations"
                :key="item.denomination"
                class="denom-card"
                :class="{ 'zero-card': item.count === 0 }"
              >
                <div class="denom-face">{{ denomLabel(item.denomination) }}</div>
                <div class="denom-count">{{ item.count }}</div>
                <div class="denom-unit">billetes</div>
                <div class="denom-value">{{ fmt((item.denomination / 100) * item.count) }}</div>
                <!-- fill indicator -->
                <div
                  class="fill-bar"
                  :class="fillClass(item.count, item.capacity)"
                  :style="{ height: fillHeight(item.count, item.capacity) }"
                ></div>
              </div>
            </div>
          </div>

          <!-- Footer timestamp -->
          <div class="modal-footer">
            <span class="ts-label">Actualizado</span>
            <span class="ts-value">{{ lastUpdated }}</span>
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import { useThemeStore } from '../stores/theme'

const props = defineProps({
  device: { type: Object, required: true }
})
defineEmits(['close'])

const auth = useAuthStore()
const theme = useThemeStore()

const loading = ref(false)
const error = ref(null)
const contents = ref(null)
const lastUpdated = ref('')
const activeCurrency = ref('EUR')
const activeCassette = ref('recycling')

// ── API ──────────────────────────────────────────────────────────────────────
async function loadContents() {
  loading.value = true
  error.value = null
  try {
    const { data } = await axios.get(
      `/api/sesami/contents/${props.device.id}`,
      { headers: { Authorization: `Bearer ${auth.token}` } }
    )
    if (!data.ok) throw new Error(data.error || 'Error desconocido')
    contents.value = data.contents
    activeCurrency.value = currencies.value[0] ?? 'EUR'
    lastUpdated.value = new Date().toLocaleTimeString('es-ES')
  } catch (e) {
    error.value = e.response?.data?.error ?? e.message
  } finally {
    loading.value = false
  }
}

onMounted(loadContents)

// ── Derived data ──────────────────────────────────────────────────────────────
const currencies = computed(() => {
  if (!contents.value) return []
  const s = new Set()
  for (const cassette of Object.values(contents.value)) {
    cassette.forEach(d => s.add(d.currency))
  }
  return [...s]
})

function filterByCurrency(cassette) {
  return (contents.value?.[cassette] ?? [])
    .filter(d => d.currency === activeCurrency.value)
}

const recyclingItems = computed(() => filterByCurrency('recycling'))
const depositItems = computed(() => filterByCurrency('deposit'))
const rejectItems = computed(() => filterByCurrency('reject'))

const recyclingTotal = computed(() =>
  recyclingItems.value.reduce((s, d) => s + (d.denomination / 100) * d.count, 0))
const depositTotal = computed(() =>
  depositItems.value.reduce((s, d) => s + (d.denomination / 100) * d.count, 0))
const rejectTotal = computed(() =>
  rejectItems.value.reduce((s, d) => s + (d.denomination / 100) * d.count, 0))
const grandTotal = computed(() => recyclingTotal.value + depositTotal.value)

const recyclingCount = computed(() => recyclingItems.value.reduce((s, d) => s + d.count, 0))
const depositCount = computed(() => depositItems.value.reduce((s, d) => s + d.count, 0))
const rejectCount = computed(() => rejectItems.value.reduce((s, d) => s + d.count, 0))

// Chart data — merge all cassettes by denomination
const allDenominations = computed(() => {
  if (!contents.value) return []
  const map = {}
  const addTo = (items, key) => items.forEach(d => {
    if (!map[d.denomination]) map[d.denomination] = { value: d.denomination, recycling: 0, deposit: 0, reject: 0 }
    map[d.denomination][key] += d.count
  })
  addTo(recyclingItems.value, 'recycling')
  addTo(depositItems.value, 'deposit')
  addTo(rejectItems.value, 'reject')

  const DENOMINATIONS = [500, 1000, 2000, 5000, 10000, 20000]
  return DENOMINATIONS
    .filter(v => map[v])
    .map(v => {
      const d = map[v]
      const total = d.recycling + d.deposit + d.reject
      return {
        ...d,
        maxCount: total,
        totalValue: (v / 100) * total
      }
    })
    .filter(d => d.maxCount > 0)
})

const globalMax = computed(() => Math.max(1, ...allDenominations.value.map(d => d.recycling + d.deposit + d.reject)))

const cassetteTabs = computed(() => [
  { key: 'recycling', label: 'Reciclaje', icon: '♻', cls: 'tab-teal', count: recyclingCount.value },
  { key: 'deposit', label: 'Depósito', icon: '🗃', cls: 'tab-amber', count: depositCount.value },
  { key: 'reject', label: 'Rechazo', icon: '⛔', cls: 'tab-red', count: rejectCount.value },
])

const activeDenominations = computed(() => {
  const map = { recycling: recyclingItems, deposit: depositItems, reject: rejectItems }
  return (map[activeCassette.value]?.value ?? []).slice().sort((a, b) => a.denomination - b.denomination)
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(amount) {
  return theme.formatCurrency(amount)
}

function denomLabel(cents) {
  if (cents >= 100) return `€${cents / 100 % 1 === 0 ? cents / 100 : (cents / 100).toFixed(2)}`
  return `${cents}¢`
}

function barWidth(count, max) {
  if (!max) return '0%'
  return `${(count / globalMax.value) * 100}%`
}

function fillHeight(count, capacity) {
  if (!capacity || capacity === 0) return '0%'
  const pct = Math.min(100, (count / capacity) * 100)
  return `${pct}%`
}

function fillClass(count, capacity) {
  if (!capacity) return ''
  const pct = (count / capacity) * 100
  if (pct > 80) return 'fill-high'
  if (pct > 40) return 'fill-mid'
  return 'fill-low'
}
</script>

<style scoped>
/* ── Overlay ─────────────────────────────────────────────────────────────── */
.content-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
}

.content-modal {
  background: var(--color-surface, #0f1117);
  border: 1px solid rgba(0, 196, 179, 0.18);
  border-radius: 16px;
  width: 100%;
  max-width: 860px;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(0, 196, 179, 0.06);
  animation: modalIn 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes modalIn {
  from { opacity: 0; transform: scale(0.94) translateY(12px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

/* ── Header ─────────────────────────────────────────────────────────────── */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  position: sticky;
  top: 0;
  background: var(--color-surface, #0f1117);
  z-index: 2;
}

.header-left { display: flex; align-items: center; gap: 0.9rem; }
.header-icon { font-size: 1.8rem; line-height: 1; }
.modal-title { margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--color-text, #e8eaf0); }
.modal-subtitle { margin: 0.15rem 0 0; font-size: 0.78rem; color: rgba(255,255,255,0.4); font-family: 'JetBrains Mono', 'Fira Code', monospace; }
.header-right { display: flex; align-items: center; gap: 0.5rem; }

.refresh-btn {
  width: 34px; height: 34px; border-radius: 8px; border: 1px solid rgba(0,196,179,0.3);
  background: rgba(0,196,179,0.08); color: var(--color-primary, #00c4b3);
  font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.refresh-btn:hover { background: rgba(0,196,179,0.18); }
.refresh-btn.spinning { animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.close-btn {
  width: 34px; height: 34px; border-radius: 8px; border: none;
  background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5);
  font-size: 0.9rem; cursor: pointer; transition: all 0.15s;
}
.close-btn:hover { background: rgba(255,80,80,0.15); color: #ff5050; }

/* ── Loading / Error ─────────────────────────────────────────────────────── */
.loading-state, .error-state {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 1rem; padding: 4rem 2rem;
  color: rgba(255,255,255,0.5);
}

.pulse-ring {
  width: 48px; height: 48px; border-radius: 50%;
  border: 3px solid transparent;
  border-top-color: var(--color-primary, #00c4b3);
  animation: spin 0.9s linear infinite;
}

.error-icon { font-size: 2.5rem; }
.error-msg  { font-size: 0.9rem; color: #ff6b6b; text-align: center; max-width: 320px; }

.retry-btn {
  padding: 0.5rem 1.25rem; border-radius: 8px; border: 1px solid rgba(0,196,179,0.4);
  background: rgba(0,196,179,0.1); color: var(--color-primary, #00c4b3);
  font-size: 0.88rem; cursor: pointer; transition: all 0.15s;
}
.retry-btn:hover { background: rgba(0,196,179,0.2); }

/* ── Body ─────────────────────────────────────────────────────────────────── */
.modal-body { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }

/* Summary Row */
.summary-row { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 0.75rem; }

.summary-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 1rem 1.1rem;
  display: flex; flex-direction: column; gap: 0.25rem;
  position: relative; overflow: hidden;
  transition: border-color 0.15s;
}
.summary-card::before {
  content: ''; position: absolute; inset: 0;
  opacity: 0.04; pointer-events: none;
}
.total-card { border-color: rgba(255,255,255,0.12); }
.recycling-card { border-color: rgba(0,196,179,0.25); }
.deposit-card { border-color: rgba(255,193,7,0.25); }
.reject-card { border-color: rgba(255,100,100,0.2); }

.summary-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.4); }
.summary-value { font-size: 1.25rem; font-weight: 700; color: var(--color-text, #e8eaf0); font-variant-numeric: tabular-nums; }
.summary-sub   { font-size: 0.72rem; color: rgba(255,255,255,0.3); }

.accent-teal  { color: var(--color-primary, #00c4b3) !important; }
.accent-amber { color: #ffc107 !important; }
.accent-red   { color: #ff6b6b !important; }

/* Chart Section */
.chart-section { display: flex; flex-direction: column; gap: 0.75rem; }
.section-title {
  margin: 0; font-size: 0.78rem; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.1em;
  color: rgba(255,255,255,0.35);
}

.chart-bars { display: flex; flex-direction: column; gap: 0.5rem; }

.bar-group {
  display: grid;
  grid-template-columns: 60px 1fr 80px;
  align-items: center;
  gap: 0.75rem;
  animation: fadeSlideIn 0.3s ease both;
}
.bar-group:nth-child(1) { animation-delay: 0.04s; }
.bar-group:nth-child(2) { animation-delay: 0.08s; }
.bar-group:nth-child(3) { animation-delay: 0.12s; }
.bar-group:nth-child(4) { animation-delay: 0.16s; }
.bar-group:nth-child(5) { animation-delay: 0.20s; }
.bar-group:nth-child(6) { animation-delay: 0.24s; }

@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
}

.denom-label { font-size: 0.82rem; font-weight: 600; color: rgba(255,255,255,0.6); text-align: right; font-variant-numeric: tabular-nums; }
.denom-total { font-size: 0.78rem; color: rgba(255,255,255,0.4); text-align: right; font-variant-numeric: tabular-nums; }

.bar-track {
  height: 22px; border-radius: 5px; background: rgba(255,255,255,0.04);
  display: flex; overflow: hidden;
}
.bar-segment {
  height: 100%; transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex; align-items: center; justify-content: center;
  min-width: 0; overflow: hidden;
}
.bar-segment.recycling { background: linear-gradient(90deg, #00c4b3cc, #00c4b388); }
.bar-segment.deposit   { background: linear-gradient(90deg, #ffc107cc, #ffc10788); }
.bar-segment.reject    { background: linear-gradient(90deg, #ff6b6bcc, #ff6b6b88); }
.bar-count { font-size: 0.68rem; font-weight: 700; color: rgba(0,0,0,0.7); padding: 0 4px; white-space: nowrap; }

.chart-legend {
  display: flex; align-items: center; gap: 1.2rem;
  font-size: 0.75rem; color: rgba(255,255,255,0.4);
}
.legend-dot {
  width: 8px; height: 8px; border-radius: 50%;
  display: inline-block; margin-right: 4px;
}
.legend-dot.recycling { background: #00c4b3; }
.legend-dot.deposit   { background: #ffc107; }
.legend-dot.reject    { background: #ff6b6b; }

/* Cassette Tabs */
.cassette-tabs { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.cassette-tab {
  padding: 0.4rem 0.9rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.5);
  font-size: 0.82rem; cursor: pointer; transition: all 0.15s;
  display: flex; align-items: center; gap: 0.4rem;
}
.cassette-count {
  background: rgba(255,255,255,0.1); border-radius: 4px;
  padding: 0 5px; font-size: 0.72rem; font-weight: 700;
}
.cassette-tab.tab-teal.active  { background: rgba(0,196,179,0.15); border-color: rgba(0,196,179,0.5); color: #00c4b3; }
.cassette-tab.tab-amber.active { background: rgba(255,193,7,0.12); border-color: rgba(255,193,7,0.5); color: #ffc107; }
.cassette-tab.tab-red.active   { background: rgba(255,107,107,0.1); border-color: rgba(255,107,107,0.5); color: #ff6b6b; }

/* Denomination Grid */
.denomination-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 0.6rem;
  margin-top: 0.5rem;
}

.denom-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 0.9rem 0.75rem;
  display: flex; flex-direction: column; align-items: center; gap: 0.2rem;
  position: relative; overflow: hidden;
  transition: border-color 0.15s, background 0.15s;
  animation: cardIn 0.25s ease both;
}
@keyframes cardIn {
  from { opacity: 0; transform: scale(0.92); }
  to   { opacity: 1; transform: scale(1); }
}
.denom-card:hover { border-color: rgba(0,196,179,0.3); background: rgba(0,196,179,0.05); }
.zero-card { opacity: 0.4; }

.denom-face  { font-size: 1.1rem; font-weight: 800; color: var(--color-text, #e8eaf0); letter-spacing: -0.02em; }
.denom-count { font-size: 2rem; font-weight: 700; color: var(--color-primary, #00c4b3); line-height: 1; font-variant-numeric: tabular-nums; }
.denom-unit  { font-size: 0.65rem; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.08em; }
.denom-value { font-size: 0.78rem; color: rgba(255,255,255,0.5); font-variant-numeric: tabular-nums; margin-top: 0.25rem; }

/* Fill bar on right side of card */
.fill-bar {
  position: absolute; right: 0; bottom: 0; width: 4px;
  border-radius: 2px 0 0 0;
  transition: height 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  background: rgba(255,255,255,0.1);
}
.fill-bar.fill-low  { background: rgba(0, 196, 179, 0.5); }
.fill-bar.fill-mid  { background: rgba(255, 193, 7, 0.6); }
.fill-bar.fill-high { background: rgba(255, 107, 107, 0.7); }

/* Currency tabs */
.currency-tabs { display: flex; gap: 0.4rem; }
.currency-tab {
  padding: 0.3rem 0.75rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);
  background: transparent; color: rgba(255,255,255,0.4); font-size: 0.8rem; cursor: pointer; transition: all 0.15s;
}
.currency-tab.active { background: rgba(0,196,179,0.12); border-color: rgba(0,196,179,0.4); color: var(--color-primary, #00c4b3); }

/* Footer */
.modal-footer {
  display: flex; align-items: center; gap: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255,255,255,0.06);
  font-size: 0.74rem;
}
.ts-label { color: rgba(255,255,255,0.25); }
.ts-value  { color: rgba(255,255,255,0.4); font-family: 'JetBrains Mono', monospace; }

/* Breakdown section */
.breakdown-section { display: flex; flex-direction: column; gap: 0.75rem; }

/* Scrollbar */
.content-modal::-webkit-scrollbar { width: 6px; }
.content-modal::-webkit-scrollbar-track { background: transparent; }
.content-modal::-webkit-scrollbar-thumb { background: rgba(0,196,179,0.25); border-radius: 3px; }

/* Responsive */
@media (max-width: 600px) {
  .summary-row { grid-template-columns: 1fr 1fr; }
  .bar-group { grid-template-columns: 48px 1fr 64px; }
}
</style>
