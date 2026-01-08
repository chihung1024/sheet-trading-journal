import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

// 引入動畫樣式
import './styles/animations.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.mount('#app');

// PWA 相關代碼可以在 App.vue 中使用 usePWA composable
