(() => {
  'use strict';
  const controls = [
    {key:'largeType', label:'Aumentar el tamaño del texto'},
    {key:'still', label:'Reducir animaciones y transiciones'}
  ];
  const key = 'lup-display-preferences-v1';
  const values = {};
  try {
    const saved=JSON.parse(localStorage.getItem(key));
    for(const item of controls)values[item.key]=saved?.[item.key]===true;
  } catch {}
  const apply = () => {
    for (const item of controls) {
      document.documentElement.classList.toggle('lup-' + item.key, values[item.key] === true);
    }
  };
  apply();
  class DisplayPreferences extends HTMLElement {
    connectedCallback() {
      if (this.childElementCount) return;
      if(!document.querySelector('link[data-display-settings]')){
        const style=document.createElement('link');
        style.rel='stylesheet';
        style.href='/accesibilidad.css';
        style.dataset.displaySettings='';
        document.head.append(style);
      }
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = 'Lectura y movimiento en este dispositivo';
      fieldset.append(legend);
      const status = document.createElement('p');
      status.setAttribute('role','status');
      status.setAttribute('aria-live','polite');
      for (const item of controls) {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = values[item.key] === true;
        input.addEventListener('change', () => {
          values[item.key] = input.checked;
          apply();
          try {
            localStorage.setItem(key, JSON.stringify(values));
            status.textContent = 'Preferencias guardadas en este dispositivo.';
          } catch { status.textContent = 'Preferencias aplicadas para esta visita.'; }
        });
        label.append(input,document.createTextNode(' ' + item.label));
        fieldset.append(label);
      }
      const nav=document.createElement('nav');
      nav.setAttribute('aria-label','Ayuda y navegación');
      for(const [label,url] of [['Volver al inicio','/#inicio'],['Ayuda y contacto','/ayuda.html']]){
        const link=document.createElement('a');
        link.textContent=label;link.href=url;
        nav.append(link);
      }
      this.append(fieldset,status,nav);
    }
  }
  customElements.define('display-preferences', DisplayPreferences);
})();
