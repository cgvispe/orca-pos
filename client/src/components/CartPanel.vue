<template>
  <aside class="cart-panel">
    <!-- Header -->
    <div class="cart-header">
      <h2 class="cart-title">
        <span class="cart-icon">🛒</span>
        Cart
        <span v-if="!cart.isEmpty" class="cart-badge">{{ cart.itemCount }}</span>
      </h2>
      <button v-if="!cart.isEmpty" class="btn-clear" @click="cart.clear()" title="Clear cart">
        Clear
      </button>
    </div>

    <!-- Items list -->
    <div class="cart-items" ref="itemsEl">
      <transition-group name="cart-item" tag="div" class="cart-items-inner">
        <div
          v-for="item in cart.items"
          :key="item.id"
          class="cart-item"
        >
          <div class="item-emoji">{{ item.emoji || '🛍️' }}</div>
          <div class="item-info">
            <p class="item-name">{{ item.name }}</p>
            <p class="item-unit-price">{{ theme.formatCurrency(item.price) }} each</p>
          </div>
          <div class="item-controls">
            <button class="qty-btn" @click="cart.decreaseQty(item.id)" aria-label="Decrease">−</button>
            <span class="qty-value">{{ item.qty }}</span>
            <button class="qty-btn" @click="cart.increaseQty(item.id)" aria-label="Increase">+</button>
          </div>
          <p class="item-subtotal">{{ theme.formatCurrency(item.price * item.qty) }}</p>
          <button class="btn-remove" @click="cart.removeItem(item.id)" aria-label="Remove item">✕</button>
        </div>
      </transition-group>

      <!-- Empty state -->
      <div v-if="cart.isEmpty" class="cart-empty">
        <span class="empty-icon">🛒</span>
        <p>Cart is empty</p>
        <p class="empty-sub">Tap products to add them</p>
      </div>
    </div>

    <!-- Summary -->
    <div class="cart-footer">
      <div class="summary-row">
        <span>Subtotal</span>
        <span>{{ cart.formattedTotal }}</span>
      </div>
      <div class="summary-row total">
        <span>Total</span>
        <span class="total-amount" :class="{ refund: cart.isRefund }">
          {{ cart.formattedSignedTotal }}
        </span>
      </div>

      <!-- Refund toggle — only for authorized users -->
      <label v-if="auth.user?.canRefund || auth.isManager" class="refund-toggle" :class="{ active: cart.isRefund }">
        <input type="checkbox" :checked="cart.isRefund" @change="cart.setRefund($event.target.checked)" />
        <span class="refund-toggle-track">
          <span class="refund-toggle-thumb"></span>
        </span>
        <span class="refund-toggle-label">{{ cart.isRefund ? '↩️ Refund mode' : 'Refund mode' }}</span>
      </label>

      <!-- Manual amount button -->
      <button class="btn-manual-amount" @click="$emit('manual-amount')">
        <span>＋</span> Add manual amount
      </button>

      <button
        class="btn-checkout"
        :class="{ manual: !auth.hasDevice, refund: cart.isRefund }"
        :disabled="cart.isEmpty"
        @click="$emit('checkout')"
      >
        <span class="checkout-icon">{{ cart.isRefund ? '↩️' : (auth.hasDevice ? '🏧' : '💵') }}</span>
        {{ cart.isRefund ? 'Dispense' : (auth.hasDevice ? 'Pay' : 'Manual Pay') }}
        {{ cart.isEmpty ? '' : cart.formattedTotal }}
      </button>
    </div>
  </aside>
</template>

<script setup>
import { useCartStore } from '@/stores/cart'
import { useThemeStore } from '@/stores/theme'
import { useAuthStore } from '@/stores/auth'

const cart  = useCartStore()
const theme = useThemeStore()
const auth  = useAuthStore()
defineEmits(['checkout', 'manual-amount'])
</script>

<style scoped>
.cart-panel {
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 340px;
  min-width: 300px;
  flex-shrink: 0;
}

.cart-header {
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  padding: 20px 20px 16px;
}

.cart-title {
  align-items: center;
  display: flex;
  font-size: 18px;
  font-weight: 700;
  gap: 8px;
}

.cart-icon { font-size: 20px; }

.cart-badge {
  background: var(--color-primary);
  border-radius: 20px;
  color: white;
  font-size: 12px;
  font-weight: 700;
  min-width: 22px;
  padding: 2px 6px;
  text-align: center;
}

.btn-clear {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-2);
  cursor: pointer;
  font-size: 13px;
  padding: 6px 12px;
  transition: border-color 0.15s, color 0.15s;
}
.btn-clear:hover { border-color: var(--color-danger); color: var(--color-danger); }

/* Items scrollable area */
.cart-items {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.cart-items-inner { padding: 0 12px; }

.cart-item {
  align-items: center;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  display: grid;
  gap: 8px;
  grid-template-columns: 36px 1fr auto auto auto;
  margin-bottom: 8px;
  padding: 10px 12px;
}

.item-emoji { font-size: 24px; text-align: center; }

.item-info { min-width: 0; }
.item-name {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-unit-price { color: var(--color-text-3); font-size: 12px; margin-top: 2px; }

.item-controls {
  align-items: center;
  background: var(--color-surface-3);
  border-radius: 20px;
  display: flex;
  gap: 0;
}

.qty-btn {
  background: none;
  border: none;
  border-radius: 50%;
  color: var(--color-text);
  cursor: pointer;
  font-size: 18px;
  height: 32px;
  line-height: 1;
  transition: background 0.15s;
  width: 32px;
}
.qty-btn:hover { background: var(--color-border); }
.qty-btn:active { background: var(--color-primary-alpha); color: var(--color-primary); }

.qty-value {
  font-size: 14px;
  font-weight: 700;
  min-width: 24px;
  text-align: center;
}

.item-subtotal {
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 700;
  text-align: right;
  white-space: nowrap;
}

.btn-remove {
  background: none;
  border: none;
  border-radius: 50%;
  color: var(--color-text-3);
  cursor: pointer;
  font-size: 12px;
  height: 24px;
  transition: color 0.15s, background 0.15s;
  width: 24px;
}
.btn-remove:hover { background: var(--color-danger-alpha); color: var(--color-danger); }

/* Cart item animation */
.cart-item-enter-active { transition: all 0.2s ease-out; }
.cart-item-leave-active { transition: all 0.15s ease-in; }
.cart-item-enter-from { opacity: 0; transform: translateX(20px); }
.cart-item-leave-to { opacity: 0; transform: translateX(-10px); }

/* Empty state */
.cart-empty {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}
.empty-icon { font-size: 48px; opacity: 0.3; }
.cart-empty p { color: var(--color-text-2); font-size: 15px; font-weight: 500; }
.empty-sub { color: var(--color-text-3); font-size: 13px; }

/* Footer */
.cart-footer {
  border-top: 1px solid var(--color-border);
  padding: 16px 20px 20px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: var(--color-text-2);
  margin-bottom: 8px;
}

.summary-row.total {
  border-top: 1px solid var(--color-border);
  margin-top: 8px;
  padding-top: 12px;
  color: var(--color-text);
  font-size: 16px;
  font-weight: 600;
}

.total-amount {
  color: var(--color-primary);
  font-size: 20px;
  font-weight: 700;
}

.btn-checkout.manual { background: #6366f1; }
.btn-checkout.refund { background: #f0a500; }
.total-amount.refund { color: var(--color-warning); }

.refund-toggle {
  display: flex; align-items: center; gap: 10px;
  cursor: pointer; padding: 10px 0; user-select: none;
}
.refund-toggle input { display: none; }
.refund-toggle-track {
  width: 36px; height: 20px; background: var(--color-surface-3);
  border: 1px solid var(--color-border); border-radius: 999px;
  position: relative; transition: background 0.2s;
  flex-shrink: 0;
}
.refund-toggle.active .refund-toggle-track { background: var(--color-warning); border-color: var(--color-warning); }
.refund-toggle-thumb {
  position: absolute; top: 2px; left: 2px;
  width: 14px; height: 14px; background: white;
  border-radius: 50%; transition: transform 0.2s;
}
.refund-toggle.active .refund-toggle-thumb { transform: translateX(16px); }
.refund-toggle-label { font-size: 13px; color: var(--color-text-2); }
.refund-toggle.active .refund-toggle-label { color: var(--color-warning); font-weight: 600; }

.btn-manual-amount {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  width: 100%; padding: 8px; margin-bottom: 8px;
  background: transparent; border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm); color: var(--color-text-2);
  font-size: 13px; cursor: pointer; transition: all 0.15s;
}
.btn-manual-amount:hover { border-color: var(--color-primary); color: var(--color-primary); }
.btn-checkout {
  align-items: center;
  background: var(--color-primary);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  cursor: pointer;
  display: flex;
  font-family: var(--font-family);
  font-size: 16px;
  font-weight: 700;
  gap: 10px;
  justify-content: center;
  margin-top: 16px;
  min-height: 56px;
  padding: 16px;
  transition: opacity 0.2s, transform 0.1s;
  width: 100%;
}

.btn-checkout:hover:not(:disabled) { opacity: 0.9; }
.btn-checkout:active:not(:disabled) { transform: scale(0.98); }
.btn-checkout:disabled { opacity: 0.4; cursor: not-allowed; }
.checkout-icon { font-size: 20px; }
</style>
