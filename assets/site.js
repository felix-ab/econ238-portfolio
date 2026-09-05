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
