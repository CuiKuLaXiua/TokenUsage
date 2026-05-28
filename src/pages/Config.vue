<template>
  <div class="config-page">
    <!-- Header Card -->
    <div class="section-card glass-surface" style="animation-delay: 0ms">
      <div class="section-header">
        <h3 class="section-title">AI 模型配置</h3>
        <button class="btn-primary" @click="showAddModel">
          <el-icon :size="16"><Plus /></el-icon>
          <span>添加模型</span>
        </button>
      </div>

      <!-- Empty -->
      <div v-if="store.models.length === 0" class="empty-state">
        <div class="empty-icon-wrap">
          <el-icon :size="48" class="empty-float"><Setting /></el-icon>
        </div>
        <p class="empty-text">暂无模型配置</p>
        <button class="btn-primary" @click="showAddModel">添加第一个模型</button>
      </div>

      <!-- Table -->
      <div v-else class="table-wrap">
        <table class="glass-table">
          <thead>
            <tr>
              <th>模型名称</th>
              <th>提供商</th>
              <th>额度</th>
              <th>状态</th>
              <th>自动刷新</th>
              <th>操作</th>
            </tr>
          </thead>
          <TransitionGroup tag="tbody" name="table-row">
            <tr v-for="model in store.models" :key="model.id">
              <td>
                <span class="model-name">{{ model.name }}</span>
              </td>
              <td>
                <span class="provider-badge" :class="model.provider">{{ model.provider }}</span>
              </td>
              <td>
                <div v-if="store.modelUsageMap[model.id]" class="usage-cell">
                  <!-- 多层级额度 (Kimi / percent) -->
                  <template v-if="store.modelUsageMap[model.id].usageType === 'percent' && store.modelUsageMap[model.id].tiers?.length">
                    <div v-for="tier in store.modelUsageMap[model.id].tiers" :key="tier.name" class="tier-row">
                      <div class="tier-label">{{ tier.label }}</div>
                      <div class="tier-bar-track">
                        <div
                          class="tier-bar-fill"
                          :style="{
                            width: tier.percent + '%',
                            background: getProgressColor(tier.percent)
                          }"
                        ></div>
                      </div>
                      <div class="tier-meta">
                        <span>{{ formatTokens(tier.used) }} / {{ formatTokens(tier.total) }}</span>
                        <span class="tier-remaining">余 {{ formatTokens(tier.remaining) }}</span>
                      </div>
                    </div>
                  </template>
                  <!-- 余额 (DeepSeek / balance) -->
                  <template v-else-if="store.modelUsageMap[model.id].usageType === 'balance'">
                    <div class="usage-meta">
                      <span class="usage-remaining">
                        {{ store.modelUsageMap[model.id].currency === 'CNY' ? '¥' : store.modelUsageMap[model.id].currency }} {{ (store.modelUsageMap[model.id].balance || 0).toFixed(2) }}
                      </span>
                    </div>
                  </template>
                  <!-- 单层级额度 (MIMO / OpenAI / Claude / token) -->
                  <template v-else>
                    <div class="usage-bar-track">
                      <div
                        class="usage-bar-fill"
                        :style="{
                          width: (store.modelUsageMap[model.id].percent || 0) + '%',
                          background: getProgressColor(store.modelUsageMap[model.id].percent)
                        }"
                      ></div>
                    </div>
                    <div class="usage-meta">
                      <span>{{ formatTokens(store.modelUsageMap[model.id].used) }} / {{ formatTokens(store.modelUsageMap[model.id].total) }}</span>
                      <span class="usage-remaining">余 {{ formatTokens(store.modelUsageMap[model.id].remaining) }}</span>
                    </div>
                  </template>
                </div>
                <span v-else class="no-data">未获取</span>
              </td>
              <td>
                <span class="status-dot" :class="model.enabled ? 'active' : 'inactive'">
                  {{ model.enabled ? '启用' : '禁用' }}
                </span>
              </td>
              <td>
                <span v-if="model.refreshInterval && model.refreshInterval > 0" class="refresh-badge">
                  <el-icon :size="12"><Timer /></el-icon>
                  每 {{ model.refreshInterval }} 分钟
                </span>
                <span v-else class="refresh-off">关闭</span>
              </td>
              <td>
                <div class="action-group">
                  <button
                    class="icon-btn action-btn"
                    title="获取额度"
                    @click="fetchUsage(model)"
                    :disabled="store.fetching[model.id]"
                  >
                    <el-icon :size="15" :class="{ 'spin': store.fetching[model.id] }">
                      <component :is="store.fetching[model.id] ? Loading : Refresh" />
                    </el-icon>
                  </button>
                  <button class="icon-btn action-btn" title="编辑" @click="editModel(model)">
                    <el-icon :size="15"><Edit /></el-icon>
                  </button>
                  <button class="icon-btn action-btn danger" title="删除" @click="deleteModel(model.id)">
                    <el-icon :size="15"><Delete /></el-icon>
                  </button>
                </div>
              </td>
            </tr>
          </TransitionGroup>
        </table>
      </div>
    </div>

    <!-- Dialog -->
    <Transition name="dialog-fade">
      <div v-if="dialogVisible" class="dialog-overlay">
        <div class="dialog-box glass-surface">
          <div class="dialog-header">
            <h3 class="dialog-title">{{ isEditing ? '编辑模型' : '添加模型' }}</h3>
            <button class="icon-btn" @click="dialogVisible = false">
              <el-icon :size="16"><Close /></el-icon>
            </button>
          </div>

          <div class="dialog-body">
            <div class="form-field">
              <label class="form-label">模型名称 <span class="required">*</span></label>
              <input
                v-model="form.name"
                class="form-input"
                placeholder="例如: 小米 MIMO"
              />
            </div>
            <div class="form-field">
              <label class="form-label">提供商 <span class="required">*</span></label>
              <select v-model="form.provider" class="form-input form-select">
                <option value="mimo">小米 MIMO</option>
                <option value="openai">OpenAI</option>
                <option value="claude">Claude</option>
                <option value="deepseek">DeepSeek</option>
                <option value="kimi">Kimi</option>
              </select>
            </div>
            <div class="form-field">
              <label class="form-label">API 地址</label>
              <input
                v-model="form.baseUrl"
                class="form-input"
                placeholder="留空使用默认地址"
              />
            </div>
            <div class="form-field">
              <label class="form-label">API 密钥 <span class="required">*</span></label>
              <input
                v-model="form.apiKey"
                class="form-input"
                type="password"
                placeholder="Bearer Token"
              />
            </div>
            <div class="form-field">
              <label class="form-label">Cookie</label>
              <div class="cookie-field">
                <textarea
                  v-model="form.cookies"
                  class="form-input form-textarea"
                  rows="3"
                  :placeholder="form.provider === 'kimi' ? 'Kimi Coding Plan 不需要 Cookie' : '从浏览器复制 Cookie'"
                ></textarea>
                <div class="cookie-actions" v-if="form.provider === 'mimo'">
                  <button 
                    class="btn-primary btn-sm" 
                    @click="handleLogin"
                    :disabled="store.loginState === 'logging-in'"
                  >
                    <span v-if="store.loginState === 'logging-in'">登录中...</span>
                    <span v-else>🔑 登录获取</span>
                  </button>
                  <button class="btn-ghost btn-sm" @click="showPasteDialog = true">
                    📋 粘贴
                  </button>
                </div>
              </div>
            </div>
            <div class="form-field form-field-inline">
              <label class="form-label">自动刷新</label>
              <div class="interval-wrap">
                <input
                  v-model.number="form.refreshInterval"
                  type="number"
                  class="form-input interval-input"
                  min="0"
                  max="1440"
                  step="5"
                  placeholder="0"
                />
                <span class="interval-unit">分钟</span>
              </div>
              <span class="interval-hint">0 = 关闭</span>
            </div>
            <div class="form-field form-field-inline">
              <label class="form-label">启用</label>
              <button
                class="toggle-btn"
                :class="{ active: form.enabled }"
                @click="form.enabled = !form.enabled"
              >
                <span class="toggle-knob"></span>
              </button>
            </div>
          </div>

           <div class="dialog-footer">
            <button class="btn-ghost" @click="dialogVisible = false">取消</button>
            <button class="btn-primary" @click="saveModel">保存</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 粘贴 Cookies 对话框 -->
    <Transition name="dialog-fade">
      <div v-if="showPasteDialog" class="dialog-overlay">
        <div class="dialog-box glass-surface">
          <div class="dialog-header">
            <h3 class="dialog-title">粘贴 Cookies</h3>
            <button class="icon-btn" @click="showPasteDialog = false">
              <el-icon :size="16"><Close /></el-icon>
            </button>
          </div>
          <div class="dialog-body">
            <p class="paste-hint">
              请在 Chrome 浏览器中登录 MiMo 平台后，按 F12 打开开发者工具，
              在 Console 中执行 <code>document.cookie</code> 复制 cookies，然后粘贴到下方：
            </p>
            <textarea
              v-model="cookiesInput"
              class="form-input form-textarea"
              rows="6"
              placeholder="粘贴 cookies 字符串..."
            ></textarea>
          </div>
          <div class="dialog-footer">
            <button class="btn-ghost" @click="showPasteDialog = false">取消</button>
            <button class="btn-primary" @click="handlePasteCookies">确定</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus,
  Edit,
  Delete,
  Refresh,
  Loading,
  Close,
  Timer,
  Setting
} from '@element-plus/icons-vue'
import type { ModelConfig } from '@/stores/app'
import { useAppStore } from '@/stores/app'
import { formatTokens, getProgressColor } from '@/utils/format'

const store = useAppStore()

const dialogVisible = ref(false)
const isEditing = ref(false)
const showPasteDialog = ref(false)
const cookiesInput = ref('')

const defaultForm: ModelConfig = {
  id: '',
  name: '',
  provider: 'mimo',
  apiKey: '',
  baseUrl: '',
  cookies: '',
  refreshInterval: 0,
  enabled: true
}

const form = reactive<ModelConfig>({ ...defaultForm })

function showAddModel() {
  isEditing.value = false
  Object.assign(form, { ...defaultForm, id: Date.now().toString() })
  dialogVisible.value = true
}

function editModel(model: ModelConfig) {
  isEditing.value = true
  Object.assign(form, model)
  dialogVisible.value = true
}

async function saveModel() {
  if (!form.name || !form.apiKey) {
    ElMessage.warning({ message: '请填写必填字段', duration: 2000 })
    return
  }

  try {
    if (isEditing.value) {
      await store.updateModel(form.id, { ...form })
    } else {
      await store.addModel({ ...form })
    }
    dialogVisible.value = false
    ElMessage.success({ message: isEditing.value ? '更新成功' : '添加成功', duration: 2000 })
  } catch (e: any) {
    ElMessage.error({ message: '保存失败: ' + (e.message || '未知错误'), duration: 3000 })
  }
}

function deleteModel(id: string) {
  ElMessageBox.confirm('确定删除此模型？', '确认', { type: 'warning' }).then(async () => {
    await store.removeModel(id)
    ElMessage.success({ message: '删除成功', duration: 2000 })
  }).catch(() => {})
}

function handlePasteCookies() {
  if (!cookiesInput.value.trim()) {
    ElMessage.warning('请输入 cookies')
    return
  }
  form.cookies = cookiesInput.value.trim()
  showPasteDialog.value = false
  cookiesInput.value = ''
  ElMessage.success('Cookies 已填入')
}

async function handleLogin() {
  try {
    const cookies = await window.electronAPI.openMimoLogin()
    if (cookies) {
      form.cookies = cookies
      ElMessage.success('登录成功，Cookies 已获取')
    } else {
      ElMessage.warning('登录超时或已取消')
    }
  } catch (error) {
    ElMessage.error('登录失败')
    console.error('登录失败:', error)
  }
}

async function fetchUsage(model: ModelConfig) {
  const result = await store.fetchModelUsage(model)
  if (result) {
    ElMessage.success({ message: `${model.name} 额度获取成功`, duration: 2000 })
  } else {
    ElMessage.error({ message: '数据解析失败', duration: 2500 })
  }
}
</script>

<style scoped>
.config-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* ── Buttons ── */
.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 18px;
  border-radius: 10px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-smooth);
}

.btn-ghost:hover {
  background: var(--glass-bg-strong);
  color: var(--text-primary);
  border-color: var(--border-color);
}

.btn-ghost:active {
  transform: scale(0.97);
}

/* ── Table ── */
.table-wrap {
  overflow-x: auto;
}

.glass-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
}

.glass-table thead th {
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-light);
  white-space: nowrap;
}

.glass-table tbody tr {
  transition: background var(--duration-fast) var(--ease-smooth);
}

.glass-table tbody tr:hover {
  background: var(--glass-bg);
}

.glass-table tbody td {
  padding: 16px;
  border-bottom: 1px solid var(--border-light);
  vertical-align: middle;
}

.model-name {
  font-weight: 600;
  color: var(--text-primary);
}

/* ── Usage cell ── */
.usage-cell {
  min-width: 180px;
}

.usage-bar-track {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--border-light);
  overflow: hidden;
}

.usage-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 1s var(--ease-spring);
}

.usage-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 6px;
}

.usage-remaining {
  color: var(--success);
  font-weight: 600;
}

/* ── Tier rows ── */
.tier-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.tier-row:last-child {
  margin-bottom: 0;
}

.tier-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--glass-bg);
  border: 1px solid var(--border-light);
  border-radius: 4px;
  padding: 1px 6px;
  white-space: nowrap;
  flex-shrink: 0;
}

.tier-bar-track {
  flex: 1;
  height: 5px;
  border-radius: 3px;
  background: var(--border-light);
  overflow: hidden;
}

.tier-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 1s var(--ease-spring);
}

.tier-meta {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-secondary);
  margin-top: 2px;
  padding-left: 34px;
}

.tier-remaining {
  color: var(--success);
  font-weight: 600;
}

.no-data {
  color: var(--text-placeholder);
  font-size: 12px;
}

/* ── Status dot ── */
.status-dot {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
}

.status-dot::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.status-dot.active::before {
  background: var(--success);
  box-shadow: 0 0 8px rgba(52, 211, 153, 0.4);
}

.status-dot.inactive::before {
  background: var(--text-placeholder);
}

/* ── Refresh interval ── */
.interval-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.interval-input {
  width: 80px !important;
  text-align: center;
  -moz-appearance: textfield;
}

.interval-input::-webkit-inner-spin-button,
.interval-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.interval-unit {
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.interval-hint {
  font-size: 11px;
  color: var(--text-placeholder);
  flex-shrink: 0;
}

.refresh-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--accent);
  background: var(--accent-glow);
  padding: 2px 8px;
  border-radius: 6px;
}

.refresh-off {
  font-size: 11px;
  color: var(--text-placeholder);
}

/* ── Action group ── */
.action-group {
  display: flex;
  gap: 6px;
}

.action-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.action-btn.danger:hover {
  background: rgba(248, 113, 113, 0.12);
  border-color: rgba(248, 113, 113, 0.3);
  color: #f87171;
}

/* ── Table row transitions ── */
.table-row-enter-active {
  transition: all var(--duration-normal) var(--ease-spring);
}

.table-row-leave-active {
  transition: all var(--duration-fast) var(--ease-smooth);
}

.table-row-enter-from {
  opacity: 0;
  transform: translateX(-12px);
}

.table-row-leave-to {
  opacity: 0;
  transform: translateX(12px);
}

/* ── Dialog ── */
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog-box {
  width: 480px;
  max-height: 85vh;
  border-radius: 20px;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-light);
}

.dialog-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.dialog-body {
  padding: 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px;
  border-top: 1px solid var(--border-light);
}

/* ── Dialog animation ── */
.dialog-fade-enter-active {
  transition: all var(--duration-normal) var(--ease-spring);
}

.dialog-fade-leave-active {
  transition: all var(--duration-fast) var(--ease-smooth);
}

.dialog-fade-enter-from {
  opacity: 0;
}

.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-from .dialog-box {
  transform: scale(0.92) translateY(12px);
  opacity: 0;
}

.dialog-fade-leave-to .dialog-box {
  transform: scale(0.96) translateY(4px);
  opacity: 0;
}

/* ── Form ── */
.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field-inline {
  flex-direction: row;
  align-items: center;
  gap: 12px;
}

.form-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.required {
  color: #f87171;
}

.form-input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: all var(--duration-normal) var(--ease-smooth);
}

.form-input::placeholder {
  color: var(--text-placeholder);
}

.form-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.form-select {
  appearance: none;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239ba1b0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 32px;
}

.form-textarea {
  resize: vertical;
  min-height: 72px;
}

.cookie-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cookie-actions {
  display: flex;
  gap: 8px;
}

.btn-sm {
  padding: 4px 12px;
  font-size: 12px;
}

.paste-hint {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 12px;
}

.paste-hint code {
  background: var(--glass-bg-strong);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

/* ── Toggle ── */
.toggle-btn {
  width: 44px;
  height: 24px;
  border-radius: 12px;
  border: none;
  background: var(--border-color);
  position: relative;
  cursor: pointer;
  transition: background var(--duration-normal) var(--ease-smooth);
  flex-shrink: 0;
}

.toggle-btn.active {
  background: var(--accent);
}

.toggle-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  transition: transform var(--duration-normal) var(--ease-spring);
}

.toggle-btn.active .toggle-knob {
  transform: translateX(20px);
}
</style>
