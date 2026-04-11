// background.js
// 使用 ES Modules 导入功能
console.log('[Background] Service Worker 启动');
import {
    setupTabUpdateListener,
    setupMessageListener as setupAIProcessorListener
} from './backgroudtask/ai_platform_processor.js';
import { setupFuncCommandListener, setupMessageListener as setupFuncExecutorListener } from './backgroudtask/func_executor.js';
import { setTabTransListener, initContextMenu } from './backgroudtask/gotoServer.js';
import { startServer } from './backgroudtask/word_http_server.js';
import { init as initVideoPlaneServer } from './backgroudtask/video_plane_server.js';
import { initBackupService, setupBackupMessageListener } from './backgroudtask/backupService.js';
import { setupTranslationModule } from './backgroudtask/translation/index.js';

// 初始化标签页更新监听器
setupTabUpdateListener();
console.log('[Background] setupTabUpdateListener 完成');

// 启动所有监听器
setupAIProcessorListener();       // AI 平台消息监听
console.log('[Background] setupAIProcessorListener 完成');

setupFuncCommandListener();
console.log('[Background] setupFuncCommandListener 完成');

setupFuncExecutorListener();      // 函数执行消息监听
console.log('[Background] setupFuncExecutorListener 完成');

setTabTransListener();
startServer();

// 初始化视频片段播放器配置服务器
initVideoPlaneServer();

// 初始化右键菜单
initContextMenu();

// 初始化备份服务
initBackupService().catch(error => {
  console.error('[Background] 初始化备份服务失败:', error);
});
setupBackupMessageListener();

// 初始化翻译/OCR模块
setupTranslationModule();