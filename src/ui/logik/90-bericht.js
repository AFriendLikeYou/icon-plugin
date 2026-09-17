  // =========================================================================
  // Bericht — Kacheln, Filter, Tabelle, Auswahl, CSV
  // Begriffe nach ARCHITEKTUR.md §27: Rasterfehler, weiche Pixel, Maß stimmt.
  // =========================================================================
  let berichtFilter = 'alle';     // alle | ohneSet | veraltet | mass | schlecht
  let berichtWahl = {};           // Icon-Name → true (Export-Auswahl)
  const BER_FILTER = [
    ['alle', 'fltAlle'], ['ohneSet', 'fltOhneSet'], ['veraltet', 'fltVeraltet'],
    ['mass', 'fltMass'], ['schlecht', 'fltSchlecht']
  ];

  $('btnBericht').addEventListener('click', () => {
    if (beschaeftigt) return;
    $('fazit').className = 'fazit';
    sperren(true);
    send({ type: 'bericht' });
  });
  // Neuer Bericht → Auswahl und Filter zurück auf Anfang.
  bei('bericht', () => {
    berichtWahl = {};
    berichtFilter = 'alle';
    berichtZeichnen();
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

  function zeileTreue(z) {
    const werte = Object.keys(z.groessen || {})
      .map(n => z.groessen[n] && z.groessen[n].treue)
      .filter(v => v != null && isFinite(v));
    if (!werte.length) return null;
    return werte.reduce((a, b) => a + b, 0) / werte.length;
  }
  function zeileMassFehler(z) {
    return Object.keys(z.groessen || {}).some(n => z.groessen[n] && z.groessen[n].keylineOk === false);
  }
  // Schlechteste 10 % nach mittlerem Rasterfehler (mindestens eine Zeile).
  function schlechteste(zeilen) {
    const mit = zeilen.map(z => ({ z: z, v: zeileTreue(z) })).filter(x => x.v != null);
    if (!mit.length) return [];
    mit.sort((a, b) => b.v - a.v);
    return mit.slice(0, Math.max(1, Math.ceil(mit.length * 0.1))).map(x => x.z);
  }
  function berichtSichtbar() {
    const alle = (bericht && bericht.zeilen) || [];
    if (berichtFilter === 'ohneSet') return alle.filter(z => !z.hatSet);
    if (berichtFilter === 'veraltet') return alle.filter(z => !!z.veraltet);
    if (berichtFilter === 'mass') return alle.filter(zeileMassFehler);
    if (berichtFilter === 'schlecht') {
      const s = schlechteste(alle);
      return alle.filter(z => s.indexOf(z) >= 0);
    }
    return alle.slice();
  }

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

  // ---- Auswahl -------------------------------------------------------------
  function gewaehlteNamen() {
    return Object.keys(berichtWahl).filter(n => berichtWahl[n]);
  }
  function umfangZeichnen() {
    const n = gewaehlteNamen().length;
    const el = $('segExportNamen');
    if (el) el.textContent = t('ber.umfangNamen', { n: n });
    const seg = $('segExportUmfang').querySelector('fig-segment[value="namen"]');
    if (seg) {
      if (n) seg.removeAttribute('disabled');
      else {
        seg.setAttribute('disabled', '');
        if (String($('segExportUmfang').value || '') === 'namen') $('segExportUmfang').setAttribute('value', 'alle');
      }
    }
  }
  function kopfHakenSetzen(sichtbar) {
    const box = $('chkAlleSichtbaren');
    box.setAttribute('label', t('ber.alleSichtbaren'));
    const n = sichtbar.filter(z => berichtWahl[z.name]).length;
    anhaken(box, n > 0 && n === sichtbar.length);
    if (n > 0 && n < sichtbar.length) box.setAttribute('indeterminate', 'true');
    else box.removeAttribute('indeterminate');
  }

  function berichtZeichnen() {
    umfangZeichnen();
    const leer = $('berichtLeer'), wrap = $('berichtTabWrap'), kach = $('berichtKacheln');
    if (!bericht) {
      leer.hidden = false; wrap.hidden = true; kach.hidden = true;
      $('berichtLegende').hidden = true; $('berichtFilterZeile').hidden = true;
      $('berichtTabKopf').hidden = true;
      $('berichtZeit').textContent = ''; aus($('btnCsv'), true); return;
    }
    leer.hidden = true; wrap.hidden = false; kach.hidden = false;
    $('berichtLegende').hidden = false; $('berichtFilterZeile').hidden = false;
    $('berichtTabKopf').hidden = false;
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

    BER_FILTER.forEach(f => {
      const b = $(f[1]);
      b.classList.toggle('fltaktiv', berichtFilter === f[0]);
    });

    const sichtbar = berichtSichtbar();
    $('berichtZaehler').textContent = t('ber.zaehler', {
      n: sichtbar.length, m: (bericht.zeilen || []).length });
    kopfHakenSetzen(sichtbar);

    const Ns = berichtGroessen();
    const tab = $('berichtTab');
    tab.textContent = '';
    const kopf = document.createElement('tr');
    const thWahl = document.createElement('th');
    thWahl.className = 'wspalte';
    kopf.appendChild(thWahl);
    const thName = document.createElement('th');
    const tipName = document.createElement('fig-tooltip');
    tipName.setAttribute('text', t('ber.sortieren'));
    tipName.setAttribute('delay', '500');
    const spName = document.createElement('span');
    spName.textContent = t('ber.spalteName') + (berichtSort.spalte === 'name' ? (berichtSort.ab ? ' ↓' : ' ↑') : '');
    tipName.appendChild(spName);
    thName.appendChild(tipName);
    thName.addEventListener('click', () => {
      berichtSort = { spalte: 'name', ab: berichtSort.spalte === 'name' ? !berichtSort.ab : false };
      berichtZeichnen();
    });
    kopf.appendChild(thName);
    Ns.forEach(N => {
      const th = document.createElement('th');
      th.className = 'gz';
      const tip = document.createElement('fig-tooltip');
      tip.setAttribute('text', t('ber.tipSpalte', { n: zahl(N) }) + ' — ' + t('ber.tipTreue'));
      tip.setAttribute('delay', '500');
      const sp = document.createElement('span');
      sp.textContent = zahl(N) + ' px' + (berichtSort.spalte === String(N) ? (berichtSort.ab ? ' ↓' : ' ↑') : '');
      tip.appendChild(sp);
      th.appendChild(tip);
      th.addEventListener('click', () => {
        berichtSort = { spalte: String(N), ab: berichtSort.spalte === String(N) ? !berichtSort.ab : false };
        berichtZeichnen();
      });
      kopf.appendChild(th);
    });
    tab.appendChild(kopf);

    if (!sichtbar.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = Ns.length + 2;
      td.className = 'berichtleer';
      td.textContent = t('ber.keineTreffer');
      tr.appendChild(td);
      tab.appendChild(tr);
      return;
    }

    berichtSortieren(sichtbar).forEach(zeile => {
      const tr = document.createElement('tr');
      const tdW = document.createElement('td');
      tdW.className = 'wspalte';
      const box = document.createElement('fig-checkbox');
      if (berichtWahl[zeile.name]) box.setAttribute('checked', '');
      box.addEventListener('change', e => {
        const an = !!(e && e.detail ? e.detail.checked : e.target.checked);
        if (an) berichtWahl[zeile.name] = true; else delete berichtWahl[zeile.name];
        umfangZeichnen();
        kopfHakenSetzen(berichtSichtbar());
      });
      tdW.appendChild(box);
      tr.appendChild(tdW);

      const td = document.createElement('td');
      const n = document.createElement('span');
      n.className = 'iname';
      n.textContent = zeile.name || '';
      n.addEventListener('click', () => { if (zeile.nodeId) send({ type: 'fokus', nodeId: zeile.nodeId }); });
      td.appendChild(n);
      if (!zeile.hatSet) {
        const c = document.createElement('span');
        c.className = 'chip rot'; c.style.marginLeft = '6px';
        c.textContent = t('ber.chipOhneSet');
        td.appendChild(c);
      } else if (zeile.veraltet) {
        const c = document.createElement('span');
        c.className = 'chip geraten'; c.style.marginLeft = '6px';
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
        const tip = [t('ber.tipTreue'), t('ber.tipAa'), t('ber.tipMass')];
        if (g.keylineIst != null || g.keylineSoll != null) {
          tip.push(t('zelle.keyline', {
            ist: g.keylineIst == null ? '?' : zahl(Number(g.keylineIst).toFixed(2)),
            soll: g.keylineSoll == null ? '?' : zahl(g.keylineSoll) }));
        }
        if (g.raster) tip.push(t('zelle.gerastet', { n: g.raster.auf + '/' + g.raster.gesamt }));
        (g.struktur || []).forEach(s => tip.push(s));
        c.title = tip.join('\n');
        tr.appendChild(c);
      });
      tab.appendChild(tr);
    });
  }

  BER_FILTER.forEach(f => {
    $(f[1]).addEventListener('click', () => {
      if (!bericht) return;
      berichtFilter = f[0];
      berichtZeichnen();
    });
  });
  $('chkAlleSichtbaren').addEventListener('change', e => {
    if (!bericht) return;
    const an = !!(e && e.detail ? e.detail.checked : e.target.checked);
    berichtSichtbar().forEach(z => {
      if (an) berichtWahl[z.name] = true; else delete berichtWahl[z.name];
    });
    berichtZeichnen();
  });

  // ---- CSV -----------------------------------------------------------------
  function csvFeld(v) {
    const s = String(v == null ? '' : v);
    return /[";\n]/.test(s) ? '"' + s.split('"').join('""') + '"' : s;
  }
  $('btnCsv').addEventListener('click', () => {
    if (!bericht) return;
    const kopf = ['name', 'hatSet', 'veraltet', 'N', 'rasterfehler', 'rasterfehlerVorher', 'weichePixel',
      'keylineIst', 'keylineSoll', 'massStimmt', 'rasterAuf', 'rasterGesamt'];
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
    dateiLaden('icon-bericht.csv', '﻿' + zeilen.join('\r\n'), 'text/csv;charset=utf-8');
    toast(t('toast.csv'));
  });
