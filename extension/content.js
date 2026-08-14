(() => {
  const root = document.querySelector('#songContentTPL');
  if (!root || document.querySelector('#chordshift-toolbar')) return;

  const sharpNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const flatNotes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const chordPattern = /^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add|M|7|9|11|13|6|\+|°|\([^)]*\))*?(?:\/[A-G](?:#|b)?)?$/;
  let shift = 0;
  let useFlats = false;
  const originalNodes = [];

  function normalizeIndex(index) { return (index % 12 + 12) % 12; }

  function transposeChord(chord) {
    return chord.replace(/^([A-G](?:#|b)?)(.*?)(?:\/([A-G](?:#|b)?))?$/, (_, root, suffix, bass) => {
      const source = root.includes('b') ? flatNotes : sharpNotes;
      const output = useFlats ? flatNotes : sharpNotes;
      const rootIndex = source.indexOf(root);
      if (rootIndex < 0) return chord;
      const nextRoot = output[normalizeIndex(rootIndex + shift)];
      const nextBass = bass ? output[normalizeIndex(source.indexOf(bass) + shift)] : '';
      return `${nextRoot}${suffix}${nextBass ? `/${nextBass}` : ''}`;
    });
  }

  function isChordSequence(text) {
    const tokens = text.trim().split(/\s+/).filter(Boolean);
    return tokens.length > 0 && tokens.every((token) => chordPattern.test(token));
  }

  function wrapChordText(node) {
    const text = node.nodeValue || '';
    if (!text.trim() || !isChordSequence(text)) return;
    originalNodes.push({ node, text });
    const fragment = document.createDocumentFragment();
    const parts = text.split(/(\s+)/);
    parts.forEach((part) => {
      if (/\s+/.test(part)) fragment.appendChild(document.createTextNode(part));
      else {
        const span = document.createElement('span');
        span.className = 'chordshift-chord';
        span.dataset.original = part;
        span.textContent = part;
        fragment.appendChild(span);
      }
    });
    node.parentNode?.replaceChild(fragment, node);
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest('#chordshift-toolbar') || parent.classList.contains('chordshift-chord')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(wrapChordText);

  function render() {
    root.querySelectorAll('.chordshift-chord').forEach((span) => { span.textContent = transposeChord(span.dataset.original || ''); });
    const label = document.querySelector('#chordshift-step');
    if (label) label.textContent = shift > 0 ? `+${shift}` : `${shift}`;
  }

  function reset() {
    originalNodes.forEach(({ node, text }) => {
      const parent = node.parentNode;
      if (parent) parent.replaceWith(document.createTextNode(text));
    });
    location.reload();
  }

  const toolbar = document.createElement('aside');
  toolbar.id = 'chordshift-toolbar';
  toolbar.dir = 'rtl';
  toolbar.innerHTML = `
    <div class="chordshift-brand"><span class="chordshift-pick">⌁</span><strong>ChordShift</strong><small>שינוי אקורדים</small></div>
    <div class="chordshift-controls">
      <button id="chordshift-down" type="button" aria-label="הורד חצי טון">−</button>
      <strong id="chordshift-step">0</strong>
      <button id="chordshift-up" type="button" aria-label="העלה חצי טון">+</button>
    </div>
    <div class="chordshift-caption">חצאי טון</div>
    <div class="chordshift-actions"><button id="chordshift-flats" type="button">♯</button><button id="chordshift-reset" type="button">איפוס</button></div>
  `;
  document.body.appendChild(toolbar);

  toolbar.querySelector('#chordshift-down').addEventListener('click', () => { shift -= 1; render(); });
  toolbar.querySelector('#chordshift-up').addEventListener('click', () => { shift += 1; render(); });
  toolbar.querySelector('#chordshift-flats').addEventListener('click', (event) => { useFlats = !useFlats; event.currentTarget.textContent = useFlats ? '♭' : '♯'; render(); });
  toolbar.querySelector('#chordshift-reset').addEventListener('click', reset);
  document.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.key === '[') { shift -= 1; render(); }
    if (event.key === ']') { shift += 1; render(); }
  });
})();
