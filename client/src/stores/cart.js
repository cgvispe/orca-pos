import { defineStore } from 'pinia'
import { useThemeStore } from './theme'

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [],      // { id, code, name, price, emoji, imageUrl, qty }
    isRefund: false // when true — payout mode
  }),

  getters: {
    total: (state) => state.items.reduce((sum, i) => sum + i.price * i.qty, 0),
    itemCount: (state) => state.items.reduce((sum, i) => sum + i.qty, 0),
    isEmpty: (state) => state.items.length === 0,

    // Signed total: negative in refund mode
    signedTotal(state) {
      const t = this.total
      return state.isRefund ? -Math.abs(t) : t
    },

    formattedTotal() {
      const theme = useThemeStore()
      return theme.formatCurrency(Math.abs(this.total))
    },

    formattedSignedTotal() {
      const theme = useThemeStore()
      return (this.isRefund ? '−' : '') + theme.formatCurrency(Math.abs(this.total))
    }
  },

  actions: {
    addItem(product) {
      const existing = this.items.find(i => i.id === product.id)
      if (existing) {
        existing.qty++
      } else {
        this.items.push({ ...product, qty: 1 })
      }
    },

    addManualItem({ amount, reason }) {
      // Add a one-off manual item with a unique id
      const id = 'manual-' + Date.now()
      this.items.push({
        id, code: 'MANUAL', emoji: '💵',
        name: reason || 'Manual amount',
        price: Math.abs(amount),
        qty: 1
      })
    },

    removeItem(id) {
      const idx = this.items.findIndex(i => i.id === id)
      if (idx !== -1) this.items.splice(idx, 1)
    },

    increaseQty(id) {
      const item = this.items.find(i => i.id === id)
      if (item) item.qty++
    },

    decreaseQty(id) {
      const item = this.items.find(i => i.id === id)
      if (!item) return
      if (item.qty <= 1) this.removeItem(id)
      else item.qty--
    },

    setRefund(val) { this.isRefund = val },

    clear() { this.items = []; this.isRefund = false }
  }
})
