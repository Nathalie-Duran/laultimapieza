(async () => {
  'use strict';
  const documents=document.querySelectorAll('[data-documento]');
  if(!documents.length)return;
  try {
    const response=await fetch('/api/billing/config',{cache:'no-store',credentials:'omit'});
    if(!response.ok)return;
    const config=await response.json();
    for(const entry of documents){
      const value=config[entry.dataset.documento];
      if(typeof value!=='string'||!value.trim())continue;
      let url;
      try { url=new URL(value,location.origin); } catch { continue; }
      if(url.protocol!=='https:'||url.username||url.password)continue;
      if(url.hostname.replace(/^www\./,'')===location.hostname.replace(/^www\./,'')&&url.pathname===location.pathname)continue;
      entry.querySelector('a').href=url.href;
      entry.hidden=false;
    }
  } catch { /* The published guides and the support address remain available offline. */ }
})();
