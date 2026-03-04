import { defineStore } from 'pinia'
import api from '@/api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user:     null,
    token:    localStorage.getItem('pos_token') || null,
    deviceId: localStorage.getItem('pos_device_id') || null,
    deviceName: localStorage.getItem('pos_device_name') || null
  }),

  getters: {
    isLoggedIn:    (state) => !!state.token,
    isManager:     (state) => state.user?.role === 'manager',
    isCashier:     (state) => state.user?.role === 'cashier' || state.user?.role === 'manager',
    hasDevice:     (state) => !!state.deviceId
  },

  actions: {
    async login(username, password) {
      const res = await api.post('/auth/login', { username, password })
      this.token = res.data.token
      this.user  = res.data.user
      localStorage.setItem('pos_token', this.token)
      return res.data.user
    },

    selectDevice(device) {
      this.deviceId   = device.id
      this.deviceName = device.name
      localStorage.setItem('pos_device_id',   device.id)
      localStorage.setItem('pos_device_name', device.name)
    },

    clearDevice() {
      this.deviceId   = null
      this.deviceName = null
      localStorage.removeItem('pos_device_id')
      localStorage.removeItem('pos_device_name')
    },

    async fetchMe() {
      if (!this.token) return
      try {
        const res = await api.get('/auth/me')
        this.user = res.data
      } catch {
        this.logout()
      }
    },

    logout() {
      this.token      = null
      this.user       = null
      this.deviceId   = null
      this.deviceName = null
      localStorage.removeItem('pos_token')
      localStorage.removeItem('pos_device_id')
      localStorage.removeItem('pos_device_name')
    }
  }
})
