  // =========================================================================
  // Protokoll
  // =========================================================================
  function logLeeren() { logListe = []; protokollZeichnen(); }
  function protokollZeichnen() {
    const box = $('log');
    box.textContent = '';
    if (!logListe.length) {
      const d = document.createElement('div');
      d.className = 'leermeldung';
      d.textContent = t('log.leer');
      box.appendChild(d);
      return;
    }
    logListe.forEach(e => {
      const d = document.createElement('div');
      if (e.art) d.className = e.art;
      const txt = document.createElement('span');
      txt.className = 'txt';
      txt.textContent = e.text;
      d.appendChild(txt);
      if (e.nodeId) {
        const a = document.createElement('span');
        a.className = 'zeigen';
        a.textContent = t('log.zeigen');
        a.addEventListener('click', () => send({ type: 'fokus', nodeId: e.nodeId }));
        d.appendChild(a);
      }
      if (e.hinweis) {
        const h = document.createElement('div');
        h.className = 'hinw';
        h.textContent = e.hinweis;
        d.appendChild(h);
      }
      box.appendChild(d);
    });
    box.scrollTop = box.scrollHeight;
  }

