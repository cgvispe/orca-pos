<template>
  <div class="rc-status" :title="tooltip" @click="refresh">
    <div class="rc-icon" :class="iconClass">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <!-- Cash recycler icon: box with arrows -->
        <rect x="2" y="5" width="20" height="14" rx="2"/>
        <path d="M9 12l2 2 4-4"/>
        <path d="M2 9h3M19 9h3M2 15h3M19 15h3"/>
      </svg>
      <span class="rc-dot" :class="dotClass"></span>
    </div>
    <div class="rc-label">
      <span class="rc-name">RC5000</span>
      <span class="rc-state" :class="stateClass">{{ stateLabel }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import api from '@/api'

const props = defineProps({
  deviceId: { type: String, default: null }
})

const STATUS = {
  UNCONFIGURED: 'unconfigured',
  READY:        'ready',
  SESSION:      'session',
  WARNING:      'warning',
  ERROR:        'error',
  LOADING:      'loading'
}

const state = ref(STATUS.LOADING)
const rawStatus = ref(null)
let pollTimer = null

const stateLabel = computed(() => ({
  [STATUS.UNCONFIGURED]: 'Offline',
  [STATUS.READY]:        'Ready',
  [STATUS.SESSION]:      'In Use',
  [STATUS.WARNING]:      'Warning',
  [STATUS.ERROR]:        'Error',
  [STATUS.LOADING]:      '...',
}[state.value]))

const tooltip = computed(() => {
  if (state.value === STATUS.UNCONFIGURED) return 'RC5000: Not reachable. Check IP settings.'
  if (state.value === STATUS.READY) return 'RC5000: Ready — No active session'
  if (state.value === STATUS.SESSION) return `RC5000: Session active — POS: ${rawStatus.value?.pos || '?'}`
  if (state.value === STATUS.WARNING) return `RC5000: Warning — ${rawStatus.value?.message || ''}`
  if (state.value === STATUS.ERROR) return `RC5000: Error — ${rawStatus.value?.message || ''}`
  return 'RC5000'
})

// Icon outer ring color class
const iconClass = computed(() => ({
  [STATUS.UNCONFIGURED]: 'icon-grey',
  [STATUS.READY]:        'icon-green',
  [STATUS.SESSION]:      'icon-orange',
  [STATUS.WARNING]:      'icon-orange',
  [STATUS.ERROR]:        'icon-red',
  [STATUS.LOADING]:      'icon-grey',
}[state.value]))

// Dot color
const dotClass = computed(() => ({
  [STATUS.UNCONFIGURED]: 'dot-grey',
  [STATUS.READY]:        'dot-green',
  [STATUS.SESSION]:      'dot-orange',
  [STATUS.WARNING]:      'dot-orange',
  [STATUS.ERROR]:        'dot-red',
  [STATUS.LOADING]:      'dot-grey',
}[state.value]))

const stateClass = computed(() => ({
  [STATUS.READY]:   'text-green',
  [STATUS.SESSION]: 'text-orange',
  [STATUS.WARNING]: 'text-orange',
  [STATUS.ERROR]:   'text-red',
}[state.value] || 'text-grey'))

async function refresh() {
  if (!props.deviceId) { state.value = STATUS.UNCONFIGURED; return }
  try {
    const res = await api.get(`/sesami/status/${props.deviceId}`)
    rawStatus.value = res.data
    const s = res.data.status
    if      (s === 1 || s === 2)         state.value = STATUS.READY
    else if (s === 4 || s === 5 || s === 11) state.value = STATUS.SESSION
    else if (s === 12)                   state.value = STATUS.WARNING
    else if (s === 13 || s === 0)        state.value = STATUS.ERROR
    else                                 state.value = STATUS.READY
  } catch {
    state.value = STATUS.UNCONFIGURED
    rawStatus.value = null
  }
}

watch(() => props.deviceId, () => {
  state.value = STATUS.LOADING
  refresh()
})

onMounted(() => {
  refresh()
  pollTimer = setInterval(refresh, 30000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<style scoped>
.rc-status {
  align-items: center;
  cursor: pointer;
  display: flex;
  gap: 8px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: background 0.15s;
  user-select: none;
}
.rc-status:hover { background: var(--color-surface-2); }

.rc-icon {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.3s, color 0.3s;
}

.rc-icon svg { width: 20px; height: 20px; }

.icon-grey   { background: rgba(100,116,139,0.15); color: #64748b; }
.icon-green  { background: rgba(16,185,129,0.15);  color: #10b981; }
.icon-orange { background: rgba(245,158,11,0.15);  color: #f59e0b; }
.icon-red    { background: rgba(239,68,68,0.15);   color: #ef4444; }

/* Status dot — small circle in bottom-right corner */
.rc-dot {
  position: absolute;
  bottom: 3px;
  right: 3px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1.5px solid var(--color-surface);
  transition: background 0.3s;
}

.dot-grey   { background: #64748b; }
.dot-green  { background: #10b981; animation: pulse-green 2s infinite; }
.dot-orange { background: #f59e0b; animation: pulse-orange 2s infinite; }
.dot-red    { background: #ef4444; animation: pulse-red 1.2s infinite; }

@keyframes pulse-green  { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,0.5)}  50%{box-shadow:0 0 0 4px rgba(16,185,129,0)} }
@keyframes pulse-orange { 0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,0.5)} 50%{box-shadow:0 0 0 4px rgba(245,158,11,0)} }
@keyframes pulse-red    { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.6)}  50%{box-shadow:0 0 0 5px rgba(239,68,68,0)} }

.rc-label {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.rc-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-2);
  line-height: 1;
}

.rc-state {
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
}

.text-grey   { color: #64748b; }
.text-green  { color: #10b981; }
.text-orange { color: #f59e0b; }
.text-red    { color: #ef4444; }
</style>
