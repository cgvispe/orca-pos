<template>
  <teleport to="body">
    <transition name="modal-fade">
      <div v-if="visible" class="modal-backdrop" @click.self="handleBackdropClick">
        <div class="modal-box">

          <!-- ── PHASE: Connecting ── -->
          <div v-if="phase === 'connecting'" class="phase-center">
            <div class="spinner-lg"></div>
            <h2>Connecting to device...</h2>
            <p class="phase-sub">Starting cash transaction on RC5000</p>
            <button class="btn-secondary mt-20" @click="handleCancel">Cancel</button>
          </div>

          <!-- ── PHASE: Waiting for cash ── -->
          <div v-else-if="phase === 'waiting'" class="phase-waiting">
            <div class="waiting-header">
              <div class="device-badge">RC5000</div>
              <span class="status-dot pulsing"></span>
              <span class="status-text">Waiting for payment</span>
            </div>

            <div class="amount-display">
              <p class="label-sm">Amount due</p>
              <p class="amount-due">{{ theme.formatCurrency(props.total) }}</p>
            </div>

            <div class="progress-area">
              <div class="progress-row">
                <span class="prog-label">Inserted</span>
                <span class="prog-value inserted">{{ theme.formatCurrency(totalIn) }}</span>
              </div>
              <div class="prog-bar-track">
                <div class="prog-bar-fill" :style="{ width: progressPct + '%' }"></div>
              </div>
              <div class="progress-row">
                <span class="prog-label">Remaining</span>
                <span class="prog-value remaining">{{ theme.formatCurrency(Math.max(0, props.total - totalIn)) }}</span>
              </div>
            </div>

            <p class="insert-hint">👆 Please insert banknotes or coins into the recycler</p>

            <button class="btn-danger mt-20" @click="handleCancel" :disabled="cancelling">
              <span v-if="cancelling" class="spinner-sm"></span>
              <span v-else>Cancel Transaction</span>
            </button>
          </div>

          <!-- ── PHASE: Amount not available (status 7) ── -->
          <div v-else-if="phase === 'insufficient'" class="phase-center">
            <div class="icon-warning">⚠️</div>
            <h2>Insufficient Change</h2>
            <p class="phase-sub">
              The device cannot provide exact change.<br/>
              Received: <strong>{{ theme.formatCurrency(totalIn) }}</strong>
            </p>
            <div class="btn-group mt-20">
              <button class="btn-primary" @click="handleFinish" :disabled="finishing">
                <span v-if="finishing" class="spinner-sm"></span>
                <span v-else>Finish (Accept)</span>
              </button>
              <button class="btn-danger" @click="handleCancel" :disabled="cancelling">
                <span v-if="cancelling" class="spinner-sm"></span>
                <span v-else>Cancel & Return Cash</span>
              </button>
            </div>
          </div>

          <!-- ── PHASE: Success ── -->
          <div v-else-if="phase === 'success'" class="phase-center">
            <div class="success-circle">
              <span class="success-check">✓</span>
            </div>
            <h2 class="text-success">Payment Complete</h2>

            <div class="receipt-summary">
              <div class="receipt-row">
                <span>Total</span>
                <span>{{ theme.formatCurrency(props.total) }}</span>
              </div>
              <div class="receipt-row">
                <span>Received</span>
                <span>{{ theme.formatCurrency(totalIn) }}</span>
              </div>
              <div v-if="change > 0" class="receipt-row change-row">
                <span>💰 Change to return</span>
                <span class="change-amount">{{ theme.formatCurrency(change) }}</span>
              </div>
            </div>

            <p v-if="change > 0" class="change-banner">
              Return <strong>{{ theme.formatCurrency(change) }}</strong> to the customer
            </p>

            <button class="btn-primary mt-20" @click="handleClose">
              New Sale
            </button>
          </div>

          <!-- ── PHASE: Cancelled ── -->
          <div v-else-if="phase === 'cancelled'" class="phase-center">
            <div class="icon-cancelled">✕</div>
            <h2>Transaction Cancelled</h2>
            <p class="phase-sub">Cash has been returned to the customer.</p>
            <button class="btn-secondary mt-20" @click="handleClose">Close</button>
          </div>

          <!-- ── PHASE: Error ── -->
          <div v-else-if="phase === 'error'" class="phase-center">
            <div class="icon-error">⚠️</div>
            <h2 class="text-danger">Transaction Error</h2>
            <p class="phase-sub">{{ errorMessage }}</p>
            <button class="btn-secondary mt-20" @click="handleClose">Close</button>
          </div>

        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import api from '@/api'
import { useThemeStore } from '@/stores/theme'

const props = defineProps({
  visible: Boolean,
  total: Number,
  cartItems: Array
})

const emit = defineEmits(['close', 'success'])
const theme = useThemeStore()

// State
const phase = ref('connecting')  // connecting | waiting | insufficient | success | cancelled | error
const operationId = ref(null)
const totalIn = ref(0)
const totalOut = ref(0)
const change = ref(0)
const errorMessage = ref('')
const cancelling = ref(false)
const finishing = ref(false)

let pollInterval = null

const progressPct = computed(() => {
  if (!props.total || props.total <= 0) return 0
  return Math.min(100, (totalIn.value / props.total) * 100)
})

// Start transaction when modal becomes visible
watch(() => props.visible, async (v) => {
  if (v) {
    await startTransaction()
  } else {
    stopPolling()
    resetState()
  }
})

async function startTransaction() {
  resetState()
  phase.value = 'connecting'

  try {
    const res = await api.post('/sesami/payin', {
      amount: props.total,
      cartItems: props.cartItems,
      cartTotal: props.total
    })

    operationId.value = res.data.operationId
    phase.value = 'waiting'
    startPolling()
  } catch (err) {
    phase.value = 'error'
    errorMessage.value = err.response?.data?.error || 'Could not connect to RC5000. Check device settings.'
  }
}

function startPolling() {
  stopPolling()
  pollInterval = setInterval(pollStatus, 1500)
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

async function pollStatus() {
  if (!operationId.value) return

  try {
    const res = await api.get(`/sesami/operation/${operationId.value}`)
    const data = res.data

    totalIn.value = data.totalIn || 0
    totalOut.value = data.totalOut || 0

    // OperationStatus codes:
    // 1=Started, 2=Processing, 3=Cancelled, 4=Finished, 5=Finished by system,
    // 6=Error, 7=Amount not available, 8=Finished incomplete, 9=Cancelled incomplete
    switch (data.status) {
      case 1:
      case 2:
        // Still processing — keep polling
        break

      case 7:
        // Amount not available — let cashier decide
        stopPolling()
        phase.value = 'insufficient'
        break

      case 4:
      case 5:
        // Finished
        stopPolling()
        change.value = Math.max(0, totalIn.value - props.total)
        await finalizeSuccess()
        break

      case 8:
        // Finished incomplete
        stopPolling()
        change.value = Math.max(0, totalIn.value - props.total)
        await finalizeSuccess()
        break

      case 3:
      case 9:
        // Cancelled
        stopPolling()
        await finalizeCancel()
        break

      case 6:
        // Error — always logout to free the device
        stopPolling()
        errorMessage.value = 'Device reported an error during the transaction.'
        await logoutDevice()
        phase.value = 'error'
        break
    }
  } catch (err) {
    console.error('Poll error:', err.message)
    // Don't stop polling on transient network errors — RC5000 responds quickly
  }
}

async function handleFinish() {
  if (finishing.value) return
  finishing.value = true
  stopPolling()
  await finalizeSuccess()
  finishing.value = false
}

async function handleCancel() {
  if (cancelling.value) return
  cancelling.value = true
  stopPolling()

  try {
    await api.post('/sesami/operation/cancel')
  } catch (err) {
    // cancel may fail if operation already ended — proceed to logout anyway
    errorMessage.value = err.response?.data?.error || 'Cancel failed'
  }
  // Always logout — this is the critical step to free the device
  await logoutDevice()
  phase.value = 'cancelled'
  cancelling.value = false
}

async function finalizeSuccess() {
  try {
    const res = await api.post('/sesami/operation/finish', {
      operationId: operationId.value,
      cartItems: props.cartItems,
      cartTotal: props.total,
      amountReceived: totalIn.value,
      change: change.value
    })
    phase.value = 'success'
    emit('success', res.data.transaction)
  } catch (err) {
    phase.value = 'error'
    errorMessage.value = err.response?.data?.error || 'Failed to finalize transaction'
  }
}

async function finalizeCancel() {
  // Operation may already be in a terminal state (cancelled by machine),
  // so cancel call might fail — that's OK. Always logout after.
  try {
    await api.post('/sesami/operation/cancel')
  } catch {}
  await logoutDevice()
  phase.value = 'cancelled'
}

async function logoutDevice() {
  try {
    await api.post('/sesami/logout')
  } catch {}
}

function handleBackdropClick() {
  if (phase.value === 'success' || phase.value === 'cancelled' || phase.value === 'error') {
    handleClose()
  }
}

function handleClose() {
  stopPolling()
  emit('close', phase.value === 'success')
}

function resetState() {
  phase.value = 'connecting'
  operationId.value = null
  totalIn.value = 0
  totalOut.value = 0
  change.value = 0
  errorMessage.value = ''
  cancelling.value = false
  finishing.value = false
}

onUnmounted(() => stopPolling())
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 24px;
}

.modal-box {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  max-width: 480px;
  min-height: 380px;
  padding: 40px 36px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* ── Modal transition ── */
.modal-fade-enter-active { transition: all 0.25s ease-out; }
.modal-fade-leave-active { transition: all 0.2s ease-in; }
.modal-fade-enter-from { opacity: 0; transform: scale(0.95); }
.modal-fade-leave-to { opacity: 0; transform: scale(0.97); }

/* ── Phase: center ── */
.phase-center {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: center;
  width: 100%;
}

.phase-center h2 { font-size: 22px; font-weight: 700; }
.phase-sub { color: var(--color-text-2); font-size: 15px; line-height: 1.5; }

/* ── Phase: waiting ── */
.phase-waiting {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}

.waiting-header {
  align-items: center;
  display: flex;
  gap: 10px;
}

.device-badge {
  background: var(--color-surface-3);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  color: var(--color-text-2);
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-success);
}

.status-dot.pulsing {
  animation: pulse-dot 1.5s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.3); }
}

.status-text { color: var(--color-text-2); font-size: 14px; }

.amount-display { text-align: center; }
.label-sm { color: var(--color-text-3); font-size: 13px; margin-bottom: 4px; }
.amount-due { font-size: 42px; font-weight: 800; color: var(--color-text); letter-spacing: -1px; }

.progress-area {
  background: var(--color-surface-2);
  border-radius: var(--radius-md);
  padding: 16px;
}

.progress-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  margin-bottom: 10px;
}

.progress-row:last-child { margin-bottom: 0; margin-top: 10px; }

.prog-label { color: var(--color-text-2); }
.prog-value { font-weight: 700; }
.prog-value.inserted { color: var(--color-success); font-size: 16px; }
.prog-value.remaining { color: var(--color-warning); }

.prog-bar-track {
  background: var(--color-surface-3);
  border-radius: 4px;
  height: 8px;
  overflow: hidden;
}

.prog-bar-fill {
  background: linear-gradient(90deg, var(--color-success), #34d399);
  border-radius: 4px;
  height: 100%;
  transition: width 0.5s ease;
}

.insert-hint {
  color: var(--color-text-2);
  font-size: 14px;
  text-align: center;
}

/* ── Success ── */
.success-circle {
  background: var(--color-success-alpha);
  border: 3px solid var(--color-success);
  border-radius: 50%;
  height: 80px;
  width: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: pop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes pop-in {
  from { opacity: 0; transform: scale(0.5); }
  to   { opacity: 1; transform: scale(1); }
}

.success-check { color: var(--color-success); font-size: 36px; font-weight: 700; }
.text-success { color: var(--color-success); }
.text-danger { color: var(--color-danger); }

.receipt-summary {
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 16px;
  width: 100%;
}

.receipt-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: var(--color-text-2);
  padding: 6px 0;
  border-bottom: 1px solid var(--color-border);
}

.receipt-row:last-child { border-bottom: none; }

.change-row { color: var(--color-text); font-weight: 600; }
.change-amount { color: var(--color-warning); font-size: 18px; font-weight: 800; }

.change-banner {
  background: var(--color-warning-alpha);
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-md);
  color: var(--color-warning);
  font-size: 15px;
  font-weight: 600;
  padding: 12px 20px;
  text-align: center;
  width: 100%;
}

/* ── Icons ── */
.icon-warning, .icon-error, .icon-cancelled { font-size: 56px; }

/* ── Buttons ── */
.btn-primary, .btn-secondary, .btn-danger {
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-family: var(--font-family);
  font-size: 15px;
  font-weight: 600;
  min-height: 50px;
  padding: 14px 28px;
  transition: opacity 0.2s, transform 0.1s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn-primary { background: var(--color-primary); color: white; width: 100%; }
.btn-secondary { background: var(--color-surface-3); color: var(--color-text-2); width: 100%; }
.btn-danger { background: var(--color-danger-alpha); border: 1px solid var(--color-danger); color: var(--color-danger); width: 100%; }

.btn-primary:hover:not(:disabled), .btn-secondary:hover:not(:disabled), .btn-danger:hover:not(:disabled) { opacity: 0.85; }
.btn-primary:active:not(:disabled), .btn-secondary:active:not(:disabled), .btn-danger:active:not(:disabled) { transform: scale(0.98); }
.btn-primary:disabled, .btn-secondary:disabled, .btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-group { display: flex; flex-direction: column; gap: 10px; width: 100%; }

/* ── Spinners ── */
.spinner-lg {
  width: 56px;
  height: 56px;
  border: 4px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner-sm {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Utils ── */
.mt-20 { margin-top: 20px; }
</style>
