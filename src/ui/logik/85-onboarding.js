  // =========================================================================
  // Onboarding — Slideshow beim ersten Start, Merker, Checkliste „Erste Schritte“
  // =========================================================================

  // ---- Merker (clientStorage über den Hauptthread) ------------------------
  function merkerLaden(schluessel) { send({ type: 'merkerLaden', schluessel: schluessel }); }
  function merkerSetzen(schluessel, w) { send({ type: 'merkerSetzen', schluessel: schluessel, wert: w }); }

  let onboardingGesehen = null;          // null = noch nicht beantwortet
  let ersteSchritte = { auswahl: false, vorschau: false, bauen: false };
  let ersteSchritteAus = false;

  bei('merker', m => {
    if (!m) return;
    if (m.schluessel === 'onboardingGesehen') {
      onboardingGesehen = !!m.wert;
      if (!onboardingGesehen) obAuf(0);
    }
    if (m.schluessel === 'ersteSchritte' && m.wert && typeof m.wert === 'object') {
      ersteSchritte = {
        auswahl: !!m.wert.auswahl, vorschau: !!m.wert.vorschau, bauen: !!m.wert.bauen
      };
      ersteSchritteZeichnen($('esKarte'));
    }
    if (m.schluessel === 'ersteSchritteAus') {
      ersteSchritteAus = !!m.wert;
      ersteSchritteZeichnen($('esKarte'));
    }
  });

  // ---- Checkliste „Erste Schritte“ ---------------------------------------
  function esMarkieren(feld) {
    if (ersteSchritte[feld]) return;
    ersteSchritte[feld] = true;
    merkerSetzen('ersteSchritte', ersteSchritte);
    ersteSchritteZeichnen($('esKarte'));
  }
  bei('auswahl', m => { if (m && m.ziel) esMarkieren('auswahl'); });
  bei('diff', () => esMarkieren('vorschau'));
  bei('fazit', () => esMarkieren('bauen'));

  function ersteSchritteZeichnen(halter) {
    if (!halter) return;
    const fertig = ersteSchritte.auswahl && ersteSchritte.vorschau && ersteSchritte.bauen;
    halter.textContent = '';
    if (ersteSchritteAus || fertig) return;
    const karte = document.createElement('div');
    karte.className = 'eskarte';
    const kopf = document.createElement('div');
    kopf.className = 'eskopf';
    const ti = document.createElement('span');
    ti.className = 'estitel';
    ti.textContent = t('es.titel');
    kopf.appendChild(ti);
    const weg = document.createElement('fig-button');
    weg.setAttribute('variant', 'ghost');
    weg.textContent = t('es.ausblenden');
    weg.addEventListener('click', () => {
      ersteSchritteAus = true;
      merkerSetzen('ersteSchritteAus', true);
      ersteSchritteZeichnen(halter);
    });
    kopf.appendChild(weg);
    karte.appendChild(kopf);
    const liste = document.createElement('div');
    liste.className = 'esliste';
    [['auswahl', 'es.auswahl'], ['vorschau', 'es.vorschau'], ['bauen', 'es.bauen']].forEach(p => {
      const z = document.createElement('div');
      z.className = 'eszeile' + (ersteSchritte[p[0]] ? ' fertig' : '');
      const h = document.createElement('span');
      h.className = 'haken';
      h.textContent = '✓';
      z.appendChild(h);
      const s = document.createElement('span');
      s.textContent = t(p[1]);
      z.appendChild(s);
      liste.appendChild(z);
    });
    karte.appendChild(liste);
    halter.appendChild(karte);
  }

  // ---- Skizzen (Inline-SVG, Plugin-Farben) --------------------------------
  function obMasterCfg() {
    return (cfgLokal && cfgLokal.master)
      || { groesse: 72, keylines: { Square: 56, Circular: 60, Wide: 64, Tall: 64 } };
  }
  // Keylines für eine Zielgröße: aus der Konfig, sonst proportional zum Master.
  function obKeylines(N) {
    const g = ((cfgLokal && cfgLokal.groessen) || []).filter(x => x.N === N)[0];
    if (g && g.keylines) return g.keylines;
    const m = obMasterCfg(), f = N / (m.groesse || 72), k = {};
    KLASSEN.forEach(kl => { k[kl] = Math.round(m.keylines[kl] * f * 2) / 2; });
    return k;
  }
  // Schritt 1: Master-Kasten, Pfeil, drei kleine Kästen nebeneinander.
  function obSkizzeGroessen() {
    const m = obMasterCfg();
    const klein = [24, 18, 14].map(N => keylineSvg(N, obKeylines(N), 22 + N)).join('');
    return '<div class="skizze">' + keylineSvg(m.groesse, m.keylines, 96)
      + '<span class="pfeil">→</span>' + klein + '</div>';
  }
  // Schritt 2: erkannter Modus — ZDS-Board als Kartenraster, Frei als einzelne Komponente.
  function obSkizzeModus() {
    const zds = adapterAktiv === 'zds';
    const kasten = (x, y, w, h, f, o) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h
      + '" rx="4" fill="' + f + '" fill-opacity="' + (o || .18) + '" stroke="' + f + '" stroke-opacity=".8"/>';
    let inhalt = '';
    if (zds) {
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
        inhalt += kasten(4 + c * 40, 4 + r * 40, 32, 32, c === 1 && r === 0 ? '#0d99ff' : '#8a8a96', c === 1 && r === 0 ? .3 : .12);
      }
    } else {
      inhalt = kasten(20, 8, 72, 72, '#0d99ff', .16)
        + '<circle cx="20" cy="8" r="3" fill="#0d99ff"/><circle cx="92" cy="8" r="3" fill="#0d99ff"/>'
        + '<circle cx="20" cy="80" r="3" fill="#0d99ff"/><circle cx="92" cy="80" r="3" fill="#0d99ff"/>';
    }
    return '<div class="skizze"><svg width="120" height="88" viewBox="0 0 120 88">' + inhalt + '</svg></div>';
  }
  // Schritt 3: Ablauf auswählen → Vorschau → Bauen.
  function obSkizzeAblauf() {
    const stufe = (x, f) => '<rect x="' + x + '" y="20" width="44" height="44" rx="8" fill="' + f
      + '" fill-opacity=".16" stroke="' + f + '" stroke-opacity=".85"/>';
    const pfeil = x => '<path d="M' + x + ' 42 h12 m-4 -4 l4 4 l-4 4" stroke="#cfc9e6" stroke-opacity=".6" fill="none" stroke-width="1.5"/>';
    return '<div class="skizze"><svg width="176" height="84" viewBox="0 0 176 84">'
      + stufe(4, '#5b5bd6') + pfeil(50) + stufe(66, '#0e8a9a') + pfeil(112) + stufe(128, '#12a76a')
      + '</svg></div>';
  }
  // Schritt 4: Mini-Bericht mit Balken und Schloss.
  function obSkizzeBericht() {
    let zeilen = '';
    [0.9, 0.62, 0.78, 0.35].forEach((w, i) => {
      zeilen += '<rect x="4" y="' + (6 + i * 18) + '" width="34" height="8" rx="3" fill="#ffffff" fill-opacity=".18"/>'
        + '<rect x="44" y="' + (6 + i * 18) + '" width="' + (72 * w) + '" height="8" rx="3" fill="'
        + (w > 0.75 ? '#12a76a' : w > 0.5 ? '#c98a12' : '#c2402a') + '" fill-opacity=".75"/>';
    });
    return '<div class="skizze"><svg width="124" height="82" viewBox="0 0 124 82">' + zeilen + '</svg>'
      + '<svg width="44" height="52" viewBox="0 0 44 52">'
      + '<rect x="8" y="20" width="28" height="22" rx="4" fill="#0d99ff" fill-opacity=".22" stroke="#0d99ff"/>'
      + '<path d="M14 20 v-5 a8 8 0 0 1 16 0 v5" fill="none" stroke="#0d99ff" stroke-width="2"/></svg></div>';
  }

  // ---- Slideshow ----------------------------------------------------------
  const OB_ANZ = 4;
  let obSchritt = 0, obOffen = false;

  function obInhalt(i) {
    const modus = adapterAktiv === 'zds' ? t('adapter.zds') : t('adapter.frei');
    if (i === 0) return { bild: obSkizzeGroessen(), titel: t('ob.1.titel'), text: t('ob.1.text') };
    if (i === 1) return { bild: obSkizzeModus(), titel: t('ob.2.titel', { modus: modus }),
      text: adapterAktiv === 'zds' ? t('ob.2.textZds') : t('ob.2.textFrei'), profile: true };
    if (i === 2) return { bild: obSkizzeAblauf(), titel: t('ob.3.titel'), text: t('ob.3.text') };
    return { bild: obSkizzeBericht(), titel: t('ob.4.titel'), text: t('ob.4.text') };
  }

  function obZeichnen() {
    const s = obInhalt(obSchritt);
    $('obBild').innerHTML = s.bild;
    $('obZaehler').textContent = t('ob.zaehler', { i: obSchritt + 1, n: OB_ANZ });
    $('obTitel').textContent = s.titel;
    $('obText').textContent = s.text;
    $('obSkip').textContent = t('ob.ueberspringen');
    $('obZurueck').textContent = t('ob.zurueck');
    aus($('obZurueck'), obSchritt === 0);
    $('obWeiter').textContent = obSchritt === OB_ANZ - 1 ? t('ob.los') : t('ob.weiter');

    // Profilwahl auf Schritt 2
    const extra = $('obExtra');
    extra.textContent = '';
    if (s.profile) {
      const info = (profilInfo && profilInfo.length)
        ? profilInfo
        : (profile || []).map(n => ({ name: n, titel: t('profil.' + n), beschreibung: '' }));
      const liste = document.createElement('div');
      liste.className = 'profilliste';
      info.forEach(p => {
        const k = document.createElement('div');
        k.className = 'profilkarte';
        const ti = document.createElement('div');
        ti.className = 'ptitel';
        ti.textContent = (p.titel || t('profil.' + p.name)) + ' — ' + t('ob.2.profil');
        k.appendChild(ti);
        if (p.beschreibung) {
          const b = document.createElement('div');
          b.className = 'pbeschr';
          b.textContent = p.beschreibung;
          k.appendChild(b);
        }
        k.addEventListener('click', () => {
          profilWahl = p.name;
          wartetAufSpeichern = false;
          send({ type: 'konfigZuruecksetzen', profil: p.name });
          liste.querySelectorAll('.profilkarte').forEach(x => x.classList.remove('gewaehlt'));
          k.classList.add('gewaehlt');
        });
        liste.appendChild(k);
      });
      extra.appendChild(liste);
    }

    // Punkt-Navigation
    const dots = $('obDots');
    dots.textContent = '';
    for (let i = 0; i < OB_ANZ; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      if (i === obSchritt) b.className = 'an';
      b.setAttribute('aria-label', t('ob.punkt', { i: i + 1 }));
      b.addEventListener('click', () => obGehe(i));
      dots.appendChild(b);
    }
  }

  // Wechsel mit kurzer Ein-/Ausblendung (CSS, 180 ms).
  function obGehe(i) {
    if (i < 0 || i >= OB_ANZ || i === obSchritt) return;
    const dlg = $('dlgOnboarding');
    dlg.classList.add('bh-wechsel');
    setTimeout(() => {
      obSchritt = i;
      obZeichnen();
      dlg.classList.remove('bh-wechsel');
    }, 180);
  }

  function obAuf(schritt) {
    obSchritt = schritt || 0;
    obOffen = true;
    obZeichnen();
    dialogAuf('dlgOnboarding');
  }
  function obZu() {
    obOffen = false;
    dialogZu('dlgOnboarding');
    if (!onboardingGesehen) { onboardingGesehen = true; merkerSetzen('onboardingGesehen', true); }
    paywallStartPruefen();
  }

  $('obSkip').addEventListener('click', obZu);
  $('obZurueck').addEventListener('click', () => obGehe(obSchritt - 1));
  $('obWeiter').addEventListener('click', () => {
    if (obSchritt === OB_ANZ - 1) obZu(); else obGehe(obSchritt + 1);
  });
  $('btnRundgang').addEventListener('click', () => obAuf(0));
  // Esc schließt den Dialog von selbst — das zählt als „überspringen“.
  $('dlgOnboarding').addEventListener('close', () => {
    if (obOffen) obZu();
  });
  document.addEventListener('keydown', e => {
    if (!obOffen) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); obGehe(obSchritt + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); obGehe(obSchritt - 1); }
  });

  merkerLaden('onboardingGesehen');
  merkerLaden('ersteSchritte');
  merkerLaden('ersteSchritteAus');
