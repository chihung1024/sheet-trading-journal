<div class="user-profile" @click="handleLogout" title="點擊登出">
                <img v-if="authStore.user?.picture" :src="authStore.user.picture" class="avatar-img" alt="User">
                <div v-else class="avatar">{{ userInitial }}</div>
                
                <span class="logout-text desktop-only">登出</span>
            </div>
<script setup>
import { ref, onMounted, computed } from 'vue'; // 加入 computed
// ... 其他 imports 保持不變 ...

const authStore = useAuthStore();
// ...

// 計算使用者名稱縮寫
const userInitial = computed(() => {
    return authStore.user?.name ? authStore.user.name.charAt(0).toUpperCase() : 'U';
});

const handleLogout = () => {
    if (confirm("確定要登出 Google 帳號嗎？")) {
        authStore.logout();
    }
};

// ... 其他邏輯保持不變 ...
</script>

<style>
/* ... CSS 保持不變，新增 avatar-img 樣式 ... */
.avatar-img {
    width: 32px; height: 32px; border-radius: 50%;
    border: 1px solid var(--border-color);
}
/* ... */
</style>
