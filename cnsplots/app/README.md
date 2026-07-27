---
title: cnsplots
emoji: 📊
colorFrom: red
colorTo: gray
sdk: streamlit
app_file: app.py
pinned: false
short_description: Gráficos prontos para publicação (Cell/Nature/Science)
---

# cnsplots — app

Página onde qualquer pessoa envia uma tabela (CSV/Excel), escolhe o tipo de
gráfico, mapeia as colunas e baixa a figura em SVG/PNG/PDF — usando a
biblioteca [cnsplots](https://github.com/faridrashidi/cnsplots).

O gráfico é gerado no servidor (Python + matplotlib). Este repositório é o
**motor**; a página pública fica no repositório `toolhub` (GitHub Pages) e
embute este app. Veja o `SETUP.md` para o passo a passo completo.

> O bloco `---` no topo deste arquivo é usado pelo **Hugging Face Spaces**.
> O **Streamlit Community Cloud** ignora esse bloco — funciona nos dois.

## Rodar localmente

```bash
pip install -r requirements.txt
streamlit run app.py
```

## Senha (opcional)

Copie `.streamlit/secrets.toml.example` para `.streamlit/secrets.toml` e defina
`app_password`. No Streamlit Cloud, cole isso em *App settings → Secrets*.
No Hugging Face, use *Settings → Repository secrets*.

## Tipos de gráfico

22 tipos: categóricos (box, violin, bar, strip, lollipop, barras empilhadas,
matriz de confusão), correlação (scatter, regressão, linha), distribuição
(histograma, KDE, dist, QQ, ridge), composição (pizza, rosca), fluxo (Sankey),
sobrevivência (Kaplan-Meier, incidência cumulativa), genômica (volcano) e
machine learning (curva ROC). Para adicionar novos, edite a lista `PLOTS` em
`app.py`.
