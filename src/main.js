import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './index.css' // <--- 新增這一行

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
