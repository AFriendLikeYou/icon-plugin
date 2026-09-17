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

  // ---- Skizzen (Inline-SVG) ------------------------------------------------
  // Eine Akzentfarbe plus Grau, überall 2 px Strich wie in unseren Icons,
  // das Gitter sehr dezent. Keine dritte Farbe.
  const OB_AKZ = '#0d99ff', OB_GRAU = '#8a8a96';
  function obGitter(w, h, s) {
    let g = '';
    for (let x = s; x < w; x += s) g += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="' + h + '" stroke="#ffffff" stroke-opacity=".07"/>';
    for (let y = s; y < h; y += s) g += '<line x1="0" y1="' + y + '" x2="' + w + '" y2="' + y + '" stroke="#ffffff" stroke-opacity=".07"/>';
    return g;
  }
  function obSvg(w, h, inhalt) {
    return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">'
      + obGitter(w, h, 12) + inhalt + '</svg>';
  }
  function obKasten(x, y, s, farbe, gestrichelt) {
    return '<rect x="' + x + '" y="' + y + '" width="' + s + '" height="' + s + '" rx="4" fill="none" stroke="'
      + farbe + '" stroke-width="2"' + (gestrichelt ? ' stroke-dasharray="4 3"' : '') + '/>';
  }
  function obPfeil(x, y) {
    return '<path d="M' + x + ' ' + y + ' h14 m-5 -5 l5 5 l-5 5" fill="none" stroke="' + OB_GRAU
      + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  // Schritt 1: Vorlage (groß, mit Keyline) → drei Zielgrößen.
  function obSkizzeGroessen() {
    let i = obKasten(4, 12, 84, OB_GRAU) + obKasten(16, 24, 60, OB_AKZ, true);
    i += obPfeil(96, 54);
    [[120, 34, 40], [172, 42, 30], [212, 48, 24]].forEach(k => {
      i += obKasten(k[0], k[1], k[2], OB_GRAU) + obKasten(k[0] + 4, k[1] + 4, k[2] - 8, OB_AKZ, true);
    });
    return '<div class="skizze">' + obSvg(248, 108, i) + '</div>';
  }
  // Schritt 2: erkannter Modus — ZDS-Board als Kartenraster, Frei als Einzelstück.
  function obSkizzeModus() {
    let i = '';
    if (adapterAktiv === 'zds') {
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++)
        i += obKasten(6 + c * 44, 10 + r * 44, 34, (c === 1 && r === 0) ? OB_AKZ : OB_GRAU);
    } else {
      i = obKasten(40, 14, 64, OB_AKZ)
        + '<circle cx="40" cy="14" r="3" fill="' + OB_GRAU + '"/><circle cx="104" cy="14" r="3" fill="' + OB_GRAU + '"/>'
        + '<circle cx="40" cy="78" r="3" fill="' + OB_GRAU + '"/><circle cx="104" cy="78" r="3" fill="' + OB_GRAU + '"/>';
    }
    return '<div class="skizze">' + obSvg(146, 100, i) + '</div>';
  }
  // Schritt 3: auswählen → Vorschau → bauen, der letzte Schritt im Akzent.
  function obSkizzeAblauf() {
    const stufe = (x, f) => obKasten(x, 26, 44, f);
    const i = stufe(6, OB_GRAU) + obPfeil(56, 48) + stufe(78, OB_GRAU) + obPfeil(128, 48) + stufe(150, OB_AKZ);
    return '<div class="skizze">' + obSvg(204, 100, i) + '</div>';
  }
  // Schritt 4: Vollversion — Schloss offen, Häkchenliste.
  function obSkizzeLizenz() {
    let i = '<rect x="18" y="44" width="44" height="34" rx="6" fill="none" stroke="' + OB_AKZ + '" stroke-width="2"/>'
      + '<path d="M28 44 v-8 a12 12 0 0 1 24 0" fill="none" stroke="' + OB_GRAU + '" stroke-width="2" stroke-linecap="round"/>'
      + '<circle cx="40" cy="61" r="4" fill="' + OB_AKZ + '"/>';
    [0, 1, 2].forEach(k => {
      const y = 34 + k * 18;
      i += '<path d="M78 ' + y + ' l5 5 l9 -10" fill="none" stroke="' + OB_AKZ
        + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
        + '<line x1="100" y1="' + y + '" x2="' + (100 + [54, 40, 48][k]) + '" y2="' + y
        + '" stroke="' + OB_GRAU + '" stroke-width="2" stroke-linecap="round"/>';
    });
    return '<div class="skizze">' + obSvg(180, 100, i) + '</div>';
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
    return { bild: obSkizzeLizenz(), titel: t('ob.4.titel'), text: t('ob.4.text'), lizenz: true };
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
    if (s.lizenz) {
      const h = document.createElement('div');
      h.className = 'fhilfe';
      h.textContent = t('liz.figma');
      extra.appendChild(h);
    }
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
