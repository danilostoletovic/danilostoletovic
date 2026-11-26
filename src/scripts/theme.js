(() => {
  const key = 'color-theme';
  const modes = ['system', 'light', 'dark'];
  let mode = 'system';
  try {
    const saved = localStorage.getItem(key);
    if (modes.includes(saved)) mode = saved;
  } catch {}
  const apply = () => {
    if (mode === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = mode;
  };
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('theme-switch');
    if (!button) return;
    const label = () => {
      const next = modes[(modes.indexOf(mode) + 1) % modes.length];
      button.title = `Theme: ${mode}. Switch to ${next}.`;
      button.setAttribute('aria-label', button.title);
    };
    label();
    button.hidden = false;
    button.addEventListener('click', () => {
      mode = modes[(modes.indexOf(mode) + 1) % modes.length];
      apply();
      label();
      try { localStorage.setItem(key, mode); } catch {}
    });
  }, { once: true });
})();
