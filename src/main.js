import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import './style.css'
import App from './App.vue'

// createApp(App)：建立 Vue 應用，App.vue 是整個前端的根元件。
// use(Antd)：註冊 Ant Design Vue，讓所有元件都可以使用 a-button、a-card 等元件。
// mount('#app')：把 Vue 畫面掛載到 index.html 的 <div id="app"></div>。
createApp(App).use(Antd).mount('#app')
