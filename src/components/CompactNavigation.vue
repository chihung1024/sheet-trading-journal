<template>
  <nav class="compact-navigation" aria-label="主要功能">
    <button
      v-for="view in primaryViews"
      :key="view.key"
      type="button"
      class="compact-nav-item"
      :class="{ active: activeView === view.key }"
      :aria-current="activeView === view.key ? 'page' : undefined"
      @click="navigate(view.key)"
    >
      <span class="compact-nav-label">{{ compactLabel(view) }}</span>
      <span
        v-if="view.key === 'dividends' && pendingDividendsCount > 0"
        class="tab-badge compact-nav-badge"
        :aria-label="`${pendingDividendsCount} 筆待處理配息`"
      >
        {{ pendingDividendsCount }}
      </span>
    </button>

    <div ref="moreContainerRef" class="compact-nav-more">
      <button
        ref="moreButtonRef"
        type="button"
        class="compact-nav-item compact-nav-more-trigger"
        :class="{ active: isMoreActive }"
        aria-haspopup="true"
        :aria-expanded="moreOpen ? 'true' : 'false'"
        :aria-label="moreTriggerLabel"
        @click="toggleMore"
      >
        <span class="compact-nav-label">更多</span>
        <span aria-hidden="true" class="compact-nav-chevron">⌄</span>
      </button>

      <div
        v-if="moreOpen"
        class="compact-nav-more-panel"
        aria-label="更多功能"
      >
        <button
          v-for="view in moreViews"
          :key="view.key"
          type="button"
          class="compact-nav-more-item"
          :class="{ active: activeView === view.key }"
          :aria-current="activeView === view.key ? 'page' : undefined"
          @click="navigate(view.key)"
        >
          <span>{{ view.label }}</span>
          <span v-if="activeView === view.key" aria-hidden="true">✓</span>
        </button>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

const props = defineProps({
  views: {
    type: Array,
    required: true,
  },
  activeView: {
    type: String,
    required: true,
  },
  pendingDividendsCount: {
    type: Number,
    default: 0,
  },
});

const emit = defineEmits(['navigate']);

// Presentation grouping only. Destination identity remains owned by App.vue's
// single `views` catalog and `activeView` / URL / localStorage contract.
const COMPACT_PRIMARY_ORDER = Object.freeze([
  'overview',
  'holdings',
  'records',
  'dividends',
]);
const COMPACT_PRIMARY_SET = new Set(COMPACT_PRIMARY_ORDER);
const COMPACT_LABELS = Object.freeze({
  overview: '總覽',
  holdings: '持倉',
  records: '交易',
  dividends: '配息',
});

const moreOpen = ref(false);
const moreButtonRef = ref(null);
const moreContainerRef = ref(null);

const primaryViews = computed(() => COMPACT_PRIMARY_ORDER
  .map(key => props.views.find(view => view?.key === key))
  .filter(Boolean));

const moreViews = computed(() => props.views
  .filter(view => view?.key && !COMPACT_PRIMARY_SET.has(view.key)));

const currentMoreView = computed(() => moreViews.value
  .find(view => view.key === props.activeView) || null);

const isMoreActive = computed(() => currentMoreView.value !== null);
const moreTriggerLabel = computed(() => currentMoreView.value
  ? `更多功能，目前：${currentMoreView.value.label}`
  : '更多功能');

const compactLabel = (view) => COMPACT_LABELS[view.key] || view.label;

const closeMore = ({ restoreFocus = false } = {}) => {
  if (!moreOpen.value) return;
  moreOpen.value = false;
  if (restoreFocus) {
    nextTick(() => moreButtonRef.value?.focus?.({ preventScroll: true }));
  }
};

const toggleMore = () => {
  moreOpen.value = !moreOpen.value;
};

const navigate = (viewKey) => {
  if (!props.views.some(view => view?.key === viewKey)) return;
  moreOpen.value = false;
  emit('navigate', viewKey);
};

const handlePointerDown = (event) => {
  if (!moreOpen.value || moreContainerRef.value?.contains(event.target)) return;
  closeMore();
};

const handleKeyDown = (event) => {
  if (event.key !== 'Escape' || !moreOpen.value) return;
  event.preventDefault();
  closeMore({ restoreFocus: true });
};

watch(() => props.activeView, () => {
  moreOpen.value = false;
});

onMounted(() => {
  document.addEventListener('pointerdown', handlePointerDown);
  document.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', handlePointerDown);
  document.removeEventListener('keydown', handleKeyDown);
});
</script>
