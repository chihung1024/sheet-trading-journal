<template>
  <div class="card">
    <div class="gm-header">
      <h3 class="gm-title">管理策略群組</h3>
      <button class="action-trigger-btn" type="button" @click="$emit('back')">返回</button>
    </div>

    <p class="modal-desc gm-desc">修改群組名稱將會批次更新所有相關的交易紀錄。</p>

    <div class="group-list">
      <div v-for="g in portfolioStore.availableGroups.filter(x => x !== 'all')" :key="g" class="group-item">
        <input type="text" v-model="groupRenameMap[g]" :placeholder="g" />
        <button
          class="btn-sm"
          type="button"
          @click="renameGroup(g)"
          :disabled="!groupRenameMap[g] || groupRenameMap[g] === g"
        >
          更名
        </button>
      </div>
    </div>

    <div class="gm-divider"></div>

    <div class="gm-selection">
      <div class="gm-selection-header">
        <div class="gm-select">
          <label for="gm-group-select">選擇群組：</label>
          <select id="gm-group-select" v-model="selectedGroup">
            <option
              v-for="g in editableGroups"
              :key="g"
              :value="g"
            >
              {{ g }}
            </option>
          </select>
        </div>
        <div class="gm-selection-actions">
          <button class="btn-sm" type="button" @click="selectAll">全選</button>
          <button class="btn-sm" type="button" @click="clearAll">取消全選</button>
        </div>
      </div>

      <p class="gm-help">勾選交易紀錄作為此群組的計算基礎；變更後請按下確認儲存。</p>

      <div class="gm-records">
        <table class="gm-table">
          <thead>
            <tr>
              <th>納入</th>
              <th>日期</th>
              <th>標的</th>
              <th>類型</th>
              <th>數量</th>
              <th>價格</th>
              <th>群組標籤</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in portfolioStore.records" :key="record.id">
              <td>
                <input
                  type="checkbox"
                  :checked="recordSelections[record.id] || false"
                  @change="toggleRecord(record.id)"
                />
              </td>
              <td>{{ record.txn_date }}</td>
              <td>{{ record.symbol }}</td>
              <td>{{ record.txn_type }}</td>
              <td>{{ record.qty }}</td>
              <td>{{ record.price }}</td>
              <td class="gm-tag">{{ record.tag || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="gm-footer">
        <span v-if="changedCount > 0" class="gm-change">已變更 {{ changedCount }} 筆</span>
        <button class="action-trigger-btn" type="button" @click="saveSelections" :disabled="changedCount === 0">
          確認儲存
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { usePortfolioStore } from '../stores/portfolio';
import { useToast } from '../composables/useToast';
import { CONFIG } from '../config';

defineEmits(['back']);

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const { addToast } = useToast();

const groupRenameMap = reactive({});
const selectedGroup = ref('');
const recordSelections = reactive({});

const editableGroups = computed(() => portfolioStore.availableGroups.filter(x => x !== 'all'));

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
  if (!selectedGroup.value && groups.length > 0) {
    selectedGroup.value = groups[0];
  }
});

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
  const newName = groupRenameMap[oldName];
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
          'Authorization': `Bearer ${authStore.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...r, tag: newTagStr })
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
.gm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.gm-title {
  margin: 0;
}

.gm-desc {
  margin-top: 0;
}

.gm-divider {
  height: 1px;
  background: var(--card-border, rgba(255, 255, 255, 0.08));
  margin: 20px 0;
}

.gm-selection-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.gm-select {
  display: flex;
  align-items: center;
  gap: 8px;
}

.gm-select select {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--card-border, rgba(255, 255, 255, 0.08));
  background: var(--card-bg, #1a1d24);
  color: inherit;
}

.gm-selection-actions {
  display: flex;
  gap: 8px;
}

.gm-help {
  margin: 8px 0 12px;
  color: var(--text-muted, rgba(255, 255, 255, 0.7));
}

.gm-records {
  max-height: 360px;
  overflow: auto;
  border: 1px solid var(--card-border, rgba(255, 255, 255, 0.08));
  border-radius: 12px;
}

.gm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.gm-table th,
.gm-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--card-border, rgba(255, 255, 255, 0.08));
  white-space: nowrap;
}

.gm-table th {
  position: sticky;
  top: 0;
  background: var(--card-bg, #1a1d24);
  z-index: 1;
}

.gm-tag {
  color: var(--text-muted, rgba(255, 255, 255, 0.7));
}

.gm-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
}

.gm-change {
  color: var(--accent, #9ddcff);
  font-size: 14px;
}
</style>
