/* Bloodwych ZX map renderer compatibility guard.
 *
 * Two current renderer.js behaviours are isolated while that module is loaded:
 *
 * 1. The MAPS cell-property MutationObserver can self-trigger forever after a
 *    wall cell is selected.  Its callback rewrites .property-flags.textContent;
 *    that write is itself a childList mutation on the subtree being observed.
 *    Gate that one observer to one callback per animation frame.  The first
 *    callback still applies the semantic wall controls; only mutations caused
 *    by that callback in the same frame are suppressed.
 *
 * 2. renderer.js installs a 450 ms cursor-blink timer which redraws the entire
 *    aligned map.  Suppress only that renderer-owned timer.  Selection remains
 *    visible as a static outline and normal app-driven renders are untouched.
 *
 * Optional diagnostics: launch index.html?bwdebug=1 (or #bwdebug).  A small
 * on-screen panel and window.BWDEBUG.dump() record map clicks, renderer timing,
 * observer passes/suppression, errors and whether the event loop resumed.
 */
(function (global) {
  'use strict';
  if (!global || global.__bwMapRendererGuard) return;
  global.__bwMapRendererGuard = true;

  const debugEnabled = !!(global.location && (
    /(?:^|[?&])bwdebug=1(?:&|$)/.test(global.location.search || '') ||
    /(?:^|[?&])debug=1(?:&|$)/.test(global.location.search || '') ||
    /bwdebug/.test(global.location.hash || '')
  ));
  const debugLines = [];
  let debugPre = null;
  function stamp() {
    try { return (global.performance && global.performance.now ? global.performance.now() : Date.now()).toFixed(1); }
    catch (_) { return String(Date.now()); }
  }
  function debugLog(message) {
    if (!debugEnabled) return;
    const line = `${stamp()}  ${message}`;
    debugLines.push(line);
    if (debugLines.length > 120) debugLines.shift();
    if (debugPre) debugPre.textContent = debugLines.slice(-18).join('\n');
    if (global.console && console.debug) console.debug('[BWDEBUG]', message);
  }
  global.BWDEBUG = global.BWDEBUG || {
    enabled: debugEnabled,
    log: debugLog,
    dump: () => debugLines.join('\n')
  };

  const nativeSetInterval = typeof global.setInterval === 'function' ? global.setInterval : null;
  function guardedSetInterval(fn, delay, ...args) {
    if (delay === 450 && typeof fn === 'function') {
      const source = Function.prototype.toString.call(fn);
      if (source.includes('__blinkRedraw') && source.includes('lastRenderState')) {
        global.__bwMapBlinkSuppressed = true;
        debugLog('suppressed renderer 450ms full-map blink interval');
        return 0;
      }
    }
    return nativeSetInterval.call(global, fn, delay, ...args);
  }
  if (nativeSetInterval) global.setInterval = guardedSetInterval;

  const NativeMutationObserver = global.MutationObserver;
  let guardedMutationObserver = null;
  if (typeof NativeMutationObserver === 'function') {
    guardedMutationObserver = function MutationObserverGuard(callback) {
      let cellPropertiesGuard = false;
      let callbackAllowed = true;
      let rearmQueued = false;
      const nativeObserver = new NativeMutationObserver(function (records, observer) {
        if (!cellPropertiesGuard) return callback(records, observer);
        if (!callbackAllowed) {
          debugLog(`cellProperties observer self-mutation suppressed (${records ? records.length : 0} record(s))`);
          return;
        }
        callbackAllowed = false;
        debugLog(`cellProperties observer pass (${records ? records.length : 0} record(s))`);
        try {
          callback(records, observer);
        } finally {
          if (!rearmQueued) {
            rearmQueued = true;
            const rearm = () => { callbackAllowed = true; rearmQueued = false; };
            if (typeof global.requestAnimationFrame === 'function') global.requestAnimationFrame(rearm);
            else global.setTimeout(rearm, 0);
          }
        }
      });
      const nativeObserve = nativeObserver.observe.bind(nativeObserver);
      nativeObserver.observe = function (target, options) {
        if (target && target.id === 'cellProperties' && options && options.childList && options.subtree) {
          cellPropertiesGuard = true;
          global.__bwCellPropertyObserverGuarded = true;
          debugLog('guarded #cellProperties MutationObserver');
        }
        return nativeObserve(target, options);
      };
      return nativeObserver;
    };
    guardedMutationObserver.prototype = NativeMutationObserver.prototype;
    global.MutationObserver = guardedMutationObserver;
  }

  function installDebugUi() {
    if (!debugEnabled || typeof document === 'undefined' || document.getElementById('bwDebugPanel')) return;
    const panel = document.createElement('aside');
    panel.id = 'bwDebugPanel';
    panel.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:99999;width:min(560px,48vw);max-height:42vh;overflow:auto;background:rgba(0,0,0,.94);color:#9ff;font:11px/1.35 ui-monospace,monospace;border:1px solid #39c;padding:7px;box-shadow:0 2px 12px #000;';
    const head = document.createElement('div');
    head.textContent = 'BLOODWYCH DEBUG · ?bwdebug=1';
    head.style.cssText = 'font-weight:700;margin-bottom:5px;color:#fff';
    debugPre = document.createElement('pre');
    debugPre.style.cssText = 'white-space:pre-wrap;margin:0;user-select:text';
    const copy = document.createElement('button');
    copy.type = 'button'; copy.textContent = 'COPY DEBUG';
    copy.style.cssText = 'margin-top:6px;font:inherit';
    copy.addEventListener('click', () => {
      const text = debugLines.join('\n');
      if (global.navigator && navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(()=>{});
    });
    panel.append(head, debugPre, copy);
    document.body.appendChild(panel);
    debugLog('debug panel active');

    const canvas = document.getElementById('map');
    if (canvas) canvas.addEventListener('click', event => {
      debugLog(`MAP CLICK capture client=${Math.round(event.clientX)},${Math.round(event.clientY)}`);
      global.setTimeout(() => debugLog('event loop resumed after map click'), 0);
    }, true);
    global.addEventListener('error', event => debugLog(`ERROR ${event.message || event.error || 'unknown'}`));
    global.addEventListener('unhandledrejection', event => debugLog(`PROMISE ${event.reason && event.reason.message ? event.reason.message : event.reason}`));
  }

  function installRuntimeDebug() {
    if (!debugEnabled || !global.BWRenderer || typeof global.BWRenderer.render !== 'function' || global.BWRenderer.render.__bwDebugWrapped) return;
    const original = global.BWRenderer.render;
    function debugRender() {
      const start = global.performance && global.performance.now ? global.performance.now() : Date.now();
      const options = arguments[4] || {};
      debugLog(`BWRenderer.render start selected=${options.selected ? `${options.selected.x},${options.selected.y}` : 'none'}`);
      try {
        return original.apply(this, arguments);
      } finally {
        const end = global.performance && global.performance.now ? global.performance.now() : Date.now();
        debugLog(`BWRenderer.render end ${(end-start).toFixed(1)}ms`);
      }
    }
    debugRender.__bwDebugWrapped = true;
    global.BWRenderer.render = debugRender;
    debugLog('runtime renderer timing hook installed');
  }

  global.__bwRestoreMapTimerGuard = function () {
    if (nativeSetInterval && global.setInterval === guardedSetInterval) global.setInterval = nativeSetInterval;
    if (guardedMutationObserver && global.MutationObserver === guardedMutationObserver) global.MutationObserver = NativeMutationObserver;
    delete global.__bwRestoreMapTimerGuard;
    if (debugEnabled) global.setTimeout(installRuntimeDebug, 0);
  };

  if (typeof document !== 'undefined' && document.addEventListener) {
    // The scripts are at the end of <body>, so the map already exists; installing
    // immediately gives the debug capture listener priority over app.js.
    installDebugUi();
    document.addEventListener('DOMContentLoaded', () => {
      installDebugUi();
      if (global.__bwRestoreMapTimerGuard) global.__bwRestoreMapTimerGuard();
      if (debugEnabled) global.setTimeout(installRuntimeDebug, 0);
    }, {once:true});
  }
})(typeof window !== 'undefined' ? window : globalThis);
