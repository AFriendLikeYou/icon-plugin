  // =========================================================================
  // Protokoll — nach Icon gruppiert, Filter, Suche, Kopieren
  // =========================================================================
  // Die Nachricht `log` trägt seit Runde 4 zusätzlich `name`, `N` und
  // `schwere`. 95-nachrichten.js legt den Eintrag an (art/text/hinweis/nodeId);
  // der Handler hier ergänzt die neuen Felder am zuletzt angelegten Eintrag.
  let logFilter = 'alle';        // alle | err | warn | info | ok
  let logSuche = '';
  let logZu = {};                // Gruppenname → true, wenn zugeklappt
  let logMalGeplant = false;

  bei('log', m => {
    const e = logListe[logListe.length - 1];
    if (e) {
      e.name = m.name || '';
      e.N = (m.N == null ? null : m.N);
      e.schwere = m.schwere || '';
      e.code = m.code || '';
    }
    protokollZeichnen();
  });

  function logLeeren() { logListe = []; logZu = {}; protokollZeichnen(); }

  // Zeichnen wird auf einen Frame gebündelt: bei 76 Icons kommen Logzeilen
  // im Bündel, jede einzeln zu rendern wäre verschwendet.
  function protokollZeichnen() {
    if (logMalGeplant) return;
    logMalGeplant = true;
    requestAnimationFrame(() => { logMalGeplant = false; protokollMalen(); });
  }

  function logGruppe(e) { return e.name || t('log.allgemein'); }
  function logArt(e) { return e.art || 'info'; }
  function logPasst(e) {
    if (logFilter !== 'alle' && logArt(e) !== logFilter) return false;
    if (!logSuche) return true;
    const s = (e.text + ' ' + (e.hinweis || '') + ' ' + (e.name || '') + ' ' + (e.code || '')).toLowerCase();
    return s.indexOf(logSuche) >= 0;
  }
  // Gruppen in der Reihenfolge des ersten Auftretens.
  function logGruppen() {
    const namen = [], nach = {};
    logListe.filter(logPasst).forEach(e => {
      const g = logGruppe(e);
      if (!nach[g]) { nach[g] = []; namen.push(g); }
      nach[g].push(e);
    });
    return namen.map(n => {
      const eintraege = nach[n];
      let err = 0, warn = 0, info = 0;
      eintraege.forEach(e => {
        const a = logArt(e);
        if (a === 'err') err++; else if (a === 'warn') warn++; else if (a !== 'ok') info++;
      });
      return { name: n, eintraege: eintraege, err: err, warn: warn, info: info };
    });
  }

  function logEintragEl(e) {
    const d = document.createElement('div');
    d.className = 'logzeile ' + logArt(e);
    const kopf = document.createElement('div');
    kopf.className = 'lztext';
    if (e.N != null && isFinite(e.N)) {
      const g = document.createElement('span');
      g.className = 'chip grau lzn';
      g.textContent = t('log.groesse', { n: zahl(e.N) });
      kopf.appendChild(g);
    }
    const txt = document.createElement('span');
    txt.className = 'txt';
    txt.textContent = e.text;
    kopf.appendChild(txt);
    if (e.nodeId) {
      const a = document.createElement('span');
      a.className = 'zeigen';
      a.textContent = t('log.zeigen');
      a.addEventListener('click', () => send({ type: 'fokus', nodeId: e.nodeId }));
      kopf.appendChild(a);
    }
    d.appendChild(kopf);
    if (e.hinweis) {
      const h = document.createElement('div');
      h.className = 'hinw';
      h.textContent = e.hinweis;
      d.appendChild(h);
    }
    return d;
  }

  function protokollMalen() {
    const box = $('log');
    // Nur mitscrollen, wenn der Nutzer ohnehin unten steht.
    const amEnde = box.scrollHeight - box.scrollTop - box.clientHeight < 24;
    box.textContent = '';
    if (!logListe.length) {
      const d = document.createElement('div');
      d.className = 'leermeldung';
      d.textContent = t('log.leer');
      box.appendChild(d);
      return;
    }
    const gruppen = logGruppen();
    if (!gruppen.length) {
      const d = document.createElement('div');
      d.className = 'leermeldung';
      d.textContent = t('log.keineTreffer');
      box.appendChild(d);
      return;
    }
    gruppen.forEach(g => {
      const grp = document.createElement('fig-group');
      grp.className = 'loggruppe';
      grp.setAttribute('collapsible', '');
      grp.setAttribute('open', logZu[g.name] ? 'false' : 'true');
      const kopf = document.createElement('fig-header');
      kopf.setAttribute('borderless', '');      // Trennlinie liefert der Gruppenrahmen
      const h3 = document.createElement('h3');
      h3.className = 'lgname';
      h3.textContent = g.name;
      kopf.appendChild(h3);
      const zaehler = document.createElement('span');
      zaehler.className = 'lgzaehler';
      zaehler.title = t('log.gruppeTip', { err: g.err, warn: g.warn, info: g.info });
      [['err', '✕', g.err], ['warn', '△', g.warn], ['info', 'i', g.info]].forEach(x => {
        if (!x[2]) return;
        const c = document.createElement('span');
        c.className = 'lgchip ' + x[0];
        c.textContent = x[1] + ' ' + x[2];
        zaehler.appendChild(c);
      });
      kopf.appendChild(zaehler);
      grp.appendChild(kopf);
      grp.addEventListener('openchange', ev => {
        const auf = !!(ev && ev.detail && ev.detail.open);
        if (auf) delete logZu[g.name]; else logZu[g.name] = true;
      });
      g.eintraege.forEach(e => grp.appendChild(logEintragEl(e)));
      box.appendChild(grp);
    });
    if (amEnde) box.scrollTop = box.scrollHeight;
  }

  function logText() {
    return logGruppen().map(g => {
      const kopf = g.name + '  (✕ ' + g.err + ' · △ ' + g.warn + ' · i ' + g.info + ')';
      const zeilen = g.eintraege.map(e => {
        const z = ['  ', e.N != null && isFinite(e.N) ? '[' + e.N + ' px] ' : '',
          logArt(e) === 'err' ? '✕ ' : logArt(e) === 'warn' ? '△ ' : logArt(e) === 'ok' ? '✓ ' : '· ',
          e.text].join('');
        return e.hinweis ? z + '\n      ' + e.hinweis : z;
      });
      return [kopf].concat(zeilen).join('\n');
    }).join('\n\n');
  }
  function inZwischenablage(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => zwischenablageNotfall(text));
      return;
    }
    zwischenablageNotfall(text);
  }
  function zwischenablageNotfall(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
  }

  $('btnKopieren').addEventListener('click', () => {
    const text = logText();
    if (!text) { toast(t('toast.logNichts')); return; }
    inZwischenablage(text);
    toast(t('toast.logKopiert'));
  });
  $('segLog').addEventListener('change', e => {
    logFilter = String((e && e.detail) || $('segLog').value || 'alle');
    protokollZeichnen();
  });
  $('logSuche').addEventListener('input', e => {
    logSuche = String((e && e.detail != null) ? e.detail : ($('logSuche').value || '')).toLowerCase();
    protokollZeichnen();
  });
