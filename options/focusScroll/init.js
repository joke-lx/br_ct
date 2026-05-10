/**
 * Options iframe pages initializer.
 *
 * Kept as an external module to satisfy MV3 CSP (no inline scripts).
 */

import { initFocusScrollAgent } from './iframeScrollAgent.js';

initFocusScrollAgent();
