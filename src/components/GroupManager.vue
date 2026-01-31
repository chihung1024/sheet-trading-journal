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
  </div>
</template>

<script setup>
import { reactive } from 'vue';
import { useAuthStore } from '../stores/auth';
import { usePortfolioStore } from '../stores/portfolio';
import { useToast } from '../composables/useToast';
import { CONFIG } from '../config';

defineEmits(['back']);

const authStore = useAuthStore();
const portfolioStore = usePortfolioStore();
const { addToast } = useToast();

const groupRenameMap = reactive({});

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
</style>
