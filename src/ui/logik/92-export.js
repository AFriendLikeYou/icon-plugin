  // =========================================================================
  // SVG-Export → ZIP (Store-Methode, CRC32, ohne Bibliothek)
  // =========================================================================
  $('btnExport').addEventListener('click', () => {
    if (beschaeftigt) return;
    const umfang = String($('segUmfang').value || 'alle') === 'auswahl' ? 'auswahl' : 'alle';
    $('fazit').className = 'fazit';
    sperren(true);
    send({ type: 'exportieren', umfang: umfang });
  });

  let CRC_TAB = null;
  function crcTabelle() {
    if (CRC_TAB) return CRC_TAB;
    const t8 = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t8[n] = c >>> 0;
    }
    CRC_TAB = t8;
    return t8;
  }
  function crc32(bytes) {
    const tb = crcTabelle();
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = tb[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  // Minimales ZIP: lokale Dateiheader + zentrales Verzeichnis + End-Record.
  // Nur Methode 0 (Store), Namen UTF-8 (Flag Bit 11), keine Zeitstempel.
  function zipBauen(eintraege) {
    const enc = new TextEncoder();
    const teile = [], zentral = [];
    let offset = 0;
    eintraege.forEach(e => {
      const name = enc.encode(e.name);
      const daten = e.bytes;
      const crc = crc32(daten);
      const lh = new Uint8Array(30 + name.length);
      const lv = new DataView(lh.buffer);
      lv.setUint32(0, 0x04034B50, true);
      lv.setUint16(4, 20, true);         // benötigte Version
      lv.setUint16(6, 0x0800, true);     // Flags: Bit 11 = UTF-8
      lv.setUint16(8, 0, true);          // Methode 0 = Store
      lv.setUint16(10, 0, true);         // Zeit
      lv.setUint16(12, 0x2821, true);    // Datum (2000-01-01)
      lv.setUint32(14, crc, true);
      lv.setUint32(18, daten.length, true);
      lv.setUint32(22, daten.length, true);
      lv.setUint16(26, name.length, true);
      lv.setUint16(28, 0, true);
      lh.set(name, 30);
      teile.push(lh, daten);

      const ch = new Uint8Array(46 + name.length);
      const cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014B50, true);
      cv.setUint16(4, 20, true);         // erstellt von
      cv.setUint16(6, 20, true);         // benötigte Version
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true);
      cv.setUint16(14, 0x2821, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, daten.length, true);
      cv.setUint32(24, daten.length, true);
      cv.setUint16(28, name.length, true);
      cv.setUint16(30, 0, true);         // extra
      cv.setUint16(32, 0, true);         // Kommentar
      cv.setUint16(34, 0, true);         // Datenträger
      cv.setUint16(36, 0, true);         // interne Attribute
      cv.setUint32(38, 0, true);         // externe Attribute
      cv.setUint32(42, offset, true);
      ch.set(name, 46);
      zentral.push(ch);
      offset += lh.length + daten.length;
    });
    let zLaenge = 0;
    zentral.forEach(c => { zLaenge += c.length; });
    const ende = new Uint8Array(22);
    const ev = new DataView(ende.buffer);
    ev.setUint32(0, 0x06054B50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, eintraege.length, true);
    ev.setUint16(10, eintraege.length, true);
    ev.setUint32(12, zLaenge, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);
    return new Blob(teile.concat(zentral, [ende]), { type: 'application/zip' });
  }

  // sprite.svg: je Icon-SVG ein <symbol id="name-N" viewBox="…">.
  function spriteBauen(dateien) {
    const teile = [];
    dateien.forEach(d => {
      const pfad = String(d.pfad || '');
      if (!/\.svg$/i.test(pfad)) return;
      const inhalt = String(d.inhalt || '');
      const auf = inhalt.match(/<svg\b[^>]*>/i);
      if (!auf) return;
      const zu = inhalt.lastIndexOf('</svg>');
      if (zu < 0) return;
      const innen = inhalt.slice(auf.index + auf[0].length, zu);
      const vb = auf[0].match(/viewBox="([^"]*)"/i);
      const basis = pfad.split('/').pop().replace(/\.svg$/i, '');
      teile.push('<symbol id="' + esc(basis) + '"'
        + (vb ? ' viewBox="' + esc(vb[1]) + '"' : '') + '>' + innen + '</symbol>');
    });
    if (!teile.length) return null;
    return '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n'
      + teile.join('\n') + '\n</svg>\n';
  }

  function exportEmpfangen(m) {
    exportFehlend = m.fehlend || [];
    const box = $('exportFehlt'), liste = $('exportFehltListe');
    liste.textContent = '';
    box.hidden = !exportFehlend.length;
    exportFehlend.forEach(n => {
      const li = document.createElement('li');
      li.textContent = n;
      liste.appendChild(li);
    });
    const dateien = m.dateien || [];
    if (!dateien.length) { toast(t('ber.exportLeer')); return; }
    const enc = new TextEncoder();
    const eintraege = dateien.map(d => ({ name: String(d.pfad), bytes: enc.encode(String(d.inhalt == null ? '' : d.inhalt)) }));
    if ($('chkSprite').checked) {
      const sp = spriteBauen(dateien);
      if (sp) eintraege.push({ name: 'sprite.svg', bytes: enc.encode(sp) });
    }
    dateiLaden('icons.zip', zipBauen(eintraege));
    toast(t('toast.zip'));
  }

