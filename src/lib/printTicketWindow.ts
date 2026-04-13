/**
 * Muestra el diálogo de impresión del sistema con el HTML dado.
 * Usa un iframe oculto para no depender de ventanas emergentes (evita bloqueos y avisos en WebView).
 */
export function printHtmlInNewWindow(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Impresión');
  iframe.setAttribute('aria-hidden', 'true');

  const s = iframe.style;
  s.position = 'fixed';
  s.right = '0';
  s.bottom = '0';
  s.width = '1px';
  s.height = '1px';
  s.border = '0';
  s.opacity = '0';
  s.pointerEvents = 'none';

  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!win || !doc) {
    try {
      iframe.remove();
    } catch {
      /* */
    }
    window.alert('No se pudo preparar la impresión. Intente de nuevo.');
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  let cleaned = false;
  let fallbackTimer: number | undefined;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (fallbackTimer !== undefined) {
      window.clearTimeout(fallbackTimer);
    }
    try {
      win.removeEventListener('afterprint', afterPrint);
    } catch {
      /* */
    }
    try {
      iframe.remove();
    } catch {
      /* */
    }
  };

  const afterPrint = () => {
    cleanup();
  };

  const runPrint = () => {
    try {
      win.addEventListener('afterprint', afterPrint);
      win.focus();
      win.print();
    } catch {
      cleanup();
      window.alert('No se pudo abrir el cuadro de impresión.');
      return;
    }
    // Por si el motor no emite afterprint (poco frecuente), no dejar el iframe colgado para siempre
    fallbackTimer = window.setTimeout(cleanup, 120_000);
  };

  if (doc.readyState === 'complete') {
    requestAnimationFrame(() => setTimeout(runPrint, 0));
  } else {
    win.onload = () => setTimeout(runPrint, 0);
  }
}
