(() => {
  const button = document.querySelector('.theme-control');
  if (!button) return;
  const modes = ['system', 'light', 'dark'];
  let mode = document.documentElement.dataset.theme || 'system';
  function render() {
    if (mode === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = mode;
    button.querySelector('span').textContent = mode === 'system' ? 'Auto' : mode[0].toUpperCase() + mode.slice(1);
    const next = modes[(modes.indexOf(mode) + 1) % modes.length];
    button.setAttribute('aria-label', `Appearance: ${mode}. Activate to switch to ${next}.`);
  }
  button.addEventListener('click', () => {
    mode = modes[(modes.indexOf(mode) + 1) % modes.length];
    try { localStorage.setItem('portfolio-theme', mode); } catch (_) {}
    render();
  });
  render();
  button.hidden = false;
})();

(() => {
  const folders = [...document.querySelectorAll('.folder')];
  const panels = [...document.querySelectorAll('.folder-panel')];
  function closeAll() {
    folders.forEach(button => button.setAttribute('aria-expanded', 'false'));
    panels.forEach(panel => { panel.hidden = true; });
  }
  folders.forEach(button => button.addEventListener('click', () => {
    const wasOpen = button.getAttribute('aria-expanded') === 'true';
    closeAll();
    if (!wasOpen) {
      button.setAttribute('aria-expanded', 'true');
      document.getElementById(button.getAttribute('aria-controls')).hidden = false;
    }
  }));
  panels.forEach(panel => {
    const close = () => {
      const button = folders.find(item => item.getAttribute('aria-controls') === panel.id);
      closeAll();
      button.focus();
    };
    panel.querySelector('.close-folder').addEventListener('click', close);
    panel.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    });
  });
})();
