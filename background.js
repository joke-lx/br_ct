// background.js
// 使用 ES Modules 导入功能
import {
    setupTabUpdateListener,
    setupMessageListener as setupAIProcessorListener
} from './backgroudtask/ai_platform_processor.js';
import { setupFuncCommandListener, setupMessageListener as setupFuncExecutorListener } from './backgroudtask/func_executor.js';
import { setTabTransListener } from './backgroudtask/gotoServer.js';
import { startServer } from './backgroudtask/word_http_server.js';

// 初始化标签页更新监听器
setupTabUpdateListener();
// 启动所有监听器
setupAIProcessorListener();       // AI 平台消息监听

setupFuncCommandListener();
setupFuncExecutorListener();      // 函数执行消息监听

setTabTransListener();
startServer();