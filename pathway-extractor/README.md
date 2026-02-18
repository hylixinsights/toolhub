# BioPathway Extractor v3.0

Ferramenta web para extração de interações proteína-proteína a partir de imagens de pathway diagrams.

## Stack

- **Tesseract.js** — OCR para identificar símbolos de genes
- **OpenCV.js** — Detecção de linhas e arestas (WebAssembly)
- **Cytoscape.js** — Visualização do grafo extraído

## Estrutura

```
biopathway-extractor/
├── index.html          # Interface principal
├── js/
│   └── extractor.js    # Lógica de OCR, detecção e matching
└── data/
    └── gene_symbols.json  # Banco de símbolos (HGNC-curated)
```

## Como hospedar no GitHub Pages

1. Crie um repositório no GitHub
2. Faça upload de todos os arquivos mantendo a estrutura de pastas
3. Vá em Settings → Pages → Deploy from branch (main)
4. Acesse via `https://seu-usuario.github.io/biopathway-extractor/`

## Formatos de Gene DB aceitos

O botão "↑ JSON Externo" aceita JSON em qualquer um desses formatos:

**Array simples:**
```json
["STAT1", "JAK1", "AKT", "MTOR"]
```

**Com categorias:**
```json
{
  "categories": {
    "JAK_STAT": ["JAK1", "STAT1"],
    "PI3K_AKT": ["PI3K", "AKT"]
  }
}
```

**Com `symbols` array:**
```json
{
  "source": "HGNC",
  "symbols": ["TP53", "BRCA1", "EGFR"]
}
```

Para usar toda a lista HGNC (~43k genes), baixe de:
https://www.genenames.org/download/statistics-and-files/

## Tipos de Interação Detectados

| Tipo | Cor | Descrição |
|------|-----|-----------|
| `directed` | Azul → | Seta em uma extremidade |
| `bidirected` | Laranja ↔ | Setas em ambas extremidades |
| `undirected` | Verde — | Linha sem seta |
| `physical` | Vermelho ⋯ | Bounding boxes em contato |

## Exports

- **Edge List CSV** — `source,target,interaction_type,confidence_score`
- **Graph JSON** — Formato compatível com Cytoscape Desktop / NetworkX
- **SIF** — Simple Interaction Format (Cytoscape 2.x / STRING DB)

## Parâmetros

| Parâmetro | Default | Descrição |
|-----------|---------|-----------|
| OCR Confiança | 50% | Mínimo de confiança do Tesseract |
| Canny Low | 50 | Limiar inferior do detector de bordas |
| Canny High | 150 | Limiar superior do detector de bordas |
| Dist. Max | 400px | Distância máxima para considerar conexão |
| Path Threshold | 0.20 | % mínima de overlap entre linha imaginária e bordas reais |

## Limitações Conhecidas

- Setas curvas têm detecção menos precisa que setas retas
- OCR pode confundir caracteres similares (l/1, O/0) — o fuzzy matching corrige os mais comuns
- Imagens com fundo gradiente ou muito colorido se beneficiam de ajustar o Canny Low para baixo (~20)
