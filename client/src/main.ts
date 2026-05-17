// Vue 3应用入口文件
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import './assets/style.css';
import VXETable from 'vxe-table';
import 'vxe-table/lib/style.css';
import VxeUITooltip from 'vxe-pc-ui/lib/tooltip';
import 'vxe-pc-ui/lib/style.css';

const app = createApp(App);
app.use(router);
app.use(VXETable);
app.use(VxeUITooltip);
app.mount('#app');
