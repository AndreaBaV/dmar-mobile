let vconsoleLoaded = false;

/**
 * Carga vConsole bajo demanda (visible en iPhone sin Mac).
 * z-index máximo para que quede por encima del resto de la UI.
 */
export async function openDebugConsole(): Promise<void> {
  if (vconsoleLoaded || document.getElementById('__vconsole')) {
    const el = document.getElementById('__vconsole') as HTMLElement | null;
    if (el) el.style.zIndex = '2147483646';
    return;
  }

  const mod = await import('vconsole');
  const VConsole = mod.default;
  new VConsole({ theme: 'dark', maxLogNumber: 2000 });
  vconsoleLoaded = true;

  requestAnimationFrame(() => {
    const el = document.getElementById('__vconsole') as HTMLElement | null;
    if (el) el.style.zIndex = '2147483646';
  });
}
