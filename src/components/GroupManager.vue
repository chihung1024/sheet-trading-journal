<template>
  <div class="card gm-card">
    <div class="gm-header">
      <div>
        <h3 class="gm-title">管理策略群組</h3>
        <p class="gm-subtitle">提升分群維護效率：可快速更名、批次調整交易歸屬，並即時查看變更數量。</p>
      </div>
    </div>

    <section class="gm-section">
      <div class="gm-section-title-row">
        <h4 class="gm-section-title">群組更名</h4>
        <span class="gm-section-hint">更名後將同步更新所有含該標籤的交易紀錄</span>
      </div>

      <div v-if="editableGroups.length > 0" class="group-list">
        <article v-for="g in editableGroups" :key="g" class="group-item">
          <div class="group-item-header">
            <span class="group-label">目前群組</span>
            <span class="group-name">{{ g }}</span>
          </div>
          <div class="group-input-row">
            <input type="text" v-model="groupRenameMap[g]" :placeholder="`輸入新名稱（目前：${g}）`" />
            <button
              class="btn-sm"
              type="button"
              @click="renameGroup(g)"
              :disabled="!groupRenameMap[g] || groupRenameMap[g] === g"
            >
              套用更名
            </button>
          </div>
        </article>
      </div>

      <p v-else class="gm-empty-hint">目前尚無可管理的策略群組。</p>
    </section>

    <section class="gm-section gm-section-selection">
      <div class="gm-selection-header">
        <div class="gm-select-wrap">
          <label for="gm-group-select">目標群組</label>
          <select id="gm-group-select" v-model="selectedGroup" :disabled="editableGroups.length === 0">
            <option value="" disabled>請先選擇群組</option>
            <option v-for="g in editableGroups" :key="g" :value="g">
              {{ g }}
            </option>
          </select>
        </div>

        <div class="gm-toolbar">
          <button class="btn-sm" type="button" @click="selectAll" :disabled="!canEditRecords">全選</button>
          <button class="btn-sm" type="button" @click="clearAll" :disabled="!canEditRecords">全不選</button>
        </div>
      </div>

      <div class="gm-meta-row">
        <p class="gm-help">勾選＝納入群組計算、取消勾選＝從群組移除。完成後按下「確認儲存」。</p>
        <div class="gm-metrics" aria-live="polite">
          <span class="gm-counter">總交易 {{ portfolioStore.records.length }}</span>
          <span class="gm-counter gm-counter-highlight" :class="{ 'is-zero': changedCount === 0 }">已變更 {{ changedCount }}</span>
        </div>
      </div>

      <div class="gm-records">
        <table class="gm-table">
          <thead>
            <tr>
              <th class="checkbox-col">納入</th>
              <th>日期</th>
              <th>標的</th>
              <th>類型</th>
              <th class="text-right">數量</th>
              <th class="text-right">價格</th>
              <th>目前標籤</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="portfolioStore.records.length === 0">
              <td colspan="7" class="empty-state">目前沒有交易紀錄</td>
            </tr>
            <tr v-for="record in portfolioStore.records" :key="record.id" :class="{ changed: rowChanged(record) }">
              <td class="checkbox-col">
                <label class="gm-checkbox">
                  <input
                    type="checkbox"
                    :checked="recordSelections[record.id] || false"
                    :disabled="!selectedGroup"
                    @change="toggleRecord(record.id)"
                  />
                  <span></span>
                </label>
              </td>
              <td class="font-mono">{{ record.txn_date }}</td>
              <td><span class="symbol-badge">{{ record.symbol }}</span></td>
              <td>
                <span class="type-badge" :class="record.txn_type.toLowerCase()">
                  {{ record.txn_type }}
                </span>
              </td>
              <td class="text-right font-mono">{{ record.qty }}</td>
              <td class="text-right font-mono">{{ record.price }}</td>
              <td class="gm-tag">{{ record.tag || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="gm-footer">
        <span v-if="changedCount > 0" class="gm-change">已變更 {{ changedCount }} 筆，準備儲存</span>
        <span v-else class="gm-no-change">尚未變更</span>
        <button class="action-trigger-btn gm-save-btn" type="button" @click="saveSelections" :disabled="changedCount === 0">
          確認儲存
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { usePortfolioStore } from '../stores/portfolio';
import { useToast } from '../composables/useToast';
import { CONFIG } from '../config';

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const { addToast } = useToast();

const groupRenameMap = reactive({});
const selectedGroup = ref('');
const recordSelections = reactive({});

const editableGroups = computed(() => portfolioStore.availableGroups.filter(x => x !== 'all'));
const canEditRecords = computed(() => !!selectedGroup.value && portfolioStore.records.length > 0);

const normalizeTags = (tagString = '') => tagString
  .split(/[,;]/)
  .map(tag => tag.trim())
  .filter(Boolean);

const hasGroupTag = (record, groupName) => {
  if (!groupName) return false;
  return normalizeTags(record.tag || '').includes(groupName);
};

const initializeSelections = () => {
  if (!selectedGroup.value) return;
  for (const record of portfolioStore.records) {
    recordSelections[record.id] = hasGroupTag(record, selectedGroup.value);
  }
};

watch(editableGroups, (groups) => {
  if (!groups.includes(selectedGroup.value)) {
    selectedGroup.value = '';
  }
}, { immediate: true });

watch(selectedGroup, () => {
  initializeSelections();
});

watch(
  () => portfolioStore.records,
  () => {
    initializeSelections();
  }
);

const changedCount = computed(() => {
  if (!selectedGroup.value) return 0;
  return portfolioStore.records.reduce((count, record) => {
    const original = hasGroupTag(record, selectedGroup.value);
    const current = recordSelections[record.id] || false;
    return count + (original !== current ? 1 : 0);
  }, 0);
});

const rowChanged = (record) => {
  if (!selectedGroup.value) return false;
  const original = hasGroupTag(record, selectedGroup.value);
  return original !== (recordSelections[record.id] || false);
};

const toggleRecord = (id) => {
  recordSelections[id] = !recordSelections[id];
};

const selectAll = () => {
  for (const record of portfolioStore.records) {
    recordSelections[record.id] = true;
  }
};

const clearAll = () => {
  for (const record of portfolioStore.records) {
    recordSelections[record.id] = false;
  }
};

const renameGroup = async (oldName) => {
  const newName = groupRenameMap[oldName]?.trim();
  if (!newName || !confirm(`確定將 "${oldName}" 更名為 "${newName}" 嗎？`)) return;

  addToast('正在批次更新紀錄...', 'info');
  try {
    const targetRecords = portfolioStore.records.filter(r => {
      const tags = (r.tag || '').split(/[,;]/).map(t => t.trim());
      return tags.includes(oldName);
    });

    let count = 0;
    for (const r of targetRecords) {
      let tags = (r.tag || '').split(/[,;]/).map(t => t.trim());
      tags = tags.map(t => (t === oldName ? newName : t));
      const newTagStr = tags.join(', ');

      await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authStore.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...r, tag: newTagStr })
      });
      count++;
    }

    groupRenameMap[oldName] = '';
    addToast(`成功更新 ${count} 筆紀錄`, 'success');
    await portfolioStore.fetchRecords();
    await portfolioStore.triggerUpdate();
  } catch (e) {
    addToast('更新失敗', 'error');
  }
};

const saveSelections = async () => {
  if (!selectedGroup.value) return;
  if (!confirm(`確定更新 "${selectedGroup.value}" 的交易歸屬嗎？`)) return;

  addToast('正在更新群組歸屬...', 'info');
  try {
    let count = 0;
    for (const record of portfolioStore.records) {
      const shouldInclude = recordSelections[record.id] || false;
      const hasTag = hasGroupTag(record, selectedGroup.value);
      if (shouldInclude === hasTag) continue;

      const tags = normalizeTags(record.tag || '');
      const updatedTags = shouldInclude
        ? Array.from(new Set([...tags, selectedGroup.value]))
        : tags.filter(tag => tag !== selectedGroup.value);
      const newTagStr = updatedTags.join(', ');

      await fetch(`${CONFIG.API_BASE_URL}/api/records`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authStore.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...record, tag: newTagStr })
      });
      count++;
    }

    addToast(`成功更新 ${count} 筆紀錄`, 'success');
    await portfolioStore.fetchRecords();
    await portfolioStore.triggerUpdate();
  } catch (e) {
    addToast('更新失敗', 'error');
  }
};
</script>

<style scoped>
.gm-card {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.gm-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.gm-title {
  margin: 0;
  font-size: 1.15rem;
}

.gm-subtitle {
  margin: 6px 0 0;
  color: var(--text-sub);
  font-size: 0.9rem;
}

.gm-section {
  border: 1px solid var(--border-color);
  border-radius: 14px;
  padding: 16px;
  background:
    linear-gradient(140deg, color-mix(in srgb, var(--primary) 7%, transparent), transparent 45%),
    var(--bg-card);
  box-shadow: var(--shadow-sm);
}

.gm-section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.gm-section-title {
  margin: 0;
  font-size: 0.98rem;
}

.gm-section-hint,
.gm-empty-hint {
  font-size: 0.82rem;
  color: var(--text-sub);
}

.group-list {
  display: grid;
  gap: 10px;
}

.group-item {
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 12px;
  display: grid;
  gap: 10px;
  background: var(--bg-secondary);
}

.group-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.group-label {
  font-size: 0.78rem;
  color: var(--text-sub);
}

.group-name {
  font-family: 'JetBrains Mono', monospace;
  color: var(--primary);
  font-size: 0.9rem;
  font-weight: 700;
}

.group-input-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
}

.group-item input {
  min-width: 0;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--text-main);
  padding: 9px 12px;
}

.gm-selection-header {
  display: flex;
  justify-content: space-between;
  align-items: end;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 8px;
}

.gm-select-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gm-select-wrap label {
  font-size: 0.8rem;
  color: var(--text-sub);
}

.gm-select-wrap select {
  min-width: 220px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--text-main);
  padding: 8px 10px;
}

.gm-toolbar {
  display: flex;
  gap: 8px;
}

.gm-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.gm-help {
  margin: 0;
  color: var(--text-sub);
  font-size: 0.85rem;
}

.gm-metrics {
  display: flex;
  align-items: center;
  gap: 8px;
}

.gm-counter {
  font-size: 0.8rem;
  color: var(--text-sub);
  font-family: 'JetBrains Mono', monospace;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  padding: 3px 9px;
  background: var(--bg-secondary);
}

.gm-counter-highlight {
  color: var(--primary);
  border-color: color-mix(in srgb, var(--primary) 40%, var(--border-color));
}

.gm-counter-highlight.is-zero {
  color: var(--text-sub);
}

.gm-records {
  max-height: 420px;
  overflow: auto;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--bg-card);
}

.gm-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.gm-table th,
.gm-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
  font-size: 0.9rem;
  white-space: nowrap;
}

.gm-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--bg-secondary);
  color: var(--text-sub);
  font-size: 0.78rem;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.gm-table tr.changed {
  background: color-mix(in srgb, var(--primary) 9%, transparent);
}

.checkbox-col {
  width: 72px;
  text-align: center;
}

.gm-checkbox {
  position: relative;
  display: inline-flex;
  width: 18px;
  height: 18px;
}

.gm-checkbox input {
  position: absolute;
  opacity: 0;
  inset: 0;
  cursor: pointer;
}

.gm-checkbox span {
  width: 18px;
  height: 18px;
  border-radius: 5px;
  border: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.gm-checkbox input:checked + span {
  border-color: var(--primary);
  background: var(--primary);
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.9);
}

.symbol-badge {
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(var(--primary-rgb), 0.14);
  color: var(--primary);
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
}

.type-badge {
  font-size: 0.76rem;
  padding: 3px 8px;
  border-radius: 999px;
  font-weight: 700;
}

.type-badge.buy {
  color: var(--primary);
  background: rgba(var(--primary-rgb), 0.16);
}

.type-badge.sell {
  color: var(--success);
  background: rgba(16, 185, 129, 0.14);
}

.type-badge.div {
  color: var(--warning);
  background: rgba(245, 158, 11, 0.14);
}

.gm-tag {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-sub);
}

.gm-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  gap: 10px;
}

.gm-change {
  color: var(--primary);
  font-weight: 700;
}

.gm-no-change {
  color: var(--text-sub);
  font-size: 0.9rem;
}

.text-right {
  text-align: right;
}

.font-mono {
  font-family: 'JetBrains Mono', monospace;
}

.empty-state {
  text-align: center;
  padding: 28px 16px;
  color: var(--text-sub);
}

@media (max-width: 820px) {
  .gm-header {
    flex-direction: column;
    align-items: stretch;
  }

  .gm-section-title-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .group-input-row {
    grid-template-columns: 1fr;
  }

  .gm-select-wrap,
  .gm-select-wrap select {
    min-width: 0;
    width: 100%;
  }

  .gm-toolbar {
    width: 100%;
    justify-content: flex-end;
  }

  .gm-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .gm-save-btn {
    width: 100%;
    height: auto;
    border-radius: 10px;
    padding: 10px 14px;
    justify-content: center;
  }

  .gm-metrics {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
