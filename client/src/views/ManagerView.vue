<template>
  <div class="manager-layout">
    <header class="mgr-header">
      <div class="header-left">
        <button class="btn-back" @click="$router.push('/retail')">← Back to POS</button>
        <h1 class="mgr-title">⚙️ Manager Panel</h1>
      </div>
      <div class="header-right">
        <RC5000Status v-if="devices.length" :deviceId="devices[0].id" />
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
                  <td><span v-if="user.canRefund" class="badge-refund">✓ Allowed</span><span v-else class="badge-no-refund">—</span></td>
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

        <!-- ─── DEVICES ─── -->
        <div v-else-if="activeTab === 'devices'">
          <div class="content-header">
            <h2>RC5000 Devices</h2>
            <button class="btn-primary" @click="openDeviceModal(null)">+ Add Device</button>
          </div>
          <div v-if="devices.length === 0" class="empty-state"><span>🏧</span><p>No devices configured yet</p></div>
          <div v-else class="items-table-wrap">
            <table class="items-table">
              <thead><tr><th>Name</th><th>IP</th><th>Port</th><th>POS ID</th><th>HTTPS</th><th>Default</th><th>Actions</th></tr></thead>
              <tbody>
                <tr v-for="d in devices" :key="d.id" :class="{ inactive: !d.active }">
                  <td><strong>{{ d.name }}</strong></td>
                  <td><code>{{ d.ip }}</code></td>
                  <td>{{ d.port }}</td>
                  <td>{{ d.posId }}</td>
                  <td>{{ d.useHttps ? '🔒 Yes' : 'No' }}</td>
                  <td>
                    <span v-if="d.isDefault" class="badge-default">Default</span>
                    <button v-else class="btn-sm" @click="setDefault(d.id)">Set Default</button>
                  </td>
                  <td class="action-cell">
                    <button class="btn-sm" @click="openDeviceModal(d)">Edit</button>
                    <button class="btn-sm danger" @click="deleteDevice(d.id)">Delete</button>
                    <button class="btn-sm warning" @click="resetModal.device=d; resetModal.token=''; resetModal.result=''; resetModal.open=true" title="Force Reset Session">🔄 Reset</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ─── TRANSACTIONS ─── -->
        <div v-else-if="activeTab === 'transactions'" class="tx-section">

          <!-- Filters bar -->
          <div class="tx-filters">

            <!-- Date picker with calendar -->
            <div class="filter-group">
              <label>Date</label>
              <div class="date-picker-wrap" v-click-outside="() => txDropdowns.datePicker = false">
                <div class="date-picker-trigger" @click="txDropdowns.datePicker = !txDropdowns.datePicker">
                  <span class="dp-icon">📅</span>
                  <span>{{ txFilters.date || 'All dates' }}</span>
                  <span v-if="txFilters.date" class="dp-clear" @click.stop="txFilters.date = ''; loadTransactions(1)">✕</span>
                  <span v-else class="multi-select-arrow">▾</span>
                </div>
                <div v-if="txDropdowns.datePicker" class="date-calendar">
                  <div class="cal-header">
                    <button @click="calPrevMonth">‹</button>
                    <span>{{ calMonthLabel }}</span>
                    <button @click="calNextMonth">›</button>
                  </div>
                  <div class="cal-weekdays">
                    <span v-for="d in ['Mo','Tu','We','Th','Fr','Sa','Su']" :key="d">{{ d }}</span>
                  </div>
                  <div class="cal-days">
                    <span v-for="blank in calBlanks" :key="'b'+blank" class="cal-day empty"></span>
                    <span
                      v-for="day in calDays" :key="day.iso"
                      class="cal-day"
                      :class="{ selected: txFilters.date === day.iso, today: day.isToday }"
                      @click="txFilters.date = day.iso; txDropdowns.datePicker = false; loadTransactions(1)"
                    >{{ day.d }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Operation type multi-select -->
            <div class="filter-group">
              <label>Operation</label>
              <div class="multi-select" :class="{ open: txDropdowns.opType }" v-click-outside="() => txDropdowns.opType = false">
                <div class="multi-select-trigger" @click="txDropdowns.opType = !txDropdowns.opType">
                  <span v-if="txFilters.operationTypes.length === 0">All</span>
                  <span v-else>{{ txFilters.operationTypes.length }} selected</span>
                  <span class="multi-select-arrow">▾</span>
                </div>
                <div class="multi-select-dropdown">
                  <label v-for="opt in operationTypeOptions" :key="opt.value" class="multi-select-option">
                    <input type="checkbox" :value="opt.value" v-model="txFilters.operationTypes" @change="loadTransactions(1)" />
                    {{ opt.label }}
                  </label>
                </div>
              </div>
            </div>

            <!-- Source: RC5000 / Manual -->
            <div class="filter-group">
              <label>Source</label>
              <select v-model="txFilters.isManual" @change="loadTransactions(1)" style="min-width:130px">
                <option v-for="o in isManualOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </div>

            <!-- User multi-select -->
            <div class="filter-group">
              <label>User</label>
              <div class="multi-select" :class="{ open: txDropdowns.cashier }" v-click-outside="() => txDropdowns.cashier = false">
                <div class="multi-select-trigger" @click="txDropdowns.cashier = !txDropdowns.cashier">
                  <span v-if="txFilters.cashierIds.length === 0">All</span>
                  <span v-else>{{ txFilters.cashierIds.length }} selected</span>
                  <span class="multi-select-arrow">▾</span>
                </div>
                <div class="multi-select-dropdown">
                  <label v-for="u in cashiers" :key="u.id" class="multi-select-option">
                    <input type="checkbox" :value="u.id" v-model="txFilters.cashierIds" @change="loadTransactions(1)" />
                    <span>{{ u.name }}</span><span class="user-role-badge">{{ u.role }}</span>
                  </label>
                </div>
              </div>
            </div>

            <!-- RC Status multi-select -->
            <div class="filter-group">
              <label>RC Status</label>
              <div class="multi-select" :class="{ open: txDropdowns.rcStatus }" v-click-outside="() => txDropdowns.rcStatus = false">
                <div class="multi-select-trigger" @click="txDropdowns.rcStatus = !txDropdowns.rcStatus">
                  <span v-if="txFilters.rcStatuses.length === 0">All</span>
                  <span v-else>{{ txFilters.rcStatuses.length }} selected</span>
                  <span class="multi-select-arrow">▾</span>
                </div>
                <div class="multi-select-dropdown">
                  <label v-for="opt in rcStatusOptions" :key="opt.value" class="multi-select-option">
                    <input type="checkbox" :value="opt.value" v-model="txFilters.rcStatuses" @change="loadTransactions(1)" />
                    <span class="tx-badge" :class="opt.cls">{{ opt.label }}</span>
                  </label>
                </div>
              </div>
            </div>

            <div class="filter-actions">
              <button class="btn-secondary btn-sm" @click="clearTxFilters">✕ Clear</button>
              <button class="btn-secondary btn-sm" @click="loadTransactions(1)">↻ Refresh</button>
              <button class="btn-primary btn-sm" @click="exportExcel">⬇ Export Excel</button>
            </div>
          </div>

          <!-- Summary row -->
          <div class="tx-summary" v-if="txMeta.total > 0">
            <span>{{ txMeta.total }} transaction{{ txMeta.total !== 1 ? 's' : '' }}</span>
            <span>Page {{ txMeta.page }} of {{ txMeta.pages }}</span>
          </div>

          <!-- Table -->
          <div v-if="transactions.length === 0" class="empty-state"><span>📋</span><p>No transactions found</p></div>
          <div v-else class="tx-table-wrap">
            <table class="tx-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>ID</th>
                  <th>Cashier</th>
                  <th>Device</th>
                  <th>Operation</th>
                  <th>Source</th>
                  <th>RC Status</th>
                  <th class="num">Total In</th>
                  <th class="num">Total Out</th>
                  <th class="num">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="tx in transactions" :key="tx.id" :class="'tx-row-' + tx.status">
                  <td class="tx-date-cell">{{ formatDate(tx.date) }}</td>
                  <td class="tx-id-cell"><code>{{ tx.id.slice(0,8) }}</code></td>
                  <td>{{ tx.cashierName }}</td>
                  <td>{{ tx.deviceName || '—' }}</td>
                  <td><span class="tx-badge op" :class="'op-' + tx.operationType">{{ opTypeLabel(tx.operationType) }}</span></td>
                  <td><span class="tx-badge" :class="tx.isManual ? 'manual' : 'auto'">{{ tx.isManual ? '💵 Manual' : '🏧 RC5000' }}</span></td>
                  <td><span v-if="tx.rcStatus" class="tx-badge" :class="rcStatusClass(tx.rcStatus)">{{ rcStatusLabel(tx.rcStatus) }}</span><span v-else>—</span></td>
                  <td class="num">{{ tx.totalIn  ? theme.formatCurrency(tx.totalIn)  : '—' }}</td>
                  <td class="num">{{ tx.totalOut ? theme.formatCurrency(tx.totalOut) : '—' }}</td>
                  <td class="num" :class="{ 'neg': tx.total < 0 }">{{ theme.formatCurrency(tx.total) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div class="tx-pagination" v-if="txMeta.pages > 1">
            <button :disabled="txMeta.page <= 1" @click="loadTransactions(txMeta.page - 1)">‹ Prev</button>
            <span v-for="p in txMeta.pages" :key="p">
              <button :class="{ active: p === txMeta.page }" @click="loadTransactions(p)">{{ p }}</button>
            </span>
            <button :disabled="txMeta.page >= txMeta.pages" @click="loadTransactions(txMeta.page + 1)">Next ›</button>
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
            <div class="field-check refund-perm">
              <label>
                <input type="checkbox" v-model="userModal.form.canRefund" />
                Allow this cashier to process refunds
              </label>
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

    <!-- ═══ DEVICE MODAL ═══ -->
    <teleport to="body">
      <transition name="modal-fade">
        <div v-if="deviceModal.open" class="modal-backdrop" @click.self="deviceModal.open = false">
          <div class="modal-box-sm" @click.stop>
            <h2>{{ deviceModal.device?.id ? 'Edit Device' : 'New RC5000 Device' }}</h2>
            <div class="field"><label>Device Name</label><input v-model="deviceModal.form.name" placeholder="RC5000 - Caja 1" /></div>
            <div class="field-row">
              <div class="field"><label>IP Address</label><input v-model="deviceModal.form.ip" placeholder="192.168.1.100" /></div>
              <div class="field"><label>Port</label><input v-model="deviceModal.form.port" placeholder="4443" /></div>
            </div>
            <div class="field-row">
              <div class="field"><label>POS ID</label><input v-model="deviceModal.form.posId" placeholder="POS1" /></div>
              <div class="field"><label>Username</label><input v-model="deviceModal.form.username" placeholder="DEMPOS" /></div>
            </div>
            <div class="field"><label>Secret Key</label><input v-model="deviceModal.form.secretKey" type="password" placeholder="your-256-bit-secret" /></div>
            <div class="field-check"><label><input type="checkbox" v-model="deviceModal.form.useHttps" /> Use HTTPS (port 4443)</label></div>
            <div class="field-check"><label><input type="checkbox" v-model="deviceModal.form.isDefault" /> Set as default device</label></div>
            <div class="device-test-row">
              <button class="btn-secondary" @click="testDeviceConnection">Test Connection</button>
              <p v-if="deviceModal.connectionStatus" class="connection-status" :class="deviceModal.connectionStatus.type">{{ deviceModal.connectionStatus.message }}</p>
            </div>
            <div v-if="deviceModal.error" class="field-error">{{ deviceModal.error }}</div>
            <div class="modal-actions">
              <button class="btn-secondary" @click="deviceModal.open = false">Cancel</button>
              <button class="btn-primary" @click="saveDevice" :disabled="deviceModal.saving">{{ deviceModal.saving ? 'Saving...' : 'Save' }}</button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>

    <!-- Force Reset Modal -->
    <teleport to="body">
      <transition name="modal-fade">
        <div v-if="resetModal.open" class="modal-backdrop" @click.self="resetModal.open=false">
          <div class="modal-card" style="max-width:420px">
            <h2>⚠️ Force Reset: {{ resetModal.device?.name }}</h2>
            <p class="field-hint">Clears the stuck RC5000 session. Paste the bearer token if available to also cancel any active operation on the device.</p>
            <div class="field">
              <label>Bearer Token (optional)</label>
              <input v-model="resetModal.token" placeholder="Paste bearer token if available" />
            </div>
            <p v-if="resetModal.result" class="field-hint" style="color:var(--color-primary); word-break:break-all">{{ resetModal.result }}</p>
            <div class="modal-actions">
              <button class="btn-secondary" @click="resetModal.open=false">Cancel</button>
              <button class="btn-danger" @click="forceResetDevice" :disabled="resetModal.working">
                {{ resetModal.working ? 'Resetting...' : 'Force Reset' }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

const vClickOutside = {
  mounted(el, binding) {
    el._clickOutside = (e) => { if (!el.contains(e.target)) binding.value(e) }
    document.addEventListener('mousedown', el._clickOutside)
  },
  unmounted(el) { document.removeEventListener('mousedown', el._clickOutside) }
}
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
  { id: 'devices',      icon: '🏧', label: 'Devices' },
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
  theme: { mode: 'dark', primaryColor: '#00c4b3', fontFamily: 'Inter', logoUrl: null }
})
const savingSettings = ref(false)
const logoFile = ref(null)
const logoPreview = ref(null)

async function loadSettingsFull() {
  try {
    const res = await api.get('/settings')
    Object.assign(settings, res.data)
    if (!settings.theme) settings.theme = {}
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

// ── Devices ──
const devices = ref([])
async function forceResetDevice() {
  resetModal.working = true
  try {
    const res = await api.post(`/sesami/force-reset/${resetModal.device.id}`, { bearerToken: resetModal.token || undefined })
    resetModal.result = `Done: ${JSON.stringify(res.data.results)}`
  } catch (e) {
    resetModal.result = 'Error: ' + (e.response?.data?.error || e.message)
  }
  resetModal.working = false
}

async function loadDevices() {
  try { const res = await api.get('/devices/full'); devices.value = res.data } catch {}
}
const deviceModal = reactive({
  open: false, device: null, saving: false, error: '', connectionStatus: null,
  form: { name: '', ip: '', port: '4443', useHttps: true, posId: 'POS1', username: '', secretKey: '', isDefault: false }
})
function openDeviceModal(device) {
  deviceModal.device = device; deviceModal.error = ''; deviceModal.connectionStatus = null
  deviceModal.form = device
    ? { name: device.name, ip: device.ip, port: device.port, useHttps: device.useHttps,
        posId: device.posId, username: device.username, secretKey: device.secretKey, isDefault: device.isDefault }
    : { name: '', ip: '', port: '4443', useHttps: true, posId: 'POS1', username: '', secretKey: '', isDefault: false }
  deviceModal.open = true
}
async function saveDevice() {
  deviceModal.saving = true; deviceModal.error = ''
  try {
    if (deviceModal.device?.id) {
      await api.put(`/devices/${deviceModal.device.id}`, deviceModal.form)
    } else {
      await api.post('/devices', deviceModal.form)
    }
    deviceModal.open = false; await loadDevices()
  } catch (err) {
    deviceModal.error = err.response?.data?.error || 'Failed to save device'
  } finally { deviceModal.saving = false }
}
async function deleteDevice(id) {
  if (!confirm('Delete this device?')) return
  try { await api.delete(`/devices/${id}`); await loadDevices() } catch {}
}
async function setDefault(id) {
  try { await api.put(`/devices/${id}/set-default`); await loadDevices() } catch {}
}
async function testDeviceConnection() {
  deviceModal.connectionStatus = { type: 'testing', message: '⏳ Testing connection...' }
  try {
    const res = await api.post('/sesami/test-connection', {
      ip: deviceModal.form.ip, port: deviceModal.form.port, useHttps: deviceModal.form.useHttps
    })
    const s = res.data.data?.status
    const labels = { 1:'Initializing', 2:'Ready', 4:'Session active', 5:'Processing', 11:'Waiting', 12:'Warning', 13:'Error' }
    const statusLabel = s !== undefined ? ` — Device status: \${labels[s] || s}` : ''
    deviceModal.connectionStatus = { type: 'ok', message: `✅ Connected\${statusLabel}` }
  } catch (err) {
    const detail = err.response?.data?.error || err.message || 'Unknown error'
    const code = err.response?.data?.code ? ` (\${err.response.data.code})` : ''
    deviceModal.connectionStatus = { type: 'error', message: `❌ \${detail}\${code}` }
  }
}

// ── Users ──
const cashiers = ref([])
async function loadUsers() {
  try { const res = await api.get('/users'); cashiers.value = res.data } catch {}
}
const resetModal = reactive({ open: false, device: null, token: '', working: false, result: '' })

const userModal = reactive({ open: false, user: null, saving: false, error: '', form: { name: '', username: '', password: '', canRefund: false } })
function openUserModal(user) {
  userModal.user = user; userModal.error = ''
  userModal.form = user ? { name: user.name, username: user.username, password: '', canRefund: !!user.canRefund } : { name: '', username: '', password: '', canRefund: false }
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
const txMeta = ref({ total: 0, page: 1, pages: 1, limit: 100 })
const txFilters = reactive({ date: '', cashierIds: [], operationTypes: [], rcStatuses: [], isManual: '' })
const txDropdowns = reactive({ opType: false, cashier: false, rcStatus: false, datePicker: false })
const operationTypeOptions = [
  { value: 10, label: 'Payin Amount' },
  { value: 5,  label: 'Payout Amount' },
]
const rcStatusOptions = [
  { value: 3, label: 'Cancelled',         cls: 'cancelled' },
  { value: 4, label: 'Finished',          cls: 'completed' },
  { value: 5, label: 'Finished (sys)',    cls: 'completed' },
  { value: 6, label: 'Error',             cls: 'error'     },
  { value: 8, label: 'Incomplete',        cls: 'warning'   },
  { value: 9, label: 'Cancelled (inc)',   cls: 'cancelled' },
]
const isManualOptions = [
  { value: '',      label: 'All' },
  { value: 'false', label: '🏧 RC5000' },
  { value: 'true',  label: '💵 Manual' },
]

const OP_TYPE_LABELS = {5:'Payout Amount',10:'Payin Amount',1:'Deposit',2:'Load',3:'Replenish',4:'Payout Denom',
  6:'Payout Mix',7:'Exchange',8:'Float Denom',9:'Change Contents',11:'Float Excess',
  12:'Note Count',13:'Levels Adjust',14:'Internal',15:'Empty',16:'Register',
  17:'Collection',18:'Unload Denom',19:'Unload Amt',20:'Load Manual',21:'Unload Manual',22:'Float Amt'}
const RC_STATUS_LABELS = {3:'Cancelled',4:'Finished',5:'Finished (sys)',6:'Error',8:'Incomplete',9:'Cancelled (inc)'}
const RC_STATUS_CLASS  = {3:'cancelled',4:'completed',5:'completed',6:'error',8:'warning',9:'cancelled'}

function opTypeLabel(t)    { return OP_TYPE_LABELS[t]   || (t ? 'Type ' + t : '—') }
function rcStatusLabel(s)  { return RC_STATUS_LABELS[s] || 'Status ' + s }
function rcStatusClass(s)  { return RC_STATUS_CLASS[s]  || '' }

// ── Calendar state ───────────────────────────────────────────────────────────
const calViewDate = ref(new Date())

const calMonthLabel = computed(() => {
  return calViewDate.value.toLocaleString('default', { month: 'long', year: 'numeric' })
})

const calBlanks = computed(() => {
  const d = new Date(calViewDate.value.getFullYear(), calViewDate.value.getMonth(), 1)
  return (d.getDay() + 6) % 7  // Mon=0
})

const calDays = computed(() => {
  const y = calViewDate.value.getFullYear()
  const m = calViewDate.value.getMonth()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const todayIso = new Date().toISOString().slice(0, 10)
  const days = []
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    days.push({ d, iso, isToday: iso === todayIso })
  }
  return days
})

function calPrevMonth() {
  const d = new Date(calViewDate.value)
  d.setMonth(d.getMonth() - 1)
  calViewDate.value = d
}
function calNextMonth() {
  const d = new Date(calViewDate.value)
  d.setMonth(d.getMonth() + 1)
  calViewDate.value = d
}

function buildTxParams(page) {
  const params = new URLSearchParams({ page, limit: 100 })
  if (txFilters.date)                   params.set('date',          txFilters.date)
  if (txFilters.operationTypes.length)  params.set('operationType', txFilters.operationTypes.join(','))
  if (txFilters.cashierIds.length)      params.set('cashierId',     txFilters.cashierIds.join(','))
  if (txFilters.rcStatuses.length)      params.set('rcStatus',      txFilters.rcStatuses.join(','))
  if (txFilters.isManual !== '')        params.set('isManual',      txFilters.isManual)
  return params
}

async function loadTransactions(page = 1) {
  try {
    const res = await api.get('/sesami/transactions?' + buildTxParams(page))
    transactions.value = res.data.data
    txMeta.value = { total: res.data.total, page: res.data.page, pages: res.data.pages, limit: res.data.limit }
  } catch {}
}

function clearTxFilters() {
  txFilters.date = ''; txFilters.operationTypes = []; txFilters.rcStatuses = []; txFilters.cashierIds = []; txFilters.isManual = ''
  loadTransactions(1)
}

async function exportExcel() {
  try {
    const params = buildTxParams(1)
    const res = await api.get('/sesami/transactions?' + params)
    const rows = res.data.data

    // Build CSV-like array for SheetJS
    const headers = ['Date', 'ID', 'User', 'Device', 'Operation', 'Source', 'RC Status', 'Total In', 'Total Out', 'Total', 'Currency']
    const data = rows.map(tx => [
      tx.date, tx.id, tx.cashierName, tx.deviceName || '',
      OP_TYPE_LABELS[tx.operationType] || tx.operationType,
      tx.isManual ? 'Manual' : 'RC5000',
      RC_STATUS_LABELS[tx.rcStatus] || tx.rcStatus || '',
      tx.totalIn || 0, tx.totalOut || 0, tx.total, tx.currency
    ])

    // Use SheetJS via CDN (loaded dynamically)
    if (!window.XLSX) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script')
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
        s.onload = resolve; s.onerror = reject
        document.head.appendChild(s)
      })
    }
    const ws = window.XLSX.utils.aoa_to_sheet([headers, ...data])
    // Column widths
    ws['!cols'] = [20,36,20,20,14,10,14,12,12,12,10].map(w => ({ wch: w }))
    const wb = window.XLSX.utils.book_new()
    window.XLSX.utils.book_append_sheet(wb, ws, 'Transactions')
    const date = txFilters.date || new Date().toISOString().slice(0,10)
    window.XLSX.writeFile(wb, `transactions_${date}.xlsx`)
  } catch (e) { console.error('Export failed:', e) }
}

function formatDate(d) { return new Date(d).toLocaleString() }

onMounted(async () => {
  await Promise.all([loadAllItems(), loadCategories(), loadSettingsFull(), loadUsers(), loadTransactions(), loadDevices()])
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
.tx-section { display: flex; flex-direction: column; gap: 16px; }

.date-picker-wrap { position: relative; }
.date-picker-trigger {
  display: flex; align-items: center; gap: 8px; min-width: 160px;
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); padding: 7px 10px; font-size: 13px;
  color: var(--color-text); cursor: pointer; user-select: none;
  transition: border-color 0.15s;
}
.date-picker-trigger:hover { border-color: var(--color-primary); }
.dp-icon { font-size: 14px; }
.dp-clear { margin-left: auto; color: var(--color-text-3); font-size: 11px; }
.dp-clear:hover { color: var(--color-danger); }
.date-calendar {
  position: absolute; top: calc(100% + 4px); left: 0; z-index: 300;
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); box-shadow: var(--shadow-lg);
  padding: 12px; min-width: 240px;
}
.cal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.cal-header button {
  background: var(--color-surface-2); border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); width: 28px; height: 28px; cursor: pointer;
  color: var(--color-text); font-size: 16px; line-height: 1;
}
.cal-header button:hover { border-color: var(--color-primary); color: var(--color-primary); }
.cal-header span { font-weight: 600; font-size: 14px; color: var(--color-text); }
.cal-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; margin-bottom: 4px; }
.cal-weekdays span { text-align: center; font-size: 11px; color: var(--color-text-3); padding: 2px 0; }
.cal-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.cal-day {
  text-align: center; padding: 6px 2px; font-size: 13px; border-radius: var(--radius-sm);
  cursor: pointer; color: var(--color-text); transition: background 0.1s;
}
.cal-day:hover { background: var(--color-surface-2); color: var(--color-primary); }
.cal-day.today { font-weight: 700; color: var(--color-primary); }
.cal-day.selected { background: var(--color-primary); color: #000 !important; font-weight: 700; }
.cal-day.empty { cursor: default; }

.multi-select { position: relative; min-width: 160px; }
.multi-select-trigger {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); padding: 7px 10px; font-size: 13px;
  color: var(--color-text); cursor: pointer; user-select: none;
  transition: border-color 0.15s;
}
.multi-select.open .multi-select-trigger,
.multi-select-trigger:hover { border-color: var(--color-primary); }
.multi-select-arrow { font-size: 10px; color: var(--color-text-3); transition: transform 0.15s; }
.multi-select.open .multi-select-arrow { transform: rotate(180deg); }
.multi-select-dropdown {
  display: none; position: absolute; top: calc(100% + 4px); left: 0; z-index: 200;
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); box-shadow: var(--shadow-lg);
  min-width: 100%; padding: 6px 0; max-height: 240px; overflow-y: auto;
}
.multi-select.open .multi-select-dropdown { display: block; }
.multi-select-option {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 14px; cursor: pointer; font-size: 13px;
  color: var(--color-text);
}
.multi-select-option:hover { background: var(--color-surface-2); }
.multi-select-option input[type="checkbox"] { accent-color: var(--color-primary); width: 14px; height: 14px; }
.user-role-badge { margin-left: auto; font-size: 10px; color: var(--color-text-3); text-transform: capitalize; }

.tx-filters {
  display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap;
  background: var(--color-surface-2); border: 1px solid var(--color-border);
  border-radius: var(--radius-md); padding: 14px 16px;
}
.filter-group { display: flex; flex-direction: column; gap: 4px; }
.filter-group label { font-size: 11px; color: var(--color-text-2); text-transform: uppercase; letter-spacing: 0.05em; }
.filter-group input, .filter-group select {
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); padding: 7px 10px; font-size: 13px;
  color: var(--color-text); min-width: 140px;
}
.filter-actions { display: flex; gap: 8px; align-items: flex-end; margin-left: auto; }

.tx-summary { font-size: 13px; color: var(--color-text-2); display: flex; justify-content: space-between; padding: 0 2px; }

.tx-table-wrap { overflow-x: auto; border: 1px solid var(--color-border); border-radius: var(--radius-md); }
.tx-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.tx-table thead th {
  background: var(--color-surface-2); color: var(--color-text-2);
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
  padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--color-border);
}
.tx-table thead th.num, .tx-table td.num { text-align: right; }
.tx-table tbody tr { border-bottom: 1px solid var(--color-border); transition: background 0.1s; }
.tx-table tbody tr:last-child { border-bottom: none; }
.tx-table tbody tr:hover { background: var(--color-surface-2); }
.tx-table td { padding: 10px 12px; color: var(--color-text); }
.tx-date-cell { white-space: nowrap; font-size: 12px; color: var(--color-text-2); }
.tx-id-cell code { font-size: 11px; color: var(--color-text-3); }
.neg { color: var(--color-warning) !important; }

.tx-badge { font-size: 11px; padding: 2px 8px; border-radius: 999px; font-weight: 600; text-transform: capitalize; }
.tx-badge.completed { background: rgba(0,196,179,0.15); color: var(--color-primary); border: 1px solid var(--color-primary); }
.tx-badge.warning   { background: rgba(240,165,0,0.15); color: var(--color-warning); border: 1px solid var(--color-warning); }
.tx-badge.cancelled { background: rgba(220,50,50,0.12); color: var(--color-danger); border: 1px solid var(--color-danger); }
.tx-badge.error     { background: rgba(220,50,50,0.2);  color: var(--color-danger); border: 1px solid var(--color-danger); }
.tx-badge.manual    { background: rgba(99,102,241,0.15); color: #818cf8; border: 1px solid #818cf8; }
.tx-badge.auto      { background: rgba(0,196,179,0.1);  color: var(--color-primary); border: 1px solid var(--color-primary); }
.tx-badge.op        { background: var(--color-surface-2); color: var(--color-text-2); border: 1px solid var(--color-border); }
.tx-badge.op-5      { background: rgba(240,165,0,0.1);  color: var(--color-warning); border: 1px solid var(--color-warning); }
.tx-badge.op-10     { background: rgba(0,196,179,0.1);  color: var(--color-primary); border: 1px solid var(--color-primary); }

.tx-pagination { display: flex; gap: 4px; align-items: center; justify-content: center; flex-wrap: wrap; }
.tx-pagination button {
  padding: 6px 10px; border-radius: var(--radius-sm); font-size: 13px;
  background: var(--color-surface-2); border: 1px solid var(--color-border); color: var(--color-text);
  cursor: pointer;
}
.tx-pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
.tx-pagination button.active { background: var(--color-primary); color: #000; border-color: var(--color-primary); font-weight: 700; }
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

.badge-refund { font-size: 11px; background: rgba(240,165,0,0.15); color: var(--color-warning); padding: 2px 8px; border-radius: 999px; border: 1px solid var(--color-warning); }
.badge-no-refund { font-size: 13px; color: var(--color-text-3); }
.refund-perm { margin: 4px 0 8px; }
.badge-default { font-size: 11px; background: var(--color-primary-alpha); color: var(--color-primary); padding: 2px 8px; border-radius: 999px; border: 1px solid var(--color-primary); }
.device-test-row { display: flex; flex-direction: column; gap: 8px; margin: 8px 0; }
.connection-status { font-size: 13px; padding: 8px 12px; border-radius: var(--radius-sm); margin: 0; }
.connection-status.ok { color: #10b981; background: rgba(16,185,129,0.1); }
.connection-status.error { color: var(--color-danger); background: var(--color-danger-alpha); }
.connection-status.testing { color: var(--color-text-2); background: var(--color-surface-2); }
.device-label { font-size: 12px; color: var(--color-text-3); background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 4px 10px; font-family: monospace; }
</style>
