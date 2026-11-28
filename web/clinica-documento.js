// The embedded reader already supplies a return button.
if (window.self === window.top) {
  const record = document.querySelector('.correo, main');
  if (record) {
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Navegación del expediente');
    const back = document.createElement('a');
    back.href = '/cinta-87.html?archivo=1';
    back.textContent = '← Volver al archivo de Marta y Tomás';
    back.style.cssText = 'display:inline-flex;align-items:center;min-height:44px;padding:0 1rem;background:#172723;color:#fff3d3;font:600 1rem/1.4 system-ui;text-underline-offset:.2em';
    nav.append(back);
    record.prepend(nav);
  }
}
