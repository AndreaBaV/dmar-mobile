/** Abre el HTML en una ventana y dispara el diálogo de impresión del sistema. */
export function printHtmlInNewWindow(html: string): void {
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) {
    window.alert('No se pudo abrir la ventana de impresión. Permita ventanas emergentes para este sitio.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  const trigger = () => {
    try {
      w.print();
    } catch {
      /* */
    }
  };
  if (w.document.readyState === 'complete') {
    setTimeout(trigger, 0);
  } else {
    w.onload = () => setTimeout(trigger, 0);
  }
}
