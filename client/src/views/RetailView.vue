<template>
  <div class="retail-layout">

    <!-- ═══ TOP BAR ═══ -->
    <header class="top-bar">
      <div class="topbar-left">
        <div class="brand-logo">
          <img v-if="theme.logoUrl" :src="theme.logoUrl" alt="Logo" />
          <span v-else>🏪</span>
        </div>
        <div class="brand-info">
          <span class="brand-name">{{ theme.businessName }}</span>
          <span class="brand-sub">Point of Sale</span>
        </div>
      </div>

      <div class="topbar-center">
        <div class="category-tabs">
          <button class="cat-tab" :class="{ active: activeCategory === '' }" @click="activeCategory = ''">All</button>
          <button
            v-for="cat in categories" :key="cat"
            class="cat-tab" :class="{ active: activeCategory === cat }"
            @click="activeCategory = cat"
          >{{ cat }}</button>
        </div>
      </div>

      <div class="topbar-right">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input v-model="search" type="text" placeholder="Search items..." class="search-input" />
          <button v-if="search" class="search-clear" @click="search = ''">✕</button>
        </div>

        <div class="topbar-user">
          <div class="user-avatar">{{ auth.user?.name?.[0] || '?' }}</div>
          <div class="user-info">
            <span class="user-name">{{ auth.user?.name }}</span>
            <span class="user-role">{{ auth.user?.role }}</span>
          </div>
        </div>

        <span v-if="auth.deviceName" class="device-label">🏧 {{ auth.deviceName }}</span>
        <RC5000Status :deviceId="auth.deviceId" />

        <button v-if="auth.isManager" class="btn-icon" @click="$router.push('/manager')" title="Manager panel">⚙️</button>
        <button class="btn-icon" @click="handleLogout" title="Logout">🔓</button>
      </div>
    </header>

    <!-- ═══ MAIN ═══ -->
    <div class="main-area">
      <main class="product-area">

        <div v-if="loadingItems" class="loading-state">
          <div class="spinner-md"></div>
          <p>Loading products...</p>
        </div>

        <div v-else-if="filteredItems.length === 0" class="empty-state">
          <span>🔍</span>
          <p>No products found</p>
          <p class="empty-sub">{{ search ? 'Try a different search term' : 'No products in this category' }}</p>
        </div>

        <div v-else class="product-grid">
          <ProductCard v-for="item in filteredItems" :key="item.id" :product="item" @add="addToCart" />
        </div>
      </main>

      <CartPanel @checkout="openCheckout" @manual-amount="manualAmountOpen = true" />
    </div>

    <ManualAmountModal
      :visible="manualAmountOpen"
      @close="manualAmountOpen = false"
      @confirm="onManualAmountConfirm"
    />

    <CheckoutModal
      :visible="checkoutOpen"
      :refundMode="cart.isRefund"
      :total="cart.total"
      :cartItems="cart.items"
      @close="handleCheckoutClose"
      @success="handleCheckoutSuccess"
    />

    <transition name="toast">
      <div v-if="toast" class="toast" :class="toast.type">{{ toast.message }}</div>
    </transition>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ProductCard from '@/components/ProductCard.vue'
import CartPanel from '@/components/CartPanel.vue'
import CheckoutModal from '@/components/CheckoutModal.vue'
import RC5000Status from '@/components/RC5000Status.vue'
import ManualAmountModal from '@/components/ManualAmountModal.vue'
import { useCartStore } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import api from '@/api'

const router = useRouter()
const cart = useCartStore()
const auth = useAuthStore()
const theme = useThemeStore()

const items = ref([])
const loadingItems = ref(true)
const activeCategory = ref('')
const search = ref('')
const checkoutOpen = ref(false)
const manualAmountOpen = ref(false)
const toast = ref(null)
let toastTimer = null

const categories = computed(() => {
  const cats = new Set(items.value.map(i => i.category).filter(Boolean))
  return [...cats].sort()
})

const filteredItems = computed(() => {
  return items.value.filter(item => {
    const matchCat = !activeCategory.value || item.category === activeCategory.value
    const matchSearch = !search.value ||
      item.name.toLowerCase().includes(search.value.toLowerCase()) ||
      item.code.toLowerCase().includes(search.value.toLowerCase())
    return matchCat && matchSearch
  })
})

onMounted(async () => {
  await theme.loadFromServer()
  await loadItems()
  // Managers arriving at POS need a device too — auto-select default
  if (auth.isManager && !auth.hasDevice) {
    try {
      const res = await api.get('/devices')
      const configured = res.data.filter(d => d.ip && d.ip.trim() !== '')
      if (configured.length > 0) {
        const def = configured.find(d => d.isDefault) || configured[0]
        auth.selectDevice(def)
      }
    } catch {}
  }
})

function onManualAmountConfirm({ amount, reason }) {
  cart.addManualItem({ amount, reason })
}

async function loadItems() {
  loadingItems.value = true
  try {
    const res = await api.get('/items')
    items.value = res.data
  } catch {
    showToast('Failed to load products', 'error')
  } finally {
    loadingItems.value = false
  }
}

function addToCart(product) {
  cart.addItem(product)
  showToast(`${product.name} added to cart`, 'success')
}

function openCheckout() {
  if (cart.isEmpty) return
  checkoutOpen.value = true
}

function handleCheckoutClose(wasSuccess) {
  checkoutOpen.value = false
  if (wasSuccess) cart.clear()
}

function handleCheckoutSuccess(transaction) {
  console.log('Transaction saved:', transaction?.id)
}

async function handleLogout() {
  auth.logout()
  router.push('/login')
}

function showToast(message, type = 'info') {
  toast.value = { message, type }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = null }, 2500)
}
</script>

<style scoped>
.retail-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--color-bg);
}

/* ═══ TOP BAR ═══ */
.top-bar {
  align-items: center;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  box-shadow: 0 1px 0 rgba(0,196,179,0.08);
  display: flex;
  gap: 12px;
  height: 64px;
  padding: 0 16px;
  flex-shrink: 0;
  z-index: 10;
}

.topbar-left { align-items: center; display: flex; gap: 10px; min-width: 160px; }

.brand-logo {
  align-items: center;
  background: var(--color-primary-alpha);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  display: flex;
  font-size: 22px;
  height: 40px;
  justify-content: center;
  overflow: hidden;
  width: 40px;
}
.brand-logo img { width: 100%; height: 100%; object-fit: cover; }
.brand-info { display: flex; flex-direction: column; gap: 1px; }
.brand-name { font-size: 14px; font-weight: 700; }
.brand-sub { color: var(--color-text-3); font-size: 11px; }

.topbar-center { flex: 1; display: flex; justify-content: center; }

.category-tabs { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px; }

.cat-tab {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 20px;
  color: var(--color-text-2);
  cursor: pointer;
  font-family: var(--font-family);
  font-size: 13px;
  font-weight: 500;
  padding: 6px 16px;
  transition: all 0.15s;
  white-space: nowrap;
}
.cat-tab:hover { border-color: var(--color-primary); color: var(--color-primary); }
.cat-tab.active {
  background: var(--color-primary-alpha);
  border-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 600;
}

.topbar-right { align-items: center; display: flex; gap: 10px; }

.search-box {
  align-items: center;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  display: flex;
  gap: 6px;
  padding: 0 10px;
  transition: border-color 0.2s;
}
.search-box:focus-within { border-color: var(--color-primary); }
.search-icon { font-size: 14px; }
.search-input {
  background: none; border: none; color: var(--color-text);
  font-family: var(--font-family); font-size: 14px; outline: none;
  padding: 8px 0; width: 160px;
}
.search-input::placeholder { color: var(--color-text-3); }
.search-clear { background: none; border: none; color: var(--color-text-3); cursor: pointer; font-size: 12px; padding: 2px; }

.topbar-user { align-items: center; display: flex; gap: 8px; }
.user-avatar {
  align-items: center;
  background: var(--color-primary-alpha);
  border: 1px solid var(--color-primary);
  border-radius: 50%;
  color: var(--color-primary);
  display: flex;
  font-size: 14px;
  font-weight: 700;
  height: 36px;
  justify-content: center;
  width: 36px;
}
.user-info { display: flex; flex-direction: column; }
.user-name { font-size: 13px; font-weight: 600; }
.user-role { color: var(--color-text-3); font-size: 11px; text-transform: capitalize; }

.btn-icon {
  align-items: center;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  font-size: 18px;
  height: 40px;
  justify-content: center;
  transition: border-color 0.15s, background 0.15s;
  width: 40px;
}
.btn-icon:hover { background: var(--color-surface-3); border-color: var(--color-primary); }

/* ═══ MAIN ═══ */
.main-area { display: flex; flex: 1; overflow: hidden; }
.product-area { display: flex; flex: 1; flex-direction: column; overflow: hidden; }

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  overflow-y: auto;
  padding: 16px;
  align-content: start;
  flex: 1;
}

.loading-state,
.empty-state {
  align-items: center; display: flex; flex: 1; flex-direction: column;
  gap: 12px; justify-content: center; padding: 60px; text-align: center;
}
.empty-state span { font-size: 48px; opacity: 0.3; }
.empty-state p { color: var(--color-text-2); font-size: 16px; font-weight: 500; }
.empty-sub { color: var(--color-text-3); font-size: 14px; }

.spinner-md {
  width: 36px; height: 36px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ═══ TOAST ═══ */
.toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  background: var(--color-surface-3); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); box-shadow: var(--shadow-md);
  color: var(--color-text); font-size: 14px; font-weight: 500;
  padding: 12px 24px; z-index: 2000; white-space: nowrap;
}
.toast.success { background: var(--color-success-alpha); border-color: var(--color-success); color: var(--color-success); }
.toast.error { background: var(--color-danger-alpha); border-color: var(--color-danger); color: var(--color-danger); }

.toast-enter-active { transition: all 0.2s ease-out; }
.toast-leave-active { transition: all 0.2s ease-in; }
.toast-enter-from { opacity: 0; transform: translateX(-50%) translateY(10px); }
.toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(10px); }
.device-label {
  font-size: 12px;
  color: var(--color-text-3);
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 4px 10px;
  font-family: monospace;
}
</style>
