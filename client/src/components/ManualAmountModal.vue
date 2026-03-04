<template>
  <teleport to="body">
    <transition name="modal-fade">
      <div v-if="visible" class="modal-backdrop" @click.self="$emit('close')">
        <div class="modal-box-sm">
          <h2>Manual Amount</h2>
          <p class="subtitle">Enter the amount and optionally a reason</p>

          <!-- Display -->
          <div class="numpad-display">
            <span class="display-value">{{ theme.currencySymbol }} {{ displayValue }}</span>
          </div>

          <!-- Reason field -->
          <input
            v-model="reason"
            class="reason-input"
            placeholder="Reason (optional)"
            maxlength="80"
          />

          <!-- Numpad -->
          <div class="numpad-grid">
            <button v-for="k in keys" :key="k" class="numpad-key" :class="{ wide: k === '0' }" @click="press(k)">
              {{ k }}
            </button>
          </div>

          <div class="modal-actions">
            <button class="btn-secondary" @click="$emit('close')">Cancel</button>
            <button class="btn-primary" :disabled="parsedAmount <= 0" @click="confirm">
              Add to cart
            </button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useThemeStore } from '@/stores/theme'

const props = defineProps({ visible: Boolean })
const emit  = defineEmits(['close', 'confirm'])
const theme = useThemeStore()

const raw    = ref('0')   // string of digits, no decimal point
const reason = ref('')

const keys = ['7','8','9','4','5','6','1','2','3','⌫','0','⏎']

const displayValue = computed(() => {
  const n = parseInt(raw.value || '0')
  const euros = Math.floor(n / 100)
  const cents = String(n % 100).padStart(2, '0')
  return `${euros}.${cents}`
})

const parsedAmount = computed(() => parseInt(raw.value || '0') / 100)

watch(() => props.visible, v => { if (v) { raw.value = '0'; reason.value = '' } })

function press(k) {
  if (k === '⌫') {
    raw.value = raw.value.length <= 1 ? '0' : raw.value.slice(0, -1)
  } else if (k === '⏎') {
    confirm()
  } else {
    if (raw.value === '0') raw.value = k
    else if (raw.value.length < 8) raw.value += k
  }
}

function confirm() {
  if (parsedAmount.value <= 0) return
  emit('confirm', { amount: parsedAmount.value, reason: reason.value.trim() })
  emit('close')
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.75);
  backdrop-filter: blur(4px); display: flex; align-items: center;
  justify-content: center; z-index: 1000; padding: 24px;
}
.modal-box-sm {
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius-xl); box-shadow: var(--shadow-lg);
  padding: 32px 28px; width: 100%; max-width: 360px;
  display: flex; flex-direction: column; gap: 16px;
}
h2 { font-size: 20px; font-weight: 700; color: var(--color-text); text-align: center; margin: 0; }
.subtitle { font-size: 13px; color: var(--color-text-2); text-align: center; margin: -8px 0 0; }

.numpad-display {
  background: var(--color-surface-2); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); padding: 16px 20px; text-align: right;
}
.display-value { font-size: 32px; font-weight: 700; color: var(--color-text); font-variant-numeric: tabular-nums; }

.reason-input {
  background: var(--color-surface-2); border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); padding: 10px 14px; font-size: 14px;
  color: var(--color-text); width: 100%; outline: none;
}
.reason-input:focus { border-color: var(--color-primary); }

.numpad-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
}
.numpad-key {
  background: var(--color-surface-2); border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); padding: 16px 8px; font-size: 20px; font-weight: 600;
  color: var(--color-text); cursor: pointer; transition: background 0.1s;
  text-align: center;
}
.numpad-key:hover { background: var(--color-surface-3); border-color: var(--color-primary); }
.numpad-key:active { transform: scale(0.96); }

.modal-actions { display: flex; gap: 10px; }
.modal-actions .btn-secondary, .modal-actions .btn-primary {
  flex: 1; padding: 12px; border-radius: var(--radius-sm);
  font-size: 15px; font-weight: 600; cursor: pointer; border: none;
}
.modal-actions .btn-secondary {
  background: var(--color-surface-2); border: 1px solid var(--color-border); color: var(--color-text-2);
}
.modal-actions .btn-primary {
  background: var(--color-primary); color: #000;
}
.modal-actions .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

.modal-fade-enter-active { transition: all 0.2s ease-out; }
.modal-fade-leave-active { transition: all 0.15s ease-in; }
.modal-fade-enter-from { opacity: 0; transform: scale(0.95); }
.modal-fade-leave-to   { opacity: 0; transform: scale(0.97); }
</style>
