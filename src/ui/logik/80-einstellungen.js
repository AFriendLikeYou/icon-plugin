  // =========================================================================
  // Einstellungen — lokale Kopie der Konfig
  // =========================================================================
  function toast(text) {
    $('toastText').textContent = text;
    const el = $('toast');
    try { el.showToast(); } catch (e) { try { el.setAttribute('open', ''); } catch (err) {} }
  }

  // Strukturierte Fehler aus der Validierung: [{ pfad, text }].
  // Der Pfad entspricht dem data-pfad-Attribut des zugehörigen Felds.
  function fehlerText(f) { return (f && typeof f === 'object') ? (f.text || '') : String(f == null ? '' : f); }
  function fehlerPfad(f) { return (f && typeof f === 'object') ? (f.pfad || '') : ''; }
  function korrekturenMarkieren() {
    const nach = {}, warn = {};
    (konfigFehler || []).forEach(f => {
      const p = fehlerPfad(f);
      if (!p) return;
      const ziel = (f && f.art === 'warnung') ? warn : nach;
      ziel[p] = ziel[p] ? ziel[p] + '\n' + fehlerText(f) : fehlerText(f);
    });
    document.querySelectorAll('[data-pfad]').forEach(el => {
      const p = el.getAttribute('data-pfad');
      const txt = nach[p] || warn[p];
      el.classList.toggle('ungueltig', !!nach[p]);
      el.classList.toggle('warnung', !nach[p] && !!warn[p]);
      if (txt) el.setAttribute('title', txt);
      else if (!el.hasAttribute('data-title-fest')) el.removeAttribute('title');
    });
  }
  function fehlerZeichnen() {
    const box = $('cfgFehler'), liste = $('cfgFehlerListe');
    const f = konfigFehler || [];
    liste.textContent = '';
    box.hidden = !f.length;
    f.forEach(s => {
      const li = document.createElement('li');
      li.textContent = fehlerText(s);
      if (s && s.art === 'warnung') li.className = 'warnung';
      liste.appendChild(li);
    });
    korrekturenMarkieren();
  }

  // ---- Schreiben -----------------------------------------------------------
  function schreibenZeichnen() {
    const s = (cfgLokal && cfgLokal.schreiben) || {};
    anhaken($('chkFrameUmwandeln'), !!s.frameUmwandeln);
    anhaken($('chkStrokeHeim'), s.strokeHeimAnlegen !== false);
  }
  function schreibenFeld(name, an) {
    if (!cfgLokal) return;
    if (!cfgLokal.schreiben) cfgLokal.schreiben = {};
    cfgLokal.schreiben[name] = !!an;
  }
  $('chkFrameUmwandeln').addEventListener('change', e => schreibenFeld('frameUmwandeln', e.target.checked));
  $('chkStrokeHeim').addEventListener('change', e => schreibenFeld('strokeHeimAnlegen', e.target.checked));

  // ---- Profil-Chooser ------------------------------------------------------
  function profilListeZeichnen() {
    const box = $('profilListe');
    if (!box) return;
    box.textContent = '';
    const info = (profilInfo && profilInfo.length)
      ? profilInfo
      : (profile || []).map(n => ({ name: n, titel: t('profil.' + n), beschreibung: '' }));
    if (!info.some(p => p.name === profilWahl)) profilWahl = info.length ? info[0].name : 'generic';
    info.forEach(p => {
      const k = document.createElement('div');
      k.className = 'profilkarte' + (p.name === profilWahl ? ' gewaehlt' : '');
      const ti = document.createElement('div');
      ti.className = 'ptitel';
      ti.textContent = p.titel || t('profil.' + p.name);
      k.appendChild(ti);
      if (p.beschreibung) {
        const b = document.createElement('div');
        b.className = 'pbeschr';
        b.textContent = p.beschreibung;
        k.appendChild(b);
      }
      k.addEventListener('click', () => { profilWahl = p.name; profilListeZeichnen(); });
      box.appendChild(k);
    });
  }

  // ---- Konfig-Datei: Export / Import ---------------------------------------
  function dateiLaden(name, inhalt, typ) {
    const blob = (inhalt instanceof Blob) ? inhalt : new Blob([inhalt], { type: typ || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  $('btnKonfigExport').addEventListener('click', () => {
    if (!cfgLokal) return;
    dateiLaden('icon-pipeline.konfig.json',
      JSON.stringify(cfgLokal, null, 2), 'application/json');
    toast(t('toast.exportiert'));
  });
  $('fileKonfig').addEventListener('change', () => {
    const el = $('fileKonfig');
    const datei = el.files && el.files[0];
    if (!datei) return;
    const leser = new FileReader();
    leser.onload = () => {
      let k = null;
      try { k = JSON.parse(String(leser.result)); } catch (err) { k = null; }
      if (!k || typeof k !== 'object' || Array.isArray(k) || !k.groessen) {
        toast(t('toast.importFehler'));
        return;
      }
      wartetAufSpeichern = true;
      send({ type: 'konfigSpeichern', konfig: k });
      toast(t('toast.importiert'));
    };
    leser.onerror = () => toast(t('toast.importFehler'));
    leser.readAsText(datei);
  });

  // ---- Vorschau mit ungespeicherten Einstellungen --------------------------
  $('btnVorschauMit').addEventListener('click', () => {
    if (beschaeftigt || !cfgLokal || !hatAuswahl) return;
    $('fazit').className = 'fazit';
    sperren(true);
    send({ type: 'vorschauMit', konfig: kopie(cfgLokal), snap: !!$('chkSnap').checked });
  });

  function allgemeinZeichnen() {
    wert($('selAdapter'), cfgLokal.adapter);
    wert($('selSprache'), cfgLokal.sprache);
    wert($('inpVarProp'), cfgLokal.variantenProperty);
  }
  function masterZeichnen() {
    wert($('inpMasterGroesse'), cfgLokal.master.groesse);
    wert($('inpMasterKontur'), cfgLokal.master.kontur);
    const box = $('masterKeylines');
    box.textContent = '';
    $('masterKeyViz').innerHTML = keylineViz(cfgLokal.master.groesse, cfgLokal.master.keylines);
    KLASSEN.forEach(kl => {
      const feld = document.createElement('div');
      feld.className = 'feld';
      feld.innerHTML = '<span class="fname">' + esc(kl) + '</span>'
        + '<fig-tooltip text="' + esc(t('tip.masterKeyline')) + '" delay="400">'
        + '<fig-input-number min="0.1" step="0.5" data-pfad="master.keylines.' + kl + '"'
        + ' value="' + esc(cfgLokal.master.keylines[kl]) + '"></fig-input-number></fig-tooltip>';
      const inp = feld.querySelector('fig-input-number');
      inp.addEventListener('change', e => {
        const v = parseFloat(e.detail != null ? e.detail : inp.value);
        if (isFinite(v)) { cfgLokal.master.keylines[kl] = v;
          $('masterKeyViz').innerHTML = keylineViz(cfgLokal.master.groesse, cfgLokal.master.keylines); }
      });
      box.appendChild(feld);
    });
    korrekturenMarkieren();
  }

  // Ein Feld der Größen-Karte: Beschriftung, Steuerung im Tooltip, Hilfezeile.
  function gfeld(label, tipKey, hilfeKey, steuerung, attr) {
    return '<div class="gfeld"' + (attr || '') + '>'
      + '<span class="fname">' + esc(label) + '</span>'
      + '<fig-tooltip text="' + esc(t(tipKey)) + '" delay="400">' + steuerung + '</fig-tooltip>'
      + '<div class="fhilfe">' + esc(t(hilfeKey)) + '</div></div>';
  }
  // Sichtbarkeit nach Radius-Modus: „Radius (px)“ nur bei festem Wert,
  // „Mindestradius“ nicht bei „keine Rundung“.
  function radiusSicht(karte, g) {
    const w = karte.querySelector('[data-rolle="radWert"]');
    const m = karte.querySelector('[data-rolle="radMin"]');
    if (w) w.hidden = g.radius.modus !== 'fest';
    if (m) m.hidden = g.radius.modus === 'keine';
  }

  function optionen(werte, aktiv, beschriften) {
    return werte.map(v => '<option value="' + esc(v) + '"'
      + (String(v) === String(aktiv) ? ' selected' : '') + '>'
      + esc(beschriften ? beschriften(v) : v) + '</option>').join('');
  }

  function groessenZeichnen() {
    const box = $('groessen');
    box.textContent = '';
    cfgLokal.groessen.forEach((g, i) => {
      const karte = document.createElement('div');
      karte.className = 'groessekarte';
      const pf = 'groessen.' + i;
      karte.innerHTML =
        '<div class="gkopf">'
        + '<span class="gtitel">' + esc(zahl(g.N)) + ' px</span>'
        + '<div class="rechts">'
        + '<fig-tooltip text="' + esc(t('tip.standard')) + '" delay="400">'
        + '<fig-radio name="std" class="rStd" value="' + i + '" data-pfad="' + pf + '.standard"'
        + (g.standard ? ' checked' : '') + '><span>' + esc(t('cfg.standard')) + '</span></fig-radio>'
        + '</fig-tooltip>'
        + '<fig-button class="bWeg" variant="ghost" title="' + esc(t('cfg.entfernen')) + '"'
        + (cfgLokal.groessen.length < 2 ? ' disabled' : '') + '>✕</fig-button>'
        + '</div></div>'
        + '<div class="gzeilen">'
        + gfeld(t('cfg.N'), 'tip.N', 'hilf.N',
            '<fig-input-number class="fN" min="1" step="1" data-pfad="' + pf + '.N" value="' + esc(g.N) + '"></fig-input-number>')
        + gfeld(t('cfg.kontur'), 'tip.kontur', 'hilf.kontur',
            '<fig-input-number class="fKontur" min="0.1" step="0.25" data-pfad="' + pf + '.kontur" value="' + esc(g.kontur) + '"></fig-input-number>')
        + gfeld(t('cfg.raster'), 'tip.raster', 'hilf.raster',
            '<fig-dropdown class="fRaster" data-pfad="' + pf + '.raster" value="' + esc(g.raster) + '">'
            + optionen(RASTER_WERTE, g.raster, v => zahl(v)) + '</fig-dropdown>')
        + gfeld(t('cfg.rasterGrob'), 'tip.rasterGrob', 'hilf.rasterGrob',
            '<fig-dropdown class="fGrob" data-pfad="' + pf + '.rasterGrob" value="' + esc(g.rasterGrob == null ? '' : g.rasterGrob) + '">'
            + '<option value=""' + (g.rasterGrob == null ? ' selected' : '') + '>' + esc(t('opt.aus')) + '</option>'
            + optionen([1, 0.5], g.rasterGrob == null ? '' : g.rasterGrob, v => zahl(v)) + '</fig-dropdown>')
        + gfeld(t('cfg.radiusModus'), 'tip.radiusModus', 'hilf.radiusModus',
            '<fig-dropdown class="fRadModus" data-pfad="' + pf + '.radius.modus" value="' + esc(g.radius.modus) + '">'
            + optionen(['proportional', 'fest', 'keine'], g.radius.modus, v => t('radius.' + v)) + '</fig-dropdown>')
        + gfeld(t('cfg.radiusWert'), 'tip.radiusWert', 'hilf.radiusWert',
            '<fig-input-number class="fRadWert" min="0" step="0.5" data-pfad="' + pf + '.radius.wert" value="' + esc(g.radius.wert) + '"></fig-input-number>',
            ' data-rolle="radWert"')
        + gfeld(t('cfg.radiusMin'), 'tip.radiusMin', 'hilf.radiusMin',
            '<fig-input-number class="fRadMin" min="0" step="0.5" data-pfad="' + pf + '.radius.min" value="' + esc(g.radius.min) + '"></fig-input-number>',
            ' data-rolle="radMin"')
        + '</div>'
        + '<div class="keyzeile"><fig-button class="keyauf" variant="ghost">' + esc(t('cfg.keylinesAuf')) + ' ▾</fig-button>'
        + '<span class="keykurz">' + esc(keylinesKurz(g)) + '</span></div>'
        + '<div class="keyblock"' + (keylinesOffen[i] ? '' : ' hidden') + '>'
        + '<div class="keyhinweis">' + esc(t('cfg.keylinesHinweis', { N: zahl(g.N) })) + '</div>'
        + '<div class="keyvizhalter">' + keylineViz(g.N, g.keylines) + '</div>'
        + '<div class="vier">'
        + KLASSEN.map(kl => '<div class="feld"><span class="fname">' + esc(kl) + '</span>'
            + '<fig-tooltip text="' + esc(t('tip.keyline')) + '" delay="400">'
            + '<fig-input-number class="fKey' + (keylinePlausibel(g, g.keylines[kl]) ? '' : ' unplausibel') + '" data-kl="' + kl + '" min="0.1" step="0.5" data-pfad="' + pf + '.keylines.' + kl + '"'
            + (keylinePlausibel(g, g.keylines[kl]) ? '' : ' data-title-fest title="' + esc(t('cfg.keylineUnplausibel', { wert: zahl(g.keylines[kl]), N: zahl(g.N), min: zahl(g.N / 2) })) + '"')
            + ' value="' + esc(g.keylines[kl]) + '"></fig-input-number></fig-tooltip></div>').join('')
        + '</div>'
        + '<fig-button class="keyprop" variant="ghost">' + esc(t('cfg.keylinesProp')) + '</fig-button>'
        + '</div>';

      const zahlBinden = (sel, setzen) => {
        const el = karte.querySelector(sel);
        if (!el) return;
        el.addEventListener('change', e => {
          const v = parseFloat(e.detail != null ? e.detail : el.value);
          if (isFinite(v)) { setzen(v); }
        });
      };
      zahlBinden('.fN', v => {
        const alt = g.N, neuN = Math.round(v);
        if (!(neuN > 0) || neuN === alt) return;
        g.N = neuN;
        if (!g.keylinesManuell && alt > 0) keylinesSkalieren(g, neuN / alt);
        keylinesOffen[i] = true;            // zeigen, was sich geändert hat
        groessenZeichnen();
      });
      zahlBinden('.fKontur', v => { g.kontur = v; });
      zahlBinden('.fRadWert', v => { g.radius.wert = v; });
      zahlBinden('.fRadMin', v => { g.radius.min = v; });
      karte.querySelectorAll('.fKey').forEach(el => {
        el.addEventListener('change', e => {
          const v = parseFloat(e.detail != null ? e.detail : el.value);
          if (isFinite(v)) { g.keylines[el.getAttribute('data-kl')] = v; g.keylinesManuell = true;
            const h = karte.querySelector('.keyvizhalter'); if (h) h.innerHTML = keylineViz(g.N, g.keylines);
            const kz = karte.querySelector('.keykurz'); if (kz) kz.textContent = keylinesKurz(g); }
        });
      });
      karte.querySelector('.keyprop').addEventListener('click', () => {
        // Bezug: die nächstkleinere Zeile, sonst die nächstgrößere
        const andere = cfgLokal.groessen.filter(x => x !== g && x.N > 0);
        if (!andere.length) return;
        const kleiner = andere.filter(x => x.N < g.N).sort((a, b) => b.N - a.N)[0];
        const bezug = kleiner || andere.sort((a, b) => a.N - b.N)[0];
        KLASSEN.forEach(kl => { g.keylines[kl] = Math.round(bezug.keylines[kl] * (g.N / bezug.N) * 2) / 2; });
        g.keylinesManuell = false;
        keylinesOffen[i] = true;
        groessenZeichnen();
      });
      karte.querySelector('.fRaster').addEventListener('change', e => {
        const v = parseFloat((e && e.detail) || karte.querySelector('.fRaster').value);
        if (isFinite(v)) g.raster = v;
      });
      karte.querySelector('.fGrob').addEventListener('change', e => {
        const s = (e && e.detail != null) ? e.detail : karte.querySelector('.fGrob').value;
        g.rasterGrob = (s === '' || s == null) ? null : parseFloat(s);
      });
      karte.querySelector('.fRadModus').addEventListener('change', e => {
        const s = (e && e.detail) || karte.querySelector('.fRadModus').value;
        if (s) g.radius.modus = s;
        radiusSicht(karte, g);          // live: Radius/Mindestradius ein- und ausblenden
      });
      karte.querySelector('.rStd').addEventListener('change', e => {
        if (!e.target.checked) return;
        cfgLokal.groessen.forEach(x => { x.standard = false; });
        g.standard = true;
        groessenZeichnen();
      });
      karte.querySelector('.bWeg').addEventListener('click', () => {
        if (cfgLokal.groessen.length < 2) return;
        cfgLokal.groessen.splice(i, 1);
        keylinesOffen = {};
        if (!cfgLokal.groessen.some(x => x.standard)) {
          cfgLokal.groessen[cfgLokal.groessen.length - 1].standard = true;
        }
        groessenZeichnen();
      });
      const auf = karte.querySelector('.keyauf');
      auf.addEventListener('click', () => {
        const kb = karte.querySelector('.keyblock');
        keylinesOffen[i] = kb.hidden;
        kb.hidden = !kb.hidden;
      });
      radiusSicht(karte, g);
      box.appendChild(karte);
    });
    korrekturenMarkieren();
  }

  const KEY_FARBEN = { Square: '#d3308f', Circular: '#0e8a9a', Wide: '#c98a12', Tall: '#5b5bd6' };
  // Skizze: Kasten N×N mit Pixelraster, darüber die vier Keyline-Formen.
  // Wide/Tall werden 3:2 bzw. 2:3 gezeichnet — nur die lange Seite ist die Keyline.
  function keylineSvg(N, keylines, px) {
    px = px || 132;
    const S = px / N, c = px / 2;
    const linie = (x1, y1, x2, y2, op) => '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#8a8a96" stroke-opacity="' + op + '" stroke-width="1"/>';
    let raster = '';
    if (N <= 64) for (let i = 1; i < N; i++) raster += linie(i * S, 0, i * S, px, 0.16) + linie(0, i * S, px, i * S, 0.16);
    else for (let i = 4; i < N; i += 4) raster += linie(i * S, 0, i * S, px, 0.16) + linie(0, i * S, px, i * S, 0.16);
    const mitte = linie(c, 0, c, px, 0.35) + linie(0, c, px, c, 0.35);
    const form = (kl, k) => {
      if (!(k > 0)) return '';
      const f = KEY_FARBEN[kl], a = 'fill="' + f + '" fill-opacity="0.08" stroke="' + f + '" stroke-width="1.25"';
      const w = k * S;
      if (kl === 'Circular') return '<circle cx="' + c + '" cy="' + c + '" r="' + (w / 2) + '" ' + a + '/>';
      if (kl === 'Square')   return '<rect x="' + (c - w / 2) + '" y="' + (c - w / 2) + '" width="' + w + '" height="' + w + '" ' + a + '/>';
      if (kl === 'Wide')     return '<rect x="' + (c - w / 2) + '" y="' + (c - w / 3) + '" width="' + w + '" height="' + (w * 2 / 3) + '" ' + a + ' stroke-dasharray="3 2"/>';
      return '<rect x="' + (c - w / 3) + '" y="' + (c - w / 2) + '" width="' + (w * 2 / 3) + '" height="' + w + '" ' + a + ' stroke-dasharray="3 2"/>';
    };
    return '<svg width="' + px + '" height="' + px + '" viewBox="0 0 ' + px + ' ' + px + '">'
      + raster + mitte + ['Wide', 'Tall', 'Square', 'Circular'].map(kl => form(kl, keylines[kl])).join('') + '</svg>';
  }
  function keylineViz(N, keylines) {
    const leg = KLASSEN.map(kl => '<span><i class="' + (kl === 'Circular' ? 'rund' : '') + '" style="background:' + KEY_FARBEN[kl] + '"></i>'
      + esc(kl) + ' ' + zahl(keylines[kl]) + '</span>').join('');
    return '<div class="keyviz">' + keylineSvg(N, keylines) + '<div class="legende">' + leg
      + '<span style="margin-top:4px">' + esc(t('cfg.keylinesLegende', { N: zahl(N) })) + '</span></div></div>';
  }
  function keylinesSkalieren(g, f) {
    KLASSEN.forEach(kl => { g.keylines[kl] = Math.round(g.keylines[kl] * f * 2) / 2; });
  }
  function keylinesKurz(g) {
    return KLASSEN.map(kl => kl.slice(0, 1) + ' ' + zahl(g.keylines[kl])).join(' · ');
  }
  // Plausibel: Icon-Körper zwischen halber und voller Kastengröße.
  function keylinePlausibel(g, wert) {
    return isFinite(wert) && wert >= g.N / 2 - 1e-9 && wert <= g.N + 1e-9;
  }

  // Vorschlag für eine neue Zeile: N + 4 (bzw. + 6 ab 24 px), Kontur wie die
  // letzte, Keylines proportional (auf 0,5 gerundet), Raster wie die letzte.
  $('btnGroesseHinzu').addEventListener('click', () => {
    if (!cfgLokal) return;
    const gs = cfgLokal.groessen;
    const letzte = gs[gs.length - 1];
    const schritt = letzte && letzte.N >= 24 ? 6 : 4;
    const N = letzte ? letzte.N + schritt : 24;
    const neu = letzte ? kopie(letzte) : {
      N: 24, kontur: 2, keylines: { Square: 20, Circular: 22, Wide: 22, Tall: 22 },
      raster: 0.5, rasterGrob: null, radius: { modus: 'proportional', wert: 1, min: 0 }, standard: false
    };
    neu.N = N;
    neu.standard = false;
    neu.keylinesManuell = false;
    if (letzte) {
      const f = N / letzte.N;
      KLASSEN.forEach(kl => {
        neu.keylines[kl] = Math.round(letzte.keylines[kl] * f * 2) / 2;
      });
    }
    gs.push(neu);
    gs.sort((a, b) => a.N - b.N);
    groessenZeichnen();
  });

  $('selAdapter').addEventListener('change', e => {
    const v = (e && e.detail) || $('selAdapter').value;
    if (v && cfgLokal) cfgLokal.adapter = v;
  });
  $('selSprache').addEventListener('change', e => {
    const v = (e && e.detail) || $('selSprache').value;
    if (!v || !cfgLokal) return;
    cfgLokal.sprache = v;
    // Sofort umschalten, ohne aufs Speichern zu warten.
    const neu = v === 'auto' ? navSprache() : (v === 'de' ? 'de' : 'en');
    if (neu !== SPR) { SPR = neu; texteSetzen(); }
  });
  $('inpVarProp').addEventListener('change', e => {
    const v = (e && e.detail != null) ? e.detail : $('inpVarProp').value;
    if (cfgLokal) cfgLokal.variantenProperty = String(v || '').trim();
  });
  $('inpMasterGroesse').addEventListener('change', e => {
    const v = parseFloat(e.detail != null ? e.detail : $('inpMasterGroesse').value);
    if (isFinite(v) && cfgLokal) { cfgLokal.master.groesse = v;
      $('masterKeyViz').innerHTML = keylineViz(cfgLokal.master.groesse, cfgLokal.master.keylines); }
  });
  $('inpMasterKontur').addEventListener('change', e => {
    const v = parseFloat(e.detail != null ? e.detail : $('inpMasterKontur').value);
    if (isFinite(v) && cfgLokal) cfgLokal.master.kontur = v;
  });

  // ---- Farbe ---------------------------------------------------------------
  function farbenAnfordern(erzwingen) {
    if (!erzwingen && (farbenAngefragt || farben)) return;
    farben = null; farbenAngefragt = true;
    send({ type: 'farbenListen' });
  }
  $('btnFarbenNeu').addEventListener('click', () => { if (!beschaeftigt) { farbenAnfordern(true); varListeZeichnen(); } });
  function farbeZeichnen() {
    const f = cfgLokal.farbe;
    wert($('segFarbe'), f.modus);
    $('farbeHex').hidden = f.modus !== 'hex';
    $('farbeVariable').hidden = f.modus !== 'variable';
    // Ein Satz Erklärung je Modus; „Vorlage an diese Farbe binden“ nicht bei „Wie Vorlage“.
    $('farbeErkl').textContent = t(f.modus === 'hex' ? 'farbe.erklHex'
      : f.modus === 'variable' ? 'farbe.erklVariable' : 'farbe.erklSource');
    $('angleichenZeile').hidden = f.modus === 'source';
    wert($('inpHex'), f.hex || '#444444');
    anhaken($('chkAngleichen'), f.sourceAngleichen);
    varListeZeichnen();
    gewaehlteVariableZeichnen(null);
    korrekturenMarkieren();
  }
  function gewaehlteVariableZeichnen(geprueft) {
    const f = cfgLokal.farbe;
    const zeile = $('varGewaehlt');
    if (f.modus !== 'variable' || !f.variable) { zeile.hidden = true; return; }
    zeile.hidden = false;
    const hex = geprueft && geprueft.ok ? geprueft.hex : variableHex(f.variable);
    $('varPlatte').style.background = hex || 'transparent';
    let name = (geprueft && geprueft.ok && geprueft.name) || f.variable.name || f.variable.key || '';
    if (geprueft && !geprueft.ok) name = t('farbe.unaufloesbar');
    $('varName').textContent = name + (hex ? ' · ' + hex : '');
  }
  function variableHex(v) {
    if (!v) return '';
    if (farben) {
      const treffer = (farben.lokal || []).filter(x => (v.id && x.id === v.id) || (v.key && x.key === v.key));
      if (treffer.length && treffer[0].hex) return treffer[0].hex;
    }
    return (v.key && TOKEN_HEX[v.key]) || '';
  }

  // ---- Farbwerte von Library-Tokens nachladen ------------------------------
  // Library-Variablen kommen ohne hex. Beim Aufklappen einer Kollektion holen
  // wir die Werte in Paketen zu 40 (`farbenWerte`) und schreiben sie in die Zeilen.
  const TOKEN_HEX = {};        // key → hex | null (null = nicht auflösbar)
  const TOKEN_LAEUFT = {};     // key → true, solange eine Anfrage unterwegs ist
  function farbenWerteAnfordern(keys) {
    const offen = (keys || []).filter(k => k && !(k in TOKEN_HEX) && !TOKEN_LAEUFT[k]);
    for (let i = 0; i < offen.length; i += 40) {
      const paket = offen.slice(i, i + 40);
      paket.forEach(k => { TOKEN_LAEUFT[k] = true; });
      send({ type: 'farbenWerte', keys: paket });
    }
  }
  function tokenSwatchSetzen(zeile, hex) {
    const alt = zeile.querySelector('fig-skeleton, fig-swatch');
    const s = document.createElement('fig-swatch');
    s.setAttribute('background', hex || '#d9d9d9');
    s.setAttribute('size', 'small');
    if (alt) zeile.replaceChild(s, alt); else zeile.insertBefore(s, zeile.firstChild);
  }
  function tokenSwatchesAktualisieren() {
    document.querySelectorAll('#varListe .varzeile[data-key]').forEach(z => {
      const k = z.getAttribute('data-key');
      if (!(k in TOKEN_HEX)) return;
      if (z.querySelector('fig-swatch')) return;
      tokenSwatchSetzen(z, TOKEN_HEX[k]);
    });
    gewaehlteVariableZeichnen(null);
  }
  bei('farbenWerteErgebnis', m => {
    const w = (m && m.werte) || {};
    Object.keys(w).forEach(k => { TOKEN_HEX[k] = w[k] || null; delete TOKEN_LAEUFT[k]; });
    tokenSwatchesAktualisieren();
  });
  function passt(name, koll) {
    if (!farbSuche) return true;
    const s = farbSuche.toLowerCase();
    return String(name || '').toLowerCase().indexOf(s) >= 0
        || String(koll || '').toLowerCase().indexOf(s) >= 0;
  }
  function variableWaehlen(v) {
    cfgLokal.farbe.variable = { key: v.key || '', name: v.name || '', id: v.id || '' };
    cfgLokal.farbe.modus = 'variable';
    varListeZeichnen();
    gewaehlteVariableZeichnen(null);
    send({ type: 'farbePruefen', farbe: kopie(cfgLokal.farbe) });
  }
  function varZeile(v, mitSwatch, koll) {
    const gew = cfgLokal.farbe.variable
      && ((v.id && cfgLokal.farbe.variable.id === v.id) || (v.key && cfgLokal.farbe.variable.key === v.key));
    const d = document.createElement('div');
    d.className = 'varzeile' + (gew ? ' gewaehlt' : '');
    if (v.key) d.setAttribute('data-key', v.key);
    const hex = v.hex || (v.key ? TOKEN_HEX[v.key] : '');
    if (mitSwatch || hex) {
      tokenSwatchSetzen(d, hex);
    } else if (v.key) {
      // Wert noch nicht geladen: Skeleton-Swatch als Platzhalter.
      const sk = document.createElement('fig-skeleton');
      d.appendChild(sk);
    }
    const n = document.createElement('span');
    n.className = 'vname';
    n.textContent = v.name || v.key || '';
    d.appendChild(n);
    if (koll) {
      const k = document.createElement('span');
      k.className = 'vkoll';
      k.textContent = koll;
      d.appendChild(k);
    }
    d.addEventListener('click', () => variableWaehlen(v));
    return d;
  }
  function varListeZeichnen() {
    const box = $('varListe');
    box.textContent = '';
    if (!farben) {
      // Ladezustand: Skeleton-Swatches plus Shimmer-Text.
      for (let i = 0; i < 3; i++) {
        const d = document.createElement('div');
        d.className = 'varladen';
        d.appendChild(document.createElement('fig-skeleton'));
        const sh = document.createElement('fig-shimmer');
        sh.textContent = t('farbe.laden');
        d.appendChild(sh);
        box.appendChild(d);
      }
      return;
    }
    let etwas = false;
    const lokal = (farben.lokal || []).filter(v => passt(v.name, v.kollektion));
    if (lokal.length) {
      etwas = true;
      const kopf = document.createElement('div');
      kopf.className = 'gruppenkopf';
      kopf.style.padding = '4px 5px 2px';
      kopf.textContent = t('farbe.lokal');
      box.appendChild(kopf);
      lokal.forEach(v => box.appendChild(varZeile(v, true, v.kollektion)));
    }
    (farben.bibliotheken || []).forEach(b => {
      const vars = (b.variablen || []).filter(v => passt(v.name, b.kollektion));
      if (!vars.length) return;
      etwas = true;
      const g = document.createElement('fig-group');
      g.className = 'kollektion';
      g.setAttribute('collapsible', '');
      g.setAttribute('name', (b.bibliothek ? b.bibliothek + ' · ' : '') + b.kollektion);
      const keys = vars.map(v => v.key).filter(Boolean);
      if (farbSuche) { g.setAttribute('open', 'true'); farbenWerteAnfordern(keys); }
      // Farbwerte erst beim Aufklappen holen (fig-group meldet `openchange`).
      g.addEventListener('openchange', e => {
        if (e && e.detail && e.detail.open) farbenWerteAnfordern(keys);
      });
      vars.forEach(v => g.appendChild(varZeile(
        { key: v.key, name: v.name, id: '' }, false, '')));
      box.appendChild(g);
    });
    if (!etwas) {
      const d = document.createElement('div');
      d.className = 'varleer';
      d.textContent = t('farbe.leer');
      box.appendChild(d);
    }
  }
  $('segFarbe').addEventListener('change', e => {
    const v = (e && e.detail) || $('segFarbe').value;
    if (!v || !cfgLokal) return;
    cfgLokal.farbe.modus = v;
    if (v === 'variable') farbenAnfordern();
    farbeZeichnen();
  });
  $('inpHex').addEventListener('change', e => {
    const d = e && e.detail;
    const v = (d && (d.hex || d.value)) || $('inpHex').getAttribute('value');
    if (v && cfgLokal) cfgLokal.farbe.hex = String(v).slice(0, 7).toLowerCase();
  });
  $('chkAngleichen').addEventListener('change', e => {
    if (cfgLokal) cfgLokal.farbe.sourceAngleichen = !!e.target.checked;
  });
  $('varSuche').addEventListener('input', e => {
    farbSuche = String((e && e.detail != null) ? e.detail : $('varSuche').value || '');
    varListeZeichnen();
  });

  // ---- Speichern / Zurücksetzen -------------------------------------------
  $('btnSpeichern').addEventListener('click', () => {
    if (!cfgLokal) return;
    cfgLokal.groessen.sort((a, b) => a.N - b.N);
    wartetAufSpeichern = true;
    send({ type: 'konfigSpeichern', konfig: kopie(cfgLokal) });
  });
  $('btnZuruecksetzen').addEventListener('click', () => { profilListeZeichnen(); dialogAuf('dlgReset'); });
  $('resetAbbruch').addEventListener('click', () => dialogZu('dlgReset'));
  $('resetOk').addEventListener('click', () => {
    dialogZu('dlgReset');
    wartetAufSpeichern = false;
    send({ type: 'konfigZuruecksetzen', profil: profilWahl });
  });

  function konfigUebernehmen(m) {
    KONFIG = m.konfig || {};
    konfigFehler = m.fehler || [];
    adapterAktiv = m.adapter || KONFIG.adapter || '';
    if (m.profile && m.profile.length) profile = m.profile;
    profilInfo = m.profilInfo || null;
    const warSpeichern = wartetAufSpeichern;
    wartetAufSpeichern = false;
    cfgLokal = kopie(m.konfig || {});
    keylinesOffen = {};
    if (!spracheAbgleichen()) {
      adapterChipSetzen();
      allgemeinZeichnen();
      masterZeichnen();
      groessenZeichnen();
      farbeZeichnen();
      schreibenZeichnen();
      fehlerZeichnen();
      profilListeZeichnen();
      auswahlZeichnen();
    } else {
      allgemeinZeichnen();
    }
    korrekturenMarkieren();
    if (cfgLokal.farbe && cfgLokal.farbe.modus === 'variable') farbenAnfordern();
    if (warSpeichern) toast(t('toast.gespeichert'));
  }

