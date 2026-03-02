<template>
  <div class="manager-layout">
    <header class="mgr-header">
      <div class="header-left">
        <button class="btn-back" @click="$router.push('/retail')">← Back to POS</button>
        <h1 class="mgr-title">⚙️ Manager Panel</h1>
      </div>
      <div class="header-right">
        <RC5000Status />
        <span class="user-chip">{{ auth.user?.name }} (Manager)</span>
      </div>
    </header>

    <div class="mgr-body">
      <nav class="mgr-nav">
        <button v-for="tab in tabs" :key="tab.id" class="nav-btn"
          :class="{ active: activeTab === tab.id }" @click="activeTab = tab.id">
          <span class="nav-icon">{{ tab.icon }}</span>
          <span>{{ tab.label }}</span>
        </button>
      </nav>

      <main class="mgr-content">

        <!-- ─── ITEMS ─── -->
        <div v-if="activeTab === 'items'">
          <div class="content-header">
            <h2>Product Catalog</h2>
            <button class="btn-primary" @click="openItemModal(null)">+ Add Item</button>
          </div>
          <div class="items-table-wrap">
            <table class="items-table">
              <thead><tr><th>Image</th><th>Code</th><th>Name</th><th>Category</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                <tr v-for="item in allItems" :key="item.id">
                  <td class="td-icon">
                    <img v-if="item.imageUrl" :src="item.imageUrl" class="item-thumb" />
                    <span v-else class="item-emoji-cell">{{ item.emoji || '🛍️' }}</span>
                  </td>
                  <td><code>{{ item.code }}</code></td>
                  <td>{{ item.name }}</td>
                  <td>{{ item.category }}</td>
                  <td class="td-price">{{ theme.formatCurrency(item.price) }}</td>
                  <td><span class="status-badge" :class="item.active ? 'active' : 'inactive'">{{ item.active ? 'Active' : 'Inactive' }}</span></td>
                  <td>
                    <div class="action-btns">
                      <button class="btn-sm" @click="openItemModal(item)">Edit</button>
                      <button class="btn-sm danger" @click="toggleItem(item)">{{ item.active ? 'Disable' : 'Enable' }}</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ─── CATEGORIES ─── -->
        <div v-else-if="activeTab === 'categories'">
          <div class="content-header"><h2>Product Categories</h2></div>
          <div class="categories-panel">
            <div class="category-list">
              <div v-for="cat in categories" :key="cat" class="category-row">
                <span class="cat-name">{{ cat }}</span>
                <button class="btn-sm danger" @click="deleteCategory(cat)">Delete</button>
              </div>
              <div v-if="categories.length === 0" class="empty-hint">No categories yet.</div>
            </div>
            <div class="add-category-row">
              <input v-model="newCategory" placeholder="New category name..." class="cat-input" @keyup.enter="addCategory" />
              <button class="btn-primary" @click="addCategory">Add</button>
            </div>
            <p class="hint-text">ℹ️ Deleting a category won't delete its items — they'll keep the category name but won't appear in the filter until recreated.</p>
          </div>
        </div>

        <!-- ─── USERS ─── -->
        <div v-else-if="activeTab === 'users'">
          <div class="content-header">
            <h2>Cashier Accounts</h2>
            <button class="btn-primary" @click="openUserModal(null)">+ Add Cashier</button>
          </div>
          <div class="items-table-wrap">
            <table class="items-table">
              <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Actions</th></tr></thead>
              <tbody>
                <tr v-for="user in cashiers" :key="user.id">
                  <td>{{ user.name }}</td>
                  <td><code>{{ user.username }}</code></td>
                  <td><span class="status-badge active">{{ user.role }}</span></td>
                  <td>
                    <div class="action-btns">
                      <button class="btn-sm" @click="openUserModal(user)">Edit</button>
                      <button class="btn-sm danger" @click="deleteUser(user)">Delete</button>
                    </div>
                  </td>
                </tr>
                <tr v-if="cashiers.length === 0">
                  <td colspan="4" class="empty-cell">No cashier accounts. Add one above.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ─── SETTINGS ─── -->
        <div v-else-if="activeTab === 'settings'">
          <div class="content-header">
            <h2>Store Settings</h2>
            <button class="btn-primary" @click="saveSettings" :disabled="savingSettings">{{ savingSettings ? 'Saving...' : 'Save Changes' }}</button>
          </div>
          <div class="settings-grid">

            <section class="settings-section">
              <h3>🏪 Business</h3>
              <div class="field">
                <label>Business Name</label>
                <input v-model="settings.businessName" type="text" />
              </div>
              <div class="field">
                <label>Store Logo</label>
                <div class="logo-upload-area">
                  <div class="logo-preview" @click="() => $refs.logoInputRef.click()">
                    <img v-if="logoPreview || settings.theme?.logoUrl" :src="logoPreview || settings.theme.logoUrl" alt="Logo" />
                    <span v-else class="logo-placeholder">🏪</span>
                    <div class="image-upload-overlay">📷</div>
                  </div>
                  <input ref="logoInputRef" type="file" accept="image/*" @change="handleLogoSelect" style="display:none" />
                  <div class="logo-upload-right">
                    <label class="btn-upload" @click="() => $refs.logoInputRef.click()">
                      {{ logoFile ? logoFile.name : 'Choose image...' }}
                    </label>
                    <button v-if="logoPreview || settings.theme?.logoUrl" class="btn-sm danger" @click="clearLogo">Remove logo</button>
                    <p class="upload-hint">PNG, JPG or SVG. Displayed at 80×80px.</p>
                  </div>
                </div>
              </div>
              <div class="field-row">
                <div class="field"><label>Currency Code</label><input v-model="settings.currency" placeholder="EUR" maxlength="3" /></div>
                <div class="field"><label>Symbol</label><input v-model="settings.currencySymbol" placeholder="€" maxlength="3" /></div>
                <div class="field"><label>Locale</label><input v-model="settings.locale" placeholder="es-ES" /></div>
              </div>
            </section>

            <section class="settings-section">
              <h3>🔌 RC5000 Connection</h3>
              <div class="field-row">
                <div class="field"><label>IP Address</label><input v-model="settings.sesami.ip" placeholder="192.168.1.100" /></div>
                <div class="field"><label>Port</label><input v-model="settings.sesami.port" placeholder="4443" /></div>
              </div>
              <div class="field-row">
                <div class="field"><label>POS ID</label><input v-model="settings.sesami.posId" placeholder="POS1" /></div>
                <div class="field"><label>Username</label><input v-model="settings.sesami.username" placeholder="DEMPOS" /></div>
              </div>
              <div class="field"><label>Secret Key</label><input v-model="settings.sesami.secretKey" type="password" placeholder="your-256-bit-secret" /></div>
              <div class="field-check"><label><input type="checkbox" v-model="settings.sesami.useHttps" /> Use HTTPS (port 4443)</label></div>
              <button class="btn-secondary" @click="testConnection">Test Connection</button>
              <p v-if="connectionStatus" class="connection-status" :class="connectionStatus.type">{{ connectionStatus.message }}</p>
            </section>

            <section class="settings-section">
              <h3>🎨 Theme</h3>
              <div class="field-row">
                <div class="field">
                  <label>Mode</label>
                  <select v-model="settings.theme.mode"><option value="dark">Dark</option><option value="light">Light</option></select>
                </div>
                <div class="field">
                  <label>Primary Color</label>
                  <div class="color-field">
                    <input type="color" v-model="settings.theme.primaryColor" class="color-picker" />
                    <input type="text" v-model="settings.theme.primaryColor" class="color-text" />
                  </div>
                </div>
              </div>
              <div class="field">
                <label>Font</label>
                <select v-model="settings.theme.fontFamily">
                  <option value="Inter">Inter</option>
                  <option value="Poppins">Poppins</option>
                  <option value="Roboto">Roboto</option>
                </select>
              </div>
            </section>
          </div>
        </div>

        <!-- ─── TRANSACTIONS ─── -->
        <div v-else-if="activeTab === 'transactions'">
          <div class="content-header">
            <h2>Transaction History</h2>
            <button class="btn-secondary" @click="loadTransactions">↻ Refresh</button>
          </div>
          <div v-if="transactions.length === 0" class="empty-state"><span>📋</span><p>No transactions yet</p></div>
          <div v-else class="tx-list">
            <div v-for="tx in transactions" :key="tx.id" class="tx-card">
              <div class="tx-header">
                <span class="tx-id">{{ tx.id.slice(0,8) }}...</span>
                <span class="tx-date">{{ formatDate(tx.date) }}</span>
                <span class="tx-status completed">{{ tx.status }}</span>
              </div>
              <div class="tx-body">
                <div><span class="tx-label">Total</span><span class="tx-total">{{ theme.formatCurrency(tx.total) }}</span></div>
                <div><span class="tx-label">Received</span><span>{{ theme.formatCurrency(tx.amountReceived) }}</span></div>
                <div v-if="tx.change"><span class="tx-label">Change</span><span>{{ theme.formatCurrency(tx.change) }}</span></div>
                <div><span class="tx-label">Cashier</span><span>{{ tx.cashier }}</span></div>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>

    <!-- ═══ ITEM MODAL ═══ -->
    <teleport to="body">
      <transition name="modal-fade">
        <div v-if="itemModal.open" class="modal-backdrop" @click.self="itemModal.open = false">
          <div class="modal-box-sm" @click.stop>
            <h2>{{ itemModal.item?.id ? 'Edit Item' : 'New Item' }}</h2>

            <div class="image-upload-section">
              <div class="image-preview-box" @click="() => $refs.imageInputRef.click()">
                <img v-if="itemModal.imagePreview || itemModal.form.imageUrl" :src="itemModal.imagePreview || itemModal.form.imageUrl" alt="Preview" />
                <div v-else class="image-upload-placeholder">
                  <span class="upload-emoji">{{ itemModal.form.emoji || '🛍️' }}</span>
                  <span class="upload-hint-text">Tap to upload image</span>
                </div>
                <div class="image-upload-overlay">📷 Change</div>
              </div>
              <input ref="imageInputRef" type="file" accept="image/*" @change="handleItemImageSelect" style="display:none" />
              <div class="image-right">
                <p class="upload-hint">Upload an image or use an emoji as fallback.</p>
                <div class="field">
                  <label>Emoji (fallback)</label>
                  <input v-model="itemModal.form.emoji" placeholder="☕" class="emoji-input" />
                </div>
                <button v-if="itemModal.imagePreview || itemModal.form.imageUrl" class="btn-sm danger" @click="clearItemImage">Remove image</button>
              </div>
            </div>

            <div class="field">
              <label>Code <span class="label-hint">{{ itemModal.item?.id ? "(editable)" : "(auto-generated, editable)" }}</span></label>
              <input v-model="itemModal.form.code" placeholder="COF001" class="code-input" />
            </div>
            <div class="field"><label>Name</label><input v-model="itemModal.form.name" placeholder="Espresso" /></div>
            <div class="field-row">
              <div class="field"><label>Price</label><input v-model="itemModal.form.price" type="number" step="0.01" placeholder="2.50" /></div>
              <div class="field">
                <label>Category</label>
                <select v-model="itemModal.form.category" @change="onCategoryChange">
                  <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
                  <option value="__new__">+ New category...</option>
                </select>
              </div>
            </div>
            <div v-if="itemModal.form.category === '__new__'" class="field">
              <label>New Category Name</label>
              <input v-model="itemModal.newCategoryName" placeholder="e.g. Beverages" />
            </div>

            <div class="modal-actions">
              <button class="btn-secondary" @click="itemModal.open = false">Cancel</button>
              <button class="btn-primary" @click="saveItem" :disabled="itemModal.saving">{{ itemModal.saving ? 'Saving...' : 'Save' }}</button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>

    <!-- ═══ USER MODAL ═══ -->
    <teleport to="body">
      <transition name="modal-fade">
        <div v-if="userModal.open" class="modal-backdrop" @click.self="userModal.open = false">
          <div class="modal-box-sm" @click.stop>
            <h2>{{ userModal.user?.id ? 'Edit Cashier' : 'New Cashier' }}</h2>
            <div class="field"><label>Full Name</label><input v-model="userModal.form.name" placeholder="John Doe" /></div>
            <div class="field"><label>Username</label><input v-model="userModal.form.username" placeholder="john.doe" :disabled="!!userModal.user?.id" /></div>
            <div class="field">
              <label>{{ userModal.user?.id ? 'New Password (leave blank to keep)' : 'Password' }}</label>
              <input v-model="userModal.form.password" type="password" placeholder="••••••••" />
            </div>
            <p v-if="userModal.error" class="field-error">{{ userModal.error }}</p>
            <div class="modal-actions">
              <button class="btn-secondary" @click="userModal.open = false">Cancel</button>
              <button class="btn-primary" @click="saveUser" :disabled="userModal.saving">{{ userModal.saving ? 'Saving...' : 'Save' }}</button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import RC5000Status from '@/components/RC5000Status.vue'
import api from '@/api'

const auth = useAuthStore()
const theme = useThemeStore()

const activeTab = ref('items')
const tabs = [
  { id: 'items',        icon: '🛍️', label: 'Products' },
  { id: 'categories',   icon: '🏷️', label: 'Categories' },
  { id: 'users',        icon: '👤', label: 'Cashiers' },
  { id: 'settings',     icon: '⚙️', label: 'Settings' },
  { id: 'transactions', icon: '📋', label: 'Transactions' }
]

// ── Items ──
const allItems = ref([])
async function loadAllItems() {
  try { const res = await api.get('/items/all'); allItems.value = res.data } catch {}
}

// ── Categories ──
const categories = ref([])
const newCategory = ref('')
async function loadCategories() {
  try { const res = await api.get('/categories'); categories.value = res.data } catch {}
}
async function addCategory() {
  if (!newCategory.value.trim()) return
  try {
    const res = await api.post('/categories', { name: newCategory.value.trim() })
    categories.value = res.data
    newCategory.value = ''
  } catch (e) { alert(e.response?.data?.error || 'Failed to add category') }
}
async function deleteCategory(name) {
  if (!confirm(`Delete category "${name}"?`)) return
  try { const res = await api.delete(`/categories/${encodeURIComponent(name)}`); categories.value = res.data } catch {}
}

// ── Settings ──
const settings = reactive({
  businessName: '', currency: 'EUR', currencySymbol: '€', locale: 'es-ES',
  sesami: { ip: '', port: '3000', posId: 'POS1', username: '', secretKey: '', useHttps: false },
  theme: { mode: 'dark', primaryColor: '#6366f1', fontFamily: 'Inter', logoUrl: null }
})
const savingSettings = ref(false)
const connectionStatus = ref(null)
const logoFile = ref(null)
const logoPreview = ref(null)

async function loadSettingsFull() {
  try {
    const res = await api.get('/settings')
    Object.assign(settings, res.data)
    if (!settings.sesami) settings.sesami = { ip: '', port: '4443', useHttps: true, posId: 'POS1', username: '', secretKey: '' }
    if (settings.theme && !settings.theme.logoUrl) { settings.theme.logoUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAwADgDASIAAhEBAxEB/8QAGwABAQEAAgMAAAAAAAAAAAAAAAcGBQgCAwn/xAA0EAAABQIBCAgGAwAAAAAAAAAAAQIDBAUGEQcIEhYYIVVzMTQ2OFNWk9GSlbGytNITYnH/xAAaAQABBQEAAAAAAAAAAAAAAAACAAEDBAUH/8QAKhEAAQQBAAYLAAAAAAAAAAAAAQACAwQRBQYSMUFxITIzNDVhcoGywdH/2gAMAwEAAhEDEQA/AO5YD0T5TMKG7LkGZNNJ0lGRYnh/g4XXKheM96KgbY3O3BVZ71au7ZleGnzOFoQGe1yoXjPeioZu+Ms9iWa3EXXJk1pMtS0tfxQ1uYmkiM8cC3dJBzE8DJCCLSNSZ4ZHICTwBCooCKbUOSTiVU+WO+wbUOSTiVU+WO+wDBV1WsBw1kXNSbxtaFctDcddp01KlMqcbNtRklRpPFJ7y3pMAyS87x7MT+Uf1EoFXvHsxP5R/USgaNPqHmufa3d6Z6fsoIbnadTtrmyPtQLkIbnadTtrmyPtQJp+zKzdXvEY/f4lQMAAZy6ivoRmm93u1eU/+Q6AZpvd7tXlP/kOgIjvRKlVWGioU5+EtakJeTompPSQzOocLiEn4U+w14A2SvYMNKo2tG1bbg+ZmSOjishqHC4hJ+FPsMblOyCUW+2qe3MuCpwyhKcUk2UNnpaZJI8cS/qLCAczyOGCVHBoilXkEkceHDn+rrRsgWv5yrvpM/qGyBa/nKu+kz+o7LgI9orSWbyZWjFsSxqbakOY/MYp6VpQ88REtektS9+ju6VYANIAZJf/2Q==' }
    // Apply default logo if none is set
    if (settings.theme && !settings.theme.logoUrl) {
      settings.theme.logoUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAwADgDASIAAhEBAxEB/8QAGwABAQEAAgMAAAAAAAAAAAAAAAcGBQgCAwn/xAA0EAAABQIBCAgGAwAAAAAAAAAAAQIDBAUGEQcIEhYYIVVzMTQ2OFNWk9GSlbGytNITYnH/xAAaAQABBQEAAAAAAAAAAAAAAAACAAEDBAUH/8QAKhEAAQQBAAYLAAAAAAAAAAAAAQACAwQRBQYSMUFxITIzNDVhcoGywdH/2gAMAwEAAhEDEQA/AO5YD0T5TMKG7LkGZNNJ0lGRYnh/g4XXKheM96KgbY3O3BVZ71au7ZleGnzOFoQGe1yoXjPeioZu+Ms9iWa3EXXJk1pMtS0tfxQ1uYmkiM8cC3dJBzE8DJCCLSNSZ4ZHICTwBCooCKbUOSTiVU+WO+wbUOSTiVU+WO+wDBV1WsBw1kXNSbxtaFctDcddp01KlMqcbNtRklRpPFJ7y3pMAyS87x7MT+Uf1EoFXvHsxP5R/USgaNPqHmufa3d6Z6fsoIbnadTtrmyPtQLkIbnadTtrmyPtQJp+zKzdXvEY/f4lQMAAZy6ivoRmm93u1eU/+Q6AZpvd7tXlP/kOgIjvRKlVWGioU5+EtakJeTompPSQzOocLiEn4U+w14A2SvYMNKo2tG1bbg+ZmSOjishqHC4hJ+FPsMblOyCUW+2qe3MuCpwyhKcUk2UNnpaZJI8cS/qLCAczyOGCVHBoilXkEkceHDn+rrRsgWv5yrvpM/qGyBa/nKu+kz+o7LgI9orSWbyZWjFsSxqbakOY/MYp6VpQ88REtektS9+ju6VYANIAZJf/2Q=='
    }
    if (!settings.theme) settings.theme = {}
    const sesamiRes = await api.get('/settings/sesami-full')
    settings.sesami.secretKey = sesamiRes.data.secretKey || ''
  } catch {}
}
function handleLogoSelect(e) {
  const file = e.target.files[0]; if (!file) return
  logoFile.value = file
  const reader = new FileReader()
  reader.onload = ev => { logoPreview.value = ev.target.result }
  reader.readAsDataURL(file)
}
function clearLogo() {
  logoFile.value = null; logoPreview.value = null
  if (settings.theme) settings.theme.logoUrl = null
}
async function saveSettings() {
  savingSettings.value = true
  try {
    const formData = new FormData()
    formData.append('data', JSON.stringify(settings))
    if (logoFile.value) formData.append('logo', logoFile.value)
    const res = await api.put('/settings', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    theme.businessName = settings.businessName; theme.currency = settings.currency
    theme.currencySymbol = settings.currencySymbol; theme.locale = settings.locale
    theme.mode = settings.theme.mode; theme.primaryColor = settings.theme.primaryColor
    theme.fontFamily = settings.theme.fontFamily
    if (res.data.theme?.logoUrl) theme.logoUrl = res.data.theme.logoUrl
    theme.apply(); logoFile.value = null; logoPreview.value = null
  } catch { alert('Failed to save settings') }
  finally { savingSettings.value = false }
}
async function testConnection() {
  connectionStatus.value = { type: 'testing', message: '⏳ Testing connection...' }
  try {
    const res = await api.post('/sesami/test-connection', {
      ip: settings.sesami.ip,
      port: settings.sesami.port,
      useHttps: settings.sesami.useHttps
    })
    const s = res.data.data?.status
    const labels = { 1:'Initializing', 2:'Ready', 4:'Session active', 5:'Processing', 11:'Waiting', 12:'Warning', 13:'Error' }
    const statusLabel = s !== undefined ? ` — Device status: ${labels[s] || s}` : ''
    connectionStatus.value = { type: 'ok', message: `✅ Connected${statusLabel}` }
  } catch (err) {
    const detail = err.response?.data?.error || err.response?.data?.detail || err.message || 'Unknown error'
    const code = err.response?.data?.code ? ` (${err.response.data.code})` : ''
    connectionStatus.value = { type: 'error', message: `❌ ${detail}${code}` }
  }
}

// ── Users ──
const cashiers = ref([])
async function loadUsers() {
  try { const res = await api.get('/users'); cashiers.value = res.data } catch {}
}
const userModal = reactive({ open: false, user: null, saving: false, error: '', form: { name: '', username: '', password: '' } })
function openUserModal(user) {
  userModal.user = user; userModal.error = ''
  userModal.form = user ? { name: user.name, username: user.username, password: '' } : { name: '', username: '', password: '' }
  userModal.open = true
}
async function saveUser() {
  userModal.error = ''; userModal.saving = true
  try {
    if (userModal.user?.id) { await api.put(`/users/${userModal.user.id}`, userModal.form) }
    else {
      if (!userModal.form.password) { userModal.error = 'Password is required'; userModal.saving = false; return }
      await api.post('/users', userModal.form)
    }
    userModal.open = false; await loadUsers()
  } catch (e) { userModal.error = e.response?.data?.error || 'Failed to save user' }
  finally { userModal.saving = false }
}
async function deleteUser(user) {
  if (!confirm(`Delete cashier "${user.name}"?`)) return
  try { await api.delete(`/users/${user.id}`); await loadUsers() } catch {}
}

// ── Item modal ──
const imageInputRef = ref(null)
const itemModal = reactive({
  open: false, item: null, saving: false, imagePreview: null, imageFile: null, newCategoryName: '',
  form: { code: '', name: '', price: '', category: '', emoji: '', imageUrl: null }
})
function generateCode(category, excludeId = null) {
  if (!category || category === '__new__') return ''
  const prefix = category.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3).padEnd(3, 'X')
  // Exclude the item being edited from the count to avoid inflating the number
  const existing = allItems.value.filter(i => i.category === category && i.id !== excludeId)
  const num = String(existing.length + 1).padStart(3, '0')
  return `${prefix}${num}`
}

function onCategoryChange() {
  // Always regenerate code when category changes — both new items and reclassifications
  itemModal.form.code = generateCode(itemModal.form.category, itemModal.item?.id || null)
}

function openItemModal(item) {
  itemModal.item = item; itemModal.imagePreview = null; itemModal.imageFile = null; itemModal.newCategoryName = ''
  const defaultCat = categories.value[0] || ''
  itemModal.form = item
    ? { code: item.code, name: item.name, price: item.price, category: item.category, emoji: item.emoji || '', imageUrl: item.imageUrl }
    : { code: generateCode(defaultCat), name: '', price: '', category: defaultCat, emoji: '', imageUrl: null }
  itemModal.open = true
}
function handleItemImageSelect(e) {
  const file = e.target.files[0]; if (!file) return
  itemModal.imageFile = file
  const reader = new FileReader()
  reader.onload = ev => { itemModal.imagePreview = ev.target.result }
  reader.readAsDataURL(file)
}
function clearItemImage() {
  itemModal.imageFile = null; itemModal.imagePreview = null; itemModal.form.imageUrl = null
  if (imageInputRef.value) imageInputRef.value.value = ''
}
async function saveItem() {
  itemModal.saving = true
  try {
    let category = itemModal.form.category
    if (category === '__new__') {
      const newCat = itemModal.newCategoryName.trim()
      if (!newCat) { alert('Enter a category name'); itemModal.saving = false; return }
      await api.post('/categories', { name: newCat }); await loadCategories(); category = newCat
    }
    const formData = new FormData()
    formData.append('code', itemModal.form.code); formData.append('name', itemModal.form.name)
    formData.append('price', itemModal.form.price); formData.append('category', category)
    formData.append('emoji', itemModal.form.emoji)
    if (!itemModal.form.imageUrl && !itemModal.imageFile) formData.append('clearImage', 'true')
    if (itemModal.imageFile) formData.append('image', itemModal.imageFile)
    if (itemModal.item?.id) {
      await api.put(`/items/${itemModal.item.id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    } else {
      await api.post('/items', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    }
    itemModal.open = false; await loadAllItems()
  } catch { alert('Failed to save item') }
  finally { itemModal.saving = false }
}
async function toggleItem(item) {
  try {
    if (item.active) { await api.delete(`/items/${item.id}`) }
    else { await api.put(`/items/${item.id}`, { active: 'true' }) }
    await loadAllItems()
  } catch {}
}

// ── Transactions ──
const transactions = ref([])
async function loadTransactions() {
  try { const res = await api.get('/sesami/transactions'); transactions.value = res.data } catch {}
}

function formatDate(d) { return new Date(d).toLocaleString() }

onMounted(async () => {
  await Promise.all([loadAllItems(), loadCategories(), loadSettingsFull(), loadUsers(), loadTransactions()])
})
</script>

<style scoped>
.manager-layout { display: flex; flex-direction: column; height: 100vh; background: var(--color-bg); }
.mgr-header { align-items: center; background: var(--color-surface); border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; padding: 0 20px; height: 60px; flex-shrink: 0; }
.header-left { align-items: center; display: flex; gap: 16px; }
.header-right { align-items: center; display: flex; gap: 12px; }
.btn-back { background: none; border: 1px solid var(--color-border); border-radius: var(--radius-sm); color: var(--color-text-2); cursor: pointer; font-size: 13px; padding: 6px 14px; transition: all 0.15s; }
.btn-back:hover { border-color: var(--color-primary); color: var(--color-primary); }
.mgr-title { font-size: 18px; font-weight: 700; }
.user-chip { background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: 20px; font-size: 13px; color: var(--color-text-2); padding: 6px 14px; }
.mgr-body { display: flex; flex: 1; overflow: hidden; }
.mgr-nav { background: var(--color-surface); border-right: 1px solid var(--color-border); display: flex; flex-direction: column; padding: 12px 8px; width: 180px; flex-shrink: 0; gap: 4px; }
.nav-btn { align-items: center; background: none; border: none; border-left: 3px solid transparent; border-radius: var(--radius-sm); color: var(--color-text-2); cursor: pointer; display: flex; font-family: var(--font-family); font-size: 14px; font-weight: 500; gap: 10px; padding: 12px 14px; transition: all 0.15s; text-align: left; width: 100%; }
.nav-btn:hover { background: var(--color-surface-2); color: var(--color-text); }
.nav-btn.active { background: var(--color-primary-alpha); color: var(--color-primary); font-weight: 600; border-left: 3px solid var(--color-primary); padding-left: 11px; }
.nav-icon { font-size: 18px; }
.mgr-content { flex: 1; overflow-y: auto; padding: 24px; }
.content-header { align-items: center; display: flex; justify-content: space-between; margin-bottom: 20px; }
.content-header h2 { font-size: 20px; font-weight: 700; }
.items-table-wrap { overflow-x: auto; }
.items-table { border-collapse: collapse; width: 100%; }
.items-table th { background: var(--color-surface-2); border-bottom: 1px solid var(--color-border); color: var(--color-text-2); font-size: 12px; font-weight: 600; padding: 12px 14px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; }
.items-table td { border-bottom: 1px solid var(--color-border); font-size: 14px; padding: 10px 14px; vertical-align: middle; }
.items-table tr:hover td { background: var(--color-surface-2); }
.td-icon { width: 52px; text-align: center; }
.item-thumb { border-radius: 6px; height: 40px; object-fit: cover; width: 40px; }
.item-emoji-cell { font-size: 24px; }
.td-price { font-weight: 600; color: var(--color-primary); }
.status-badge { border-radius: 20px; font-size: 12px; font-weight: 600; padding: 4px 10px; }
.status-badge.active { background: var(--color-success-alpha); color: var(--color-success); }
.status-badge.inactive { background: var(--color-danger-alpha); color: var(--color-danger); }
.action-btns { display: flex; gap: 6px; }
.btn-sm { background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-sm); color: var(--color-text-2); cursor: pointer; font-size: 12px; padding: 6px 12px; transition: all 0.15s; white-space: nowrap; }
.btn-sm:hover { border-color: var(--color-primary); color: var(--color-primary); }
.btn-sm.danger:hover { border-color: var(--color-danger); color: var(--color-danger); }
.empty-cell { color: var(--color-text-3); font-size: 14px; text-align: center; padding: 24px; }
.categories-panel { max-width: 480px; display: flex; flex-direction: column; gap: 16px; }
.category-list { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; }
.category-row { align-items: center; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; padding: 12px 16px; }
.category-row:last-child { border-bottom: none; }
.cat-name { font-size: 14px; font-weight: 500; }
.add-category-row { display: flex; gap: 10px; }
.cat-input { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm); color: var(--color-text); flex: 1; font-family: var(--font-family); font-size: 14px; outline: none; padding: 10px 14px; transition: border-color 0.2s; }
.cat-input:focus { border-color: var(--color-primary); }
.empty-hint { color: var(--color-text-3); font-size: 14px; padding: 20px 16px; text-align: center; }
.hint-text { color: var(--color-text-3); font-size: 12px; line-height: 1.5; }
.settings-grid { display: flex; flex-direction: column; gap: 24px; max-width: 720px; }
.settings-section { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 20px 24px; display: flex; flex-direction: column; gap: 14px; }
.settings-section h3 { font-size: 15px; font-weight: 700; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field label { color: var(--color-text-2); font-size: 13px; font-weight: 500; }
.field input, .field select { background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-sm); color: var(--color-text); font-family: var(--font-family); font-size: 14px; outline: none; padding: 10px 12px; transition: border-color 0.2s; }
.field input:focus, .field select:focus { border-color: var(--color-primary); }
.field input:disabled { opacity: 0.5; cursor: not-allowed; }
.field-row { display: flex; gap: 12px; }
.field-row .field { flex: 1; }
.field-check label { align-items: center; color: var(--color-text-2); cursor: pointer; display: flex; font-size: 14px; gap: 8px; }
.color-field { display: flex; gap: 8px; align-items: center; }
.color-picker { border: 1px solid var(--color-border); border-radius: var(--radius-sm); cursor: pointer; height: 38px; padding: 2px; width: 52px; }
.color-text { flex: 1; }
.connection-status { font-size: 13px; padding: 8px 12px; border-radius: var(--radius-sm); }
.connection-status.ok { background: var(--color-success-alpha); color: var(--color-success); }
.connection-status.testing { background: var(--color-primary-alpha); color: var(--color-primary); }
.connection-status.error { background: var(--color-danger-alpha); color: var(--color-danger); }
.logo-upload-area { display: flex; gap: 16px; align-items: flex-start; }
.logo-preview { width: 80px; height: 80px; border: 2px dashed var(--color-border); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; background: var(--color-surface-2); cursor: pointer; transition: border-color 0.2s; position: relative; }
.logo-preview:hover { border-color: var(--color-primary); }
.logo-preview img { width: 100%; height: 100%; object-fit: cover; }
.logo-placeholder { font-size: 36px; }
.logo-upload-right { display: flex; flex-direction: column; gap: 8px; }
.btn-upload { background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-sm); color: var(--color-text-2); cursor: pointer; display: inline-block; font-family: var(--font-family); font-size: 13px; padding: 8px 14px; transition: all 0.15s; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.btn-upload:hover { border-color: var(--color-primary); color: var(--color-primary); }
.upload-hint { color: var(--color-text-3); font-size: 12px; line-height: 1.4; }
.tx-list { display: flex; flex-direction: column; gap: 10px; }
.tx-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 14px 16px; }
.tx-header { align-items: center; display: flex; gap: 12px; margin-bottom: 10px; }
.tx-id { color: var(--color-text-3); font-family: monospace; font-size: 12px; }
.tx-date { color: var(--color-text-2); font-size: 13px; flex: 1; }
.tx-status { border-radius: 20px; font-size: 12px; font-weight: 600; padding: 3px 10px; }
.tx-status.completed { background: var(--color-success-alpha); color: var(--color-success); }
.tx-body { display: flex; gap: 24px; flex-wrap: wrap; font-size: 14px; }
.tx-label { color: var(--color-text-3); margin-right: 4px; }
.tx-total { color: var(--color-primary); font-weight: 700; }
.empty-state { align-items: center; display: flex; flex-direction: column; gap: 12px; justify-content: center; padding: 60px; text-align: center; }
.empty-state span { font-size: 48px; opacity: 0.3; }
.empty-state p { color: var(--color-text-2); font-size: 15px; }
.btn-primary { background: var(--color-primary); border: none; border-radius: var(--radius-sm); color: white; cursor: pointer; font-family: var(--font-family); font-size: 14px; font-weight: 600; padding: 10px 20px; transition: opacity 0.2s; white-space: nowrap; }
.btn-primary:hover:not(:disabled) { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-secondary { background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-sm); color: var(--color-text-2); cursor: pointer; font-family: var(--font-family); font-size: 14px; font-weight: 500; padding: 10px 20px; transition: all 0.15s; }
.btn-secondary:hover { border-color: var(--color-primary); color: var(--color-primary); }
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 24px; }
.modal-box-sm { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-xl); box-shadow: var(--shadow-lg); display: flex; flex-direction: column; gap: 14px; max-width: 480px; padding: 28px 32px; width: 100%; max-height: 90vh; overflow-y: auto; }
.modal-box-sm h2 { font-size: 18px; font-weight: 700; }
.modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 4px; }
.modal-fade-enter-active { transition: all 0.25s ease-out; }
.modal-fade-leave-active { transition: all 0.2s ease-in; }
.modal-fade-enter-from { opacity: 0; transform: scale(0.95); }
.modal-fade-leave-to { opacity: 0; transform: scale(0.97); }
.image-upload-section { display: flex; gap: 16px; align-items: flex-start; background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 14px; }
.image-preview-box { position: relative; width: 100px; height: 100px; border-radius: var(--radius-md); overflow: hidden; cursor: pointer; background: var(--color-surface-3); flex-shrink: 0; }
.image-preview-box img { width: 100%; height: 100%; object-fit: cover; }
.image-upload-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 4px; }
.upload-emoji { font-size: 36px; }
.upload-hint-text { font-size: 10px; color: var(--color-text-3); text-align: center; line-height: 1.3; padding: 0 6px; }
.image-upload-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.55); color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; opacity: 0; transition: opacity 0.2s; }
.image-preview-box:hover .image-upload-overlay { opacity: 1; }
.image-right { display: flex; flex-direction: column; gap: 8px; flex: 1; }
.emoji-input { font-size: 20px; text-align: center; }
.field-error { color: var(--color-danger); font-size: 13px; background: var(--color-danger-alpha); padding: 8px 12px; border-radius: var(--radius-sm); }
.label-hint { color: var(--color-text-3); font-size: 11px; font-weight: 400; margin-left: 4px; }
.code-input { font-family: monospace; letter-spacing: 0.05em; }
</style>
