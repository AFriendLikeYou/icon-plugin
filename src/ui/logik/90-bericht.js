  // =========================================================================
  // Bericht
  // =========================================================================
  $('btnBericht').addEventListener('click', () => {
    if (beschaeftigt) return;
    $('fazit').className = 'fazit';
    sperren(true);
    send({ type: 'bericht' });
  });

  function berichtGroessen() {
    if (!bericht) return [];
    const set = {};
    (bericht.zeilen || []).forEach(z => Object.keys(z.groessen || {}).forEach(n => { set[n] = true; }));
    return Object.keys(set).map(Number).filter(n => isFinite(n)).sort((a, b) => a - b);
  }
  // Farbskala grün (0) → rot (ab 0,15) als Zellenhintergrund.
  function treueFarbe(v) {
    if (v == null || !isFinite(v)) return 'transparent';
    const p = Math.max(0, Math.min(1, v / 0.15));
    const r = Math.round(46 + p * (194 - 46));
    const g = Math.round(167 - p * (167 - 64));
    const b = Math.round(106 - p * (106 - 42));
    return 'rgba(' + r + ',' + g + ',' + b + ',0.28)';
  }
  function zahl3(v) { return (v == null || !isFinite(v)) ? t('ber.keineDaten') : zahl(v.toFixed(3)); }

  function berichtSortieren(zeilen) {
    const z = zeilen.slice();
    const sp = berichtSort.spalte, ab = berichtSort.ab;
    z.sort((a, b) => {
      let x, y;
      if (sp === 'name') { x = String(a.name || '').toLowerCase(); y = String(b.name || '').toLowerCase(); }
      else {
        const ga = (a.groessen || {})[sp], gb = (b.groessen || {})[sp];
        x = ga && ga.treue != null ? ga.treue : Infinity;
        y = gb && gb.treue != null ? gb.treue : Infinity;
      }
      if (x < y) return ab ? 1 : -1;
      if (x > y) return ab ? -1 : 1;
      return 0;
    });
    return z;
  }

  function kachel(id, label, wert, trend) {
    $(id).setAttribute('label', label);
    const w = $(id + 'Wert');
    w.textContent = '';
    const s = document.createElement('span');
    s.textContent = wert;
    w.appendChild(s);
    if (trend) {
      const p = document.createElement('span');
      p.className = 'trend ' + (trend.gut ? 'gut' : 'schlecht');
      p.textContent = trend.gut ? '↓' : '↑';
      p.title = trend.titel || '';
      w.appendChild(p);
    }
  }

  function berichtZeichnen() {
    const leer = $('berichtLeer'), wrap = $('berichtTabWrap'), kach = $('berichtKacheln');
    if (!bericht) { leer.hidden = false; wrap.hidden = true; kach.hidden = true;
      $('berichtZeit').textContent = ''; aus($('btnCsv'), true); return; }
    leer.hidden = true; wrap.hidden = false; kach.hidden = false;
    aus($('btnCsv'), false);
    const z = bericht.zusammenfassung || {};
    $('berichtZeit').textContent = bericht.zeit
      ? t('ber.zeit', { zeit: new Date(bericht.zeit).toLocaleString(SPR === 'de' ? 'de-DE' : 'en-US') }) : '';
    kachel('kachelIcons', t('ber.icons'), String(z.icons == null ? '–' : z.icons));
    kachel('kachelOhneSet', t('ber.ohneSet'), String(z.ohneSet == null ? '–' : z.ohneSet));
    kachel('kachelVeraltet', t('ber.veraltet'), String(z.veraltet == null ? '–' : z.veraltet));
    let trend = null;
    if (z.treueMittel != null && z.treueMittelVorher != null && isFinite(z.treueMittelVorher)) {
      const d = z.treueMittel - z.treueMittelVorher;
      if (Math.abs(d) > 0.0005) trend = { gut: d < 0, titel: zahl3(z.treueMittelVorher) };
    }
    kachel('kachelTreue', t('ber.treueMittel'), zahl3(z.treueMittel), trend);
    kachel('kachelKeyline', t('ber.keylineOk'),
      (z.keylineOk == null ? '–' : z.keylineOk) + '/' + (z.keylineGesamt == null ? '–' : z.keylineGesamt));

    const Ns = berichtGroessen();
    const tab = $('berichtTab');
    tab.textContent = '';
    const kopf = document.createElement('tr');
    const thName = document.createElement('th');
    thName.textContent = t('ber.spalteName') + (berichtSort.spalte === 'name' ? (berichtSort.ab ? ' ↓' : ' ↑') : '');
    thName.title = t('ber.sortieren');
    thName.addEventListener('click', () => {
      berichtSort = { spalte: 'name', ab: berichtSort.spalte === 'name' ? !berichtSort.ab : false };
      berichtZeichnen();
    });
    kopf.appendChild(thName);
    Ns.forEach(N => {
      const th = document.createElement('th');
      th.textContent = zahl(N) + ' px' + (berichtSort.spalte === String(N) ? (berichtSort.ab ? ' ↓' : ' ↑') : '');
      th.title = t('ber.tipTreue') + '\n' + t('ber.sortieren');
      th.addEventListener('click', () => {
        berichtSort = { spalte: String(N), ab: berichtSort.spalte === String(N) ? !berichtSort.ab : false };
        berichtZeichnen();
      });
      kopf.appendChild(th);
    });
    tab.appendChild(kopf);

    berichtSortieren(bericht.zeilen || []).forEach(zeile => {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      const n = document.createElement('span');
      n.className = 'iname';
      n.textContent = zeile.name || '';
      n.addEventListener('click', () => { if (zeile.nodeId) send({ type: 'fokus', nodeId: zeile.nodeId }); });
      td.appendChild(n);
      if (!zeile.hatSet) {
        const c = document.createElement('span');
        c.className = 'chip rot'; c.style.marginLeft = '5px';
        c.textContent = t('ber.chipOhneSet');
        td.appendChild(c);
      } else if (zeile.veraltet) {
        const c = document.createElement('span');
        c.className = 'chip geraten'; c.style.marginLeft = '5px';
        c.textContent = t('ber.chipVeraltet');
        td.appendChild(c);
      }
      tr.appendChild(td);
      Ns.forEach(N => {
        const c = document.createElement('td');
        c.className = 'gz';
        const g = (zeile.groessen || {})[N];
        if (!g) { c.textContent = t('ber.keineDaten'); tr.appendChild(c); return; }
        const tw = document.createElement('span');
        tw.className = 'treuewert';
        tw.style.background = treueFarbe(g.treue);
        tw.textContent = zahl3(g.treue);
        c.appendChild(tw);
        const aa = document.createElement('span');
        aa.className = 'aawert';
        aa.textContent = (g.aa == null ? t('ber.keineDaten') : g.aa + ' %');
        c.appendChild(aa);
        const k = document.createElement('span');
        k.className = g.keylineOk ? 'keyja' : 'keynein';
        k.style.marginLeft = '5px';
        k.textContent = g.keylineOk ? '✓' : '✗';
        c.appendChild(k);
        const tip = [];
        if (g.keylineIst != null || g.keylineSoll != null) {
          tip.push(t('zelle.keyline', {
            ist: g.keylineIst == null ? '?' : zahl(Number(g.keylineIst).toFixed(2)),
            soll: g.keylineSoll == null ? '?' : zahl(g.keylineSoll) }));
        }
        if (g.raster) tip.push(t('zelle.gerastet', { n: g.raster.auf + '/' + g.raster.gesamt }));
        (g.struktur || []).forEach(s => tip.push(s));
        if (tip.length) c.title = tip.join('\n');
        tr.appendChild(c);
      });
      tab.appendChild(tr);
    });
  }

  // ---- CSV -----------------------------------------------------------------
  function csvFeld(v) {
    const s = String(v == null ? '' : v);
    return /[";\n]/.test(s) ? '"' + s.split('"').join('""') + '"' : s;
  }
  $('btnCsv').addEventListener('click', () => {
    if (!bericht) return;
    const kopf = ['name', 'hatSet', 'veraltet', 'N', 'treue', 'treueVorher', 'aa',
      'keylineIst', 'keylineSoll', 'keylineOk', 'rasterAuf', 'rasterGesamt'];
    const zeilen = [kopf.join(';')];
    (bericht.zeilen || []).forEach(z => {
      const Ns = Object.keys(z.groessen || {}).map(Number).sort((a, b) => a - b);
      if (!Ns.length) zeilen.push([z.name, z.hatSet ? 1 : 0, z.veraltet ? 1 : 0, '', '', '', '', '', '', '', '', ''].map(csvFeld).join(';'));
      Ns.forEach(N => {
        const g = z.groessen[N] || {};
        const r = g.raster || {};
        zeilen.push([z.name, z.hatSet ? 1 : 0, z.veraltet ? 1 : 0, N,
          g.treue == null ? '' : g.treue, g.treueVorher == null ? '' : g.treueVorher,
          g.aa == null ? '' : g.aa, g.keylineIst == null ? '' : g.keylineIst,
          g.keylineSoll == null ? '' : g.keylineSoll, g.keylineOk ? 1 : 0,
          r.auf == null ? '' : r.auf, r.gesamt == null ? '' : r.gesamt].map(csvFeld).join(';'));
      });
    });
    dateiLaden('icon-bericht.csv', '\ufeff' + zeilen.join('\r\n'), 'text/csv;charset=utf-8');
    toast(t('toast.csv'));
  });

