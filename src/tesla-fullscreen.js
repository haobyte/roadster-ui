export function cinemaLinks(base) {
  const target = new URL('./', base);
  // Only return to this app; do not accept arbitrary redirect destinations.
  target.search = ''; target.hash = '';
  // 1905 reads the literal string between "//" and the first "/" before it
  // navigates. A subdirectory (or even a trailing slash) changes that check.
  // Keep this literal: new URL(...).href would insert a slash before "?".
  // The server accepts this ONE root query and returns to /roadster/.
  const domesticTarget = target.origin + '?www.1905.com';
  const bridge = 'https://www.1905.com/api/redirec.html?redirect_url=' + domesticTarget;
  return {
    tencent: 'https://v.qq.com/search_redirect.html?url=' + bridge
  };
}

export function initFullscreen({beforeLeave, native = location.hostname.endsWith('.github.io')}) {
  if (native) {
    // Project Pages has no server-side root redirect for the cinema bridge.
    // Stay on the current project URL using the browser Fullscreen API.
    const root = document.documentElement;
    for (const id of ['fullscreen', 'cinema-open']) {
      const button = document.getElementById(id);
      button.disabled = typeof root.requestFullscreen !== 'function';
      button.title = button.disabled ? 'Fullscreen is unavailable in this browser' : 'Browser fullscreen';
      if (id === 'cinema-open') button.textContent = 'Browser fullscreen';
      button.onclick = async () => {
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else await root.requestFullscreen();
        } catch {
          button.title = 'Fullscreen was blocked by this browser';
        }
      };
    }
    return;
  }
  const {tencent} = cinemaLinks(location.href);
  const enter = () => {
    beforeLeave();
    location.assign(tencent);
  };
  // One action in both entry points. No provider picker or UA-dependent flow.
  for (const id of ['fullscreen', 'cinema-open']) {
    const button = document.getElementById(id);
    button.onclick = enter;
    button.title = '腾讯视频全屏 · 驻车后使用';
  }
}
