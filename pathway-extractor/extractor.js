// BioPathway Extractor - Core Logic Module
// Handles OCR processing, gene matching, and edge detection

class GeneDatabase {
  constructor() {
    this.symbols = new Set();
    this.symbolMap = new Map(); // lowercase -> canonical
    this.loaded = false;
  }

  async load(url = './data/gene_symbols.json') {
    try {
      const res = await fetch(url);
      const data = await res.json();
      
      // Flatten all symbols from categories
      Object.values(data.categories).forEach(arr => {
        arr.forEach(sym => {
          this.symbols.add(sym);
          this.symbolMap.set(sym.toLowerCase(), sym);
          this.symbolMap.set(sym.toUpperCase(), sym);
        });
      });

      // Also load explicit all_symbols if present
      if (data.all_symbols && data.all_symbols.length > 0) {
        data.all_symbols.forEach(sym => {
          this.symbols.add(sym);
          this.symbolMap.set(sym.toLowerCase(), sym);
        });
      }

      this.loaded = true;
      console.log(`GeneDB loaded: ${this.symbols.size} symbols`);
      return true;
    } catch (e) {
      console.error('Failed to load gene DB:', e);
      return false;
    }
  }

  // Load from user-provided JSON file
  async loadFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          let count = 0;
          
          // Accept various formats
          if (Array.isArray(data)) {
            data.forEach(sym => {
              if (typeof sym === 'string') {
                this.symbols.add(sym);
                this.symbolMap.set(sym.toLowerCase(), sym);
                count++;
              }
            });
          } else if (data.categories) {
            Object.values(data.categories).forEach(arr => {
              arr.forEach(sym => {
                this.symbols.add(sym);
                this.symbolMap.set(sym.toLowerCase(), sym);
                count++;
              });
            });
          } else if (data.symbols) {
            data.symbols.forEach(sym => {
              this.symbols.add(sym);
              this.symbolMap.set(sym.toLowerCase(), sym);
              count++;
            });
          }

          this.loaded = true;
          resolve(count);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    });
  }

  // Smart matching with OCR error correction
  match(rawText) {
    // Clean: remove trailing/leading punctuation
    let clean = rawText.replace(/[^a-zA-Z0-9\-αβγδεζηθ]/g, '');
    clean = clean.replace(/^[-]+|[-]+$/g, '');
    
    if (clean.length < 2) return null;

    // Exact match
    if (this.symbolMap.has(clean)) return this.symbolMap.get(clean);
    if (this.symbolMap.has(clean.toUpperCase())) return this.symbolMap.get(clean.toUpperCase());
    if (this.symbolMap.has(clean.toLowerCase())) return this.symbolMap.get(clean.toLowerCase());

    // OCR common corrections
    const corrected = this.applyOCRCorrections(clean);
    if (corrected !== clean) {
      if (this.symbolMap.has(corrected.toUpperCase())) return this.symbolMap.get(corrected.toUpperCase());
      if (this.symbolMap.has(corrected)) return this.symbolMap.get(corrected);
    }

    // Levenshtein distance for close matches
    const upper = clean.toUpperCase();
    for (const [key, canonical] of this.symbolMap) {
      const keyUpper = key.toUpperCase();
      if (Math.abs(keyUpper.length - upper.length) > 2) continue;
      const dist = this.levenshtein(upper, keyUpper);
      if (dist <= 1 && upper.length >= 3) return canonical;
    }

    return null;
  }

  applyOCRCorrections(text) {
    // Common OCR confusions
    return text
      .replace(/l/g, '1')   // lowercase l -> 1 (STAT1, JAK1)
      .replace(/O/g, '0')   // uppercase O -> 0 in some contexts
      .replace(/I(?=\d)/g, '1'); // I before digit -> 1
  }

  levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) =>
      Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = a[i-1] === b[j-1]
          ? dp[i-1][j-1]
          : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
      }
    }
    return dp[a.length][b.length];
  }
}


class PathwayExtractor {
  constructor(geneDB) {
    this.db = geneDB;
    this.nodes = [];
    this.edges = [];
    this.onLog = null;
  }

  log(msg) {
    if (this.onLog) this.onLog(msg);
    console.log(msg);
  }

  async runOCR(imageElement, confidenceThreshold = 50) {
    this.log('Iniciando Tesseract OCR...');
    const worker = await Tesseract.createWorker('eng', 1, {
      logger: m => { if (m.status === 'recognizing text') this.log(`OCR: ${Math.round(m.progress * 100)}%`); }
    });
    
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-αβγδ',
      preserve_interword_spaces: '1',
    });

    const { data } = await worker.recognize(imageElement);
    await worker.terminate();

    this.log(`OCR completo. ${data.words.length} palavras. Filtrando genes...`);
    return data.words.filter(w => w.confidence >= confidenceThreshold);
  }

  processNodes(words) {
    this.nodes = [];
    const seen = new Map();

    words.forEach(w => {
      const match = this.db.match(w.text);
      if (!match) return;

      const cx = (w.bbox.x0 + w.bbox.x1) / 2;
      const cy = (w.bbox.y0 + w.bbox.y1) / 2;

      // Deduplicate: merge if same gene within 30px
      if (seen.has(match)) {
        const existing = seen.get(match);
        const dist = Math.hypot(existing.cx - cx, existing.cy - cy);
        if (dist < 30) return; // skip duplicate
      }

      const node = {
        id: `node_${this.nodes.length}`,
        label: match,
        raw: w.text,
        conf: w.confidence,
        x: w.bbox.x0,
        y: w.bbox.y0,
        w: w.bbox.x1 - w.bbox.x0,
        h: w.bbox.y1 - w.bbox.y0,
        cx,
        cy
      };

      this.nodes.push(node);
      seen.set(match, node);
    });

    this.log(`Genes validados: ${this.nodes.length}`);
    return this.nodes;
  }

  detectEdgesWithOpenCV(imageElement, options = {}) {
    const {
      cannyLow = 50,
      cannyHigh = 150,
      maxDist = 400,
      pathThreshold = 0.2,
      lineThickness = 6,
      arrowTipSize = 15
    } = options;

    this.edges = [];

    let src = cv.imread(imageElement);
    let gray = new cv.Mat();
    let edgeMat = new cv.Mat();
    let blurred = new cv.Mat();

    // Preprocessing
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
    cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0);
    cv.Canny(blurred, edgeMat, cannyLow, cannyHigh, 3, false);

    // Dilate to close gaps
    let kernel = cv.Mat.ones(3, 3, cv.CV_8U);
    cv.dilate(edgeMat, edgeMat, kernel, new cv.Point(-1, -1), 2);

    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const n1 = this.nodes[i];
        const n2 = this.nodes[j];
        const dist = Math.hypot(n1.cx - n2.cx, n1.cy - n2.cy);

        if (dist > maxDist) continue;

        const score = this.computePathScore(edgeMat, n1, n2, lineThickness);
        if (score < pathThreshold) continue;

        // Determine directionality by checking for arrowhead near endpoints
        const arrowNear1 = this.detectArrowhead(edgeMat, n1, n2, arrowTipSize);
        const arrowNear2 = this.detectArrowhead(edgeMat, n2, n1, arrowTipSize);

        let type = 'undirected';
        let source = n1.label;
        let target = n2.label;

        if (arrowNear1 && arrowNear2) {
          type = 'bidirected';
        } else if (arrowNear2) {
          type = 'directed';
          source = n1.label;
          target = n2.label;
        } else if (arrowNear1) {
          type = 'directed';
          source = n2.label;
          target = n1.label;
        }

        // Physical interaction: very close bboxes
        if (this.boxesOverlap(n1, n2, 5)) {
          type = 'physical';
        }

        this.edges.push({
          id: `e_${i}_${j}`,
          source,
          target,
          type,
          score: Math.round(score * 100),
          sourceNode: n1,
          targetNode: n2
        });
      }
    }

    src.delete(); gray.delete(); edgeMat.delete(); blurred.delete(); kernel.delete();
    this.log(`Conexões detectadas: ${this.edges.length}`);
    return this.edges;
  }

  computePathScore(edgeMat, n1, n2, thickness) {
    let mask = new cv.Mat.zeros(edgeMat.rows, edgeMat.cols, cv.CV_8U);
    cv.line(mask,
      new cv.Point(Math.round(n1.cx), Math.round(n1.cy)),
      new cv.Point(Math.round(n2.cx), Math.round(n2.cy)),
      [255, 255, 255, 255], thickness
    );

    let intersection = new cv.Mat();
    cv.bitwise_and(mask, edgeMat, intersection);
    const overlap = cv.countNonZero(intersection);
    const lineLen = cv.countNonZero(mask);

    mask.delete(); intersection.delete();
    return lineLen > 0 ? overlap / lineLen : 0;
  }

  // Detect if there's an arrowhead near the target end of a line
  detectArrowhead(edgeMat, fromNode, toNode, tipSize) {
    const dx = toNode.cx - fromNode.cx;
    const dy = toNode.cy - fromNode.cy;
    const len = Math.hypot(dx, dy);
    if (len === 0) return false;

    // Sample region near the target node
    const tipX = Math.round(toNode.cx - (dx / len) * toNode.w * 0.5);
    const tipY = Math.round(toNode.cy - (dy / len) * toNode.h * 0.5);

    // Check a region near the tip for branching pixels (arrow pattern)
    const regionSize = tipSize;
    const x0 = Math.max(0, tipX - regionSize);
    const y0 = Math.max(0, tipY - regionSize);
    const x1 = Math.min(edgeMat.cols - 1, tipX + regionSize);
    const y1 = Math.min(edgeMat.rows - 1, tipY + regionSize);

    // Simple heuristic: count edge pixels in tip region
    // Real arrow detection would use contour analysis
    let count = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (edgeMat.ucharAt(y, x) > 0) count++;
      }
    }

    // Heuristic: arrowheads create extra pixel density at tips
    const area = (x1 - x0 + 1) * (y1 - y0 + 1);
    return (count / area) > 0.15;
  }

  boxesOverlap(n1, n2, padding = 0) {
    return !(n2.x > n1.x + n1.w + padding ||
             n2.x + n2.w < n1.x - padding ||
             n2.y > n1.y + n1.h + padding ||
             n2.y + n2.h < n1.y - padding);
  }

  exportCSV() {
    const header = 'source,target,interaction_type,confidence_score\n';
    const rows = this.edges.map(e =>
      `${e.source},${e.target},${e.type},${e.score}`
    ).join('\n');
    return header + rows;
  }

  exportJSON() {
    return JSON.stringify({
      nodes: this.nodes.map(n => ({ id: n.label, x: n.cx, y: n.cy, confidence: Math.round(n.conf) })),
      edges: this.edges.map(e => ({ source: e.source, target: e.target, type: e.type, score: e.score }))
    }, null, 2);
  }

  getCytoscapeElements() {
    const nodeEls = this.nodes.map(n => ({
      data: { id: n.label, label: n.label, conf: Math.round(n.conf) }
    }));

    const edgeEls = this.edges.map(e => ({
      data: {
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type,
        score: e.score
      }
    }));

    return [...nodeEls, ...edgeEls];
  }
}
