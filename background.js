// background.js
// 使用 ES Modules 导入功能
import { setupTabUpdateListener, setupMessageListener as setupAIProcessorListener } from './backgroudtask/ai_platform_processor.js';
import { setupFuncCommandListener, setupMessageListener as setupFuncExecutorListener } from './backgroudtask/func_executor.js';
import { setTabTransListener } from './backgroudtask/gotoServer.js';
import { startServer } from './backgroudtask/word_http_server.js';
// import { setupClipboardToFileListener } from './backgroudtask/clipboard2file.js';

// 启动所有监听器
setupTabUpdateListener();         // AI 平台标签页更新监听
setupAIProcessorListener();       // AI 平台消息监听

setupFuncCommandListener();       // 快捷键命令监听
setupFuncExecutorListener();      // 函数执行消息监听

setTabTransListener();            // 标签页跳转消息监听
startServer();                    // 单词 HTTP 服务器 (包含消息监听)
// setupClipboardToFileListener();