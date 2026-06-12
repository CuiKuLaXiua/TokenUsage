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
      <div v-else ref="tableWrapRef" class="table-wrap">
        <table class="glass-table">
          <thead>
            <tr>
              <th class="drag-col"></th>
              <th>模型名称</th>
              <th>提供商</th>
              <th>额度</th>
              <th>状态</th>
              <th>自动刷新</th>
              <th>操作</th>
            </tr>
          </thead>
          <draggable
            v-model="store.models"
            item-key="id"
            tag="tbody"
            ghost-class="row-ghost"
            drag-class="row-drag"
            :force-fallback="true"
            :animation="0"
            handle=".drag-handle"
            @end="onDragEnd"
          >
            <template #item="{ element: model }">
              <tr>
                <td class="drag-col">
                  <span class="drag-handle">⠿</span>
                </td>
                <td>
                  <span class="model-name">{{ model.name }}</span>
                </td>
                <td>
                  <span class="provider-badge" :class="model.provider">{{ model.provider }}</span>
                </td>
                <td>
                  <div v-if="store.modelUsageMap[model.id]" class="usage-cell">
                    <!-- 错误状态 -->
                    <template v-if="store.modelUsageMap[model.id].usageType === 'error'">
                      <div class="error-usage-cell">
                        <span class="error-text">未获取</span>
                        <span
                          class="error-reason-tag"
                          :class="{
                            'cookie-expired': store.modelUsageMap[model.id].error?.includes('Cookie'),
                            'api-key-invalid': store.modelUsageMap[model.id].error?.includes('API key')
                          }"
                          @click="handleErrorAction(model)"
                        >
                          {{ store.modelUsageMap[model.id].error || '未知错误' }}
                        </span>
                      </div>
                    </template>
                    <!-- 多层级额度 (Kimi / OpenCode / percent) -->
                    <template v-else-if="store.modelUsageMap[model.id].usageType === 'percent' && store.modelUsageMap[model.id].tiers?.length">
                      <div v-for="tier in store.modelUsageMap[model.id].tiers" :key="tier.name" class="tier-row">
                        <div class="tier-row-header">
                          <div class="tier-label">{{ tier.label }}</div>
                          <!-- 重置时间（右上角） -->
                          <span v-if="tier.resetAt" class="tier-reset-inline">
                            <el-icon :size="10"><Clock /></el-icon>
                            {{ formatResetTime(tier.resetAt) }}
                          </span>
                        </div>
                        <div class="tier-track-row">
                          <div class="tier-bar-track">
                            <div
                              class="tier-bar-fill"
                              :style="{
                                width: '100%',
                                background: 'var(--progress-gradient)',
                                clipPath: `inset(0 calc(100% - ${tier.percent}%) 0 0)`
                              }"
                            ></div>
                          </div>
                          <!-- 百分比（进度条右侧） -->
                          <span class="tier-percent">{{ tier.percent }}%</span>
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
                            width: '100%',
                            background: 'var(--progress-gradient)',
                            clipPath: `inset(0 calc(100% - ${(store.modelUsageMap[model.id].percent || 0)}%) 0 0)`
                          }"
                        ></div>
                      </div>
                      <div class="usage-meta">
                        <span>{{ formatTokens(store.modelUsageMap[model.id].used) }} / {{ formatTokens(store.modelUsageMap[model.id].total) }}</span>
                        <span class="usage-remaining">余 {{ formatTokens(store.modelUsageMap[model.id].remaining) }}</span>
                      </div>
                      <!-- MIMO 套餐详情 -->
                      <div v-if="store.modelUsageMap[model.id].currentPeriodEnd || store.modelUsageMap[model.id].enableAutoRenew !== undefined" class="plan-detail">
                        <span v-if="store.modelUsageMap[model.id].currentPeriodEnd" class="plan-detail-item">
                          到期 {{ store.modelUsageMap[model.id].currentPeriodEnd?.slice(0, 10) }}
                        </span>
                        <el-tag
                          v-if="store.modelUsageMap[model.id].enableAutoRenew !== undefined"
                          :type="store.modelUsageMap[model.id].enableAutoRenew ? 'success' : 'info'"
                          size="small"
                          effect="light"
                          round
                        >
                          {{ store.modelUsageMap[model.id].enableAutoRenew ? '自动续费 ON' : '自动续费 OFF' }}
                        </el-tag>
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
                    每 {{ model.refreshInterval }} {{ model.refreshUnit === 'second' ? '秒' : model.refreshUnit === 'hour' ? '小时' : '分钟' }}
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
            </template>
          </draggable>
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
                <option value="opencode">Open Code</option>
              </select>
            </div>
            <!-- API 密钥（OpenCode 除外） -->
            <div v-if="form.provider !== 'mimo' && form.provider !== 'opencode'" class="form-field">
              <label class="form-label">API 密钥 <span class="required">*</span></label>
              <div class="input-with-suffix">
                <input
                  v-model="form.apiKey"
                  class="form-input"
                  :type="showApiKey ? 'text' : 'password'"
                  placeholder="Bearer Token"
                />
                <button
                  type="button"
                  class="suffix-btn"
                  @click="showApiKey = !showApiKey"
                  :title="showApiKey ? '隐藏' : '显示'"
                >
                  <el-icon :size="14">
                    <component :is="showApiKey ? Hide : View" />
                  </el-icon>
                </button>
              </div>
            </div>
            <!-- MiMo Cookie -->
            <div v-if="form.provider === 'mimo'" class="form-field">
              <label class="form-label">Cookie <span class="required">*</span></label>
              <div class="cookie-field">
                <textarea
                  v-model="form.cookies"
                  class="form-input form-textarea"
                  rows="3"
                  placeholder="从浏览器复制 Cookie"
                ></textarea>
                <div class="cookie-actions">
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
            <!-- OpenCode Cookie -->
            <div v-if="form.provider === 'opencode'" class="form-field">
              <label class="form-label">Cookie <span class="required">*</span></label>
              <div class="cookie-field">
                <textarea
                  v-model="form.cookies"
                  class="form-input form-textarea"
                  rows="3"
                  placeholder="点击下方按钮自动登录获取"
                  readonly
                ></textarea>
                <div class="cookie-actions">
                  <button
                    class="btn-primary btn-sm"
                    @click="handleOpenCodeLogin"
                    :disabled="store.loginState === 'logging-in'"
                  >
                    <span v-if="store.loginState === 'logging-in'">登录中...</span>
                    <span v-else>🔑 登录获取 Cookie 和 URL</span>
                  </button>
                </div>
                <div class="cookie-hint">
                  <p>提示：点击按钮后，在弹出窗口中登录 GitHub，然后进入用量页面（/go），最后关闭窗口即可自动获取</p>
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
                  max="9999"
                  step="1"
                  placeholder="0"
                />
                <select v-model="form.refreshUnit" class="form-input unit-select">
                  <option value="second">秒</option>
                  <option value="minute">分钟</option>
                  <option value="hour">小时</option>
                </select>
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

    <!-- 应用设置 -->
    <div class="section-card glass-surface" style="animation-delay: 60ms">
      <div class="section-header">
        <h3 class="section-title">应用设置</h3>
      </div>
      <div class="app-settings">
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">关闭窗口时</span>
            <span class="setting-desc">选择点击关闭按钮后的行为</span>
          </div>
          <select v-model="closeActionModel" class="form-input form-select setting-select" @change="onCloseActionChange">
            <option :value="null">每次询问</option>
            <option value="minimize-to-tray">隐藏到托盘</option>
            <option value="quit">直接退出</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus,
  Edit,
  Delete,
  Refresh,
  Loading,
  Close,
  Timer,
  Clock,
  Setting,
  View,
  Hide,
  Key
} from '@element-plus/icons-vue'
import type { ModelConfig } from '@/stores/app'
import { useAppStore } from '@/stores/app'
import type { CloseAction } from '@/types/electron'
import { formatTokens, formatResetTime } from '@/utils/format'
import draggable from 'vuedraggable'

const store = useAppStore()

const dialogVisible = ref(false)
const isEditing = ref(false)
const showPasteDialog = ref(false)
const cookiesInput = ref('')
const showApiKey = ref(false)

// 关闭行为设置
const closeActionModel = ref<CloseAction | null>(null)
let unsubCloseActionUpdated: (() => void) | undefined

onMounted(async () => {
  try {
    closeActionModel.value = await window.electronAPI.getCloseAction()
  } catch { /* ignore */ }

  // 监听对话框中的配置更新
  unsubCloseActionUpdated = window.electronAPI.onCloseActionUpdated((action) => {
    closeActionModel.value = action
  })
})

onUnmounted(() => {
  unsubCloseActionUpdated?.()
})

async function onCloseActionChange() {
  await window.electronAPI.setCloseAction(closeActionModel.value)
  ElMessage.success({ message: '关闭行为已更新', duration: 1500 })
}

// ── 配置页拖拽排序 ──
// vuedraggable 直接修改 store.models，拖拽完成后自动保存
function onDragEnd() {
  store.saveConfig()
}

const defaultForm: ModelConfig = {
  id: '',
  name: '',
  provider: 'mimo',
  apiKey: '',
  baseUrl: '',
  cookies: '',
  refreshInterval: 0,
  refreshUnit: 'minute',
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
  if (!form.name) {
    ElMessage.warning({ message: '请填写模型名称', duration: 2000 })
    return
  }
  // MIMO 仅需 Cookie，OpenCode 仅需 Cookie，其他提供商需要 API 密钥
  if (form.provider === 'mimo') {
    if (!form.cookies) {
      ElMessage.warning({ message: '需要填写 Cookie', duration: 2000 })
      return
    }
  } else if (form.provider === 'opencode') {
    if (!form.cookies) {
      ElMessage.warning({ message: '请点击登录按钮获取 Cookie', duration: 2000 })
      return
    }
  } else {
    if (!form.apiKey) {
      ElMessage.warning({ message: '请填写 API 密钥', duration: 2000 })
      return
    }
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

async function handleOpenCodeLogin() {
  try {
    store.loginState = 'logging-in'
    const result = await window.electronAPI.openOpencodeLogin()
    if (result.cookies) {
      form.cookies = result.cookies
      if (result.baseUrl) {
        form.baseUrl = result.baseUrl
      }
      if (result.api1ServerId) {
        form.serverId = result.api1ServerId
      }
      if (result.api1Instance) {
        form.serverInstance = result.api1Instance
      }
      if (result.api2ServerId) {
        form.dailyServerId = result.api2ServerId
      }
      if (result.api2Instance) {
        form.dailyServerInstance = result.api2Instance
      }
      if (result.api3ServerId) {
        form.recordsServerId = result.api3ServerId
      }
      if (result.api3Instance) {
        form.recordsServerInstance = result.api3Instance
      }
      ElMessage.success('登录成功，Cookie 和 API URL 已自动获取')
    } else {
      ElMessage.warning('登录超时或已取消')
    }
  } catch (error) {
    ElMessage.error('登录失败')
    console.error('Open Code 登录失败:', error)
  } finally {
    store.loginState = 'idle'
  }
}

async function fetchUsage(model: ModelConfig) {
  try {
    await store.requestRefresh(model.id)
    ElMessage.success({ message: `${model.name} 额度获取成功`, duration: 2000 })
  } catch (error: any) {
    console.error(`[Config] ${model.name} 获取额度失败:`, error)

    // 检查是否是 Cookie 过期错误（MiMo）
    if (error?.code === 'COOKIE_EXPIRED' || error?.message?.includes('Cookie expired')) {
      ElMessage.warning({ message: 'Cookie 已过期，请重新登录', duration: 3000 })
      // 不需要手动触发登录，store 的 login-needed 监听器会自动处理
    }
    // 检查是否是 API key 失效（Kimi、DeepSeek 等）
    else if (error?.message?.includes('unauthorized') ||
             error?.message?.includes('401') ||
             error?.message?.includes('403') ||
             error?.message?.includes('API request failed')) {
      ElMessage.error({
        message: `${model.name} API key 已失效，请重新配置`,
        duration: 5000,
        showClose: true
      })
    }
    // 其他错误
    else {
      ElMessage.error({ message: `${model.name} 数据解析失败`, duration: 2500 })
    }
  }
}

async function handleErrorAction(model: ModelConfig) {
  const usage = store.modelUsageMap[model.id]
  if (!usage?.error) return

  // Cookie 过期 - 打开登录窗口
  if (usage.error.includes('Cookie')) {
    try {
      if (model.provider === 'opencode') {
        await store.startOpenCodeLogin(model.id)
        ElMessage.success({ message: '登录成功，正在刷新额度...', duration: 2000 })
        await fetchUsage(model)
      } else {
        await store.startMimoLogin(model.id)
        ElMessage.success({ message: '登录成功，正在刷新额度...', duration: 2000 })
        await fetchUsage(model)
      }
    } catch (error) {
      console.error('登录失败:', error)
    }
  }
  // API key 失效 - 跳转到配置页面让用户修改
  else if (usage.error.includes('API key')) {
    ElMessage.warning({ message: '请在配置中更新 API key', duration: 3000 })
    // 这里可以跳转到配置页面或打开编辑对话框
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
  cursor: grab;
}

.glass-table tbody tr:active {
  cursor: grabbing;
}

.row-ghost {
  opacity: 0.6 !important;
  background: var(--accent-glow) !important;
}

.row-ghost td {
  border-top: 2px dashed var(--accent) !important;
  border-bottom: 2px dashed var(--accent) !important;
}

.row-drag {
  opacity: 1 !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  transition: none !important;
  box-shadow:
    0 16px 40px rgba(0, 0, 0, 0.4),
    0 6px 16px rgba(0, 0, 0, 0.25),
    0 0 0 2px var(--accent),
    0 0 30px var(--accent-glow) !important;
  z-index: 9999 !important;
  cursor: grabbing !important;
  background: var(--glass-bg-strong) !important;
  pointer-events: none !important;
  will-change: transform;
}

.glass-table tbody tr:hover {
  background: var(--glass-bg);
}

.glass-table tbody td {
  padding: 16px;
  border-bottom: 1px solid var(--border-light);
  vertical-align: middle;
}

.drag-col {
  width: 36px;
  padding: 4px 4px !important;
  text-align: center;
}

.drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: var(--text-placeholder);
  font-size: 16px;
  cursor: grab;
  user-select: none;
  opacity: 0.5;
  transition:
    opacity var(--duration-fast),
    background var(--duration-fast);
}

.glass-table tbody tr:hover .drag-handle {
  opacity: 1;
  background: var(--glass-bg);
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
  transition: clip-path 1s var(--ease-spring);
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

/* ── Plan detail (MIMO) ── */
.plan-detail {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-secondary);
}

.plan-detail-item {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

/* ── Tier rows ── */
.tier-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 6px;
}

.tier-row:last-child {
  margin-bottom: 0;
}

.tier-row-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
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
}

.tier-reset-inline {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 9px;
  color: var(--text-placeholder);
  white-space: nowrap;
}

.tier-track-row {
  display: flex;
  align-items: center;
  gap: 8px;
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
  transition: clip-path 1s var(--ease-spring);
}

.tier-percent {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  min-width: 35px;
  text-align: right;
}

.no-data {
  color: var(--text-placeholder);
  font-size: 12px;
}

/* ── Error Usage Cell ── */
.error-usage-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.error-text {
  font-size: 12px;
  color: var(--text-placeholder);
  font-weight: 500;
}

.error-reason-tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-smooth);
  border: 1px solid transparent;
  line-height: 1.4;
  word-break: break-word;
}

.error-reason-tag.cookie-expired {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.3);
}

.error-reason-tag.cookie-expired:hover {
  background: rgba(245, 158, 11, 0.2);
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.2);
  transform: translateY(-1px);
}

.error-reason-tag.api-key-invalid {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
}

.error-reason-tag.api-key-invalid:hover {
  background: rgba(239, 68, 68, 0.2);
  box-shadow: 0 0 12px rgba(239, 68, 68, 0.2);
  transform: translateY(-1px);
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

.unit-select {
  width: 72px !important;
  text-align: center;
  cursor: pointer;
  padding-right: 20px !important;
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
  background: rgba(212, 119, 106, 0.12);
  border-color: rgba(212, 119, 106, 0.3);
  color: var(--danger);
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
  color: var(--danger);
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

.input-with-suffix {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-suffix .form-input {
  padding-right: 38px;
}

.suffix-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-placeholder);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration-fast) var(--ease-smooth);
}

.suffix-btn:hover {
  background: var(--glass-bg-strong);
  color: var(--text-secondary);
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

.cookie-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 8px;
  padding: 8px;
  background: var(--glass-bg);
  border-radius: 6px;
  border: 1px solid var(--border-light);
}

.cookie-hint p {
  margin: 0;
  line-height: 1.5;
}

.cookie-hint code {
  background: var(--glass-bg-strong);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 11px;
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

/* ── Provider Badge ── */
.provider-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.provider-badge.mimo {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.provider-badge.kimi {
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
}

.provider-badge.deepseek {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.provider-badge.openai {
  background: rgba(16, 163, 127, 0.1);
  color: #10a37f;
}

.provider-badge.claude {
  background: rgba(217, 119, 6, 0.1);
  color: #d97706;
}

.provider-badge.opencode {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}

/* ── App Settings ── */
.app-settings {
  padding: 4px 0;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.setting-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.setting-desc {
  font-size: 12px;
  color: var(--text-secondary);
}

.setting-select {
  width: 160px !important;
  flex-shrink: 0;
}
</style>
