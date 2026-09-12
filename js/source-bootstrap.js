/* Bloodwych ZX default-source bootstrap.
 *
 * Hosted/served builds automatically load the checked-in Level Data TZX and
 * preload the checked-in Game TZX.  The existing file inputs remain explicit
 * overrides for modified tapes.  Browsers deliberately block repository-local
 * fetch() from file:// pages, so file mode points the user at START-LOCAL.command
 * / tools/serve_editor.py instead of pretending an automatic preload succeeded.
 */
(function (global) {
  'use strict';
  if (typeof document === 'undefined') return;

  const DEFAULT_LEVEL_LABEL = 'Bloodwych - Level Data [ZX Spectrum].tzx';
  const DEFAULT_GAME_LABEL = 'Bloodwych - The Game [ZX Spectrum].tzx';
  const RAW_GITHUB_BASE = 'https://raw.githubusercontent.com/HoraceAndTheSpider/Bloodwych-z80/main/';
  const DEFAULT_LEVEL_PATH = 'data/Bloodwych - Level Data [ZX Spectrum].tzx';

  function status(message, kind) {
    const el = document.getElementById('status');
    if (!el) return;
    el.textContent = message;
    if (kind) el.className = `status ${kind}`;
  }

  async function preloadDefaults() {
    const levelButton = document.getElementById('loadBundled');
    const gameName = document.getElementById('gameSourceName');

    const fileMode = !!(global.location && global.location.protocol === 'file:');
    status(fileMode ? 'Loading default Level Data + Game TZX from GitHub main…' : 'Loading default Level Data + Game TZX from this repository…', '');

    if (fileMode) {
      try {
        const url = RAW_GITHUB_BASE + DEFAULT_LEVEL_PATH.split('/').map(encodeURIComponent).join('/');
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const input = document.getElementById('tapFile');
        if (!input || typeof File === 'undefined' || typeof DataTransfer === 'undefined') throw new Error('Browser cannot pass the downloaded Level TZX to the existing loader.');
        const file = new File([await response.arrayBuffer()], DEFAULT_LEVEL_LABEL, {type:'application/octet-stream'});
        const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files;
        input.dispatchEvent(new Event('change', {bubbles:true}));
      } catch (err) {
        status(`Could not preload the default Level TZX from GitHub: ${err.message}. Use OPEN LEVEL TAPE, or START-LOCAL.command to serve the local repository.`, 'warn');
      }
    } else if (levelButton) levelButton.click();

    try {
      if (global.BWDungeonRenderer && typeof global.BWDungeonRenderer.preloadBundledSources === 'function') {
        await global.BWDungeonRenderer.preloadBundledSources();
      }
      if (gameName && (!global.BWDungeonRenderer || !global.BWDungeonRenderer.activeGameSourceName)) {
        gameName.textContent = `Game: ${DEFAULT_GAME_LABEL}`;
      }
    } catch (err) {
      if (gameName) gameName.textContent = `Game: preload failed — ${err.message}`;
      if (global.console) console.error(err);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', preloadDefaults, {once:true});
  else setTimeout(preloadDefaults, 0);

  global.BWSourceBootstrap = {preloadDefaults, DEFAULT_LEVEL_LABEL, DEFAULT_GAME_LABEL};
})(typeof window !== 'undefined' ? window : globalThis);
