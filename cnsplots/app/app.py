"""
cnsplots web — página para gerar gráficos nível Cell/Nature/Science.

A pessoa: (1) faz upload de uma tabela (CSV/Excel), (2) escolhe o tipo de
gráfico, (3) mapeia as colunas da tabela para os papéis que o gráfico espera
e (4) baixa a figura em SVG/PNG/PDF.

O gráfico é gerado no servidor com a biblioteca `cnsplots` (matplotlib).
"""

from __future__ import annotations

import contextlib
import io
import os
import tempfile

import matplotlib

matplotlib.use("Agg")  # backend sem tela, obrigatório no servidor

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import streamlit as st

import cnsplots as cns

# --------------------------------------------------------------------------- #
# Opções globais
# --------------------------------------------------------------------------- #
QUAL_PALETTES = [
    "Ecotyper1", "Ecotyper2", "Ecotyper3", "Ecotyper4", "Ecotyper5",
    "Ecotyper6", "Cell", "Nature", "Science", "Set1", "Set2", "Set3",
    "Tableau", "Bold",
]
SEQ_CMAPS = [
    "viridis", "magma", "plasma", "cividis",
    "Blues", "Reds", "Greens", "Purples", "coolwarm",
]

# Rótulos amigáveis para os "tipos" de coluna
KIND_LABEL = {
    "num": "numérica",
    "cat": "categórica (texto / grupos)",
    "any": "qualquer",
    "binary": "binária (evento sim/não, ex.: 0 e 1)",
    "intevent": "inteira (0 = censura, 1, 2, … = eventos)",
    "prob": "probabilidade entre 0 e 1",
}

# --------------------------------------------------------------------------- #
# Catálogo de gráficos
# Cada papel (role) = (parametro, rotulo, tipo, obrigatorio)
# --------------------------------------------------------------------------- #
PLOTS = [
    # ---- Categóricos -----------------------------------------------------
    {"key": "boxplot", "label": "Box plot", "cat": "Categóricos", "func": "boxplot",
     "desc": "Distribuição de um valor numérico comparando categorias.",
     "roles": [("x", "Eixo X — grupos", "cat", True),
               ("y", "Eixo Y — valor numérico", "num", True),
               ("hue", "Subgrupo (cor) — opcional", "cat", False)],
     "palette": True, "pairs": True},
    {"key": "violinplot", "label": "Violin plot", "cat": "Categóricos", "func": "violinplot",
     "desc": "Como o box plot, mas mostrando a forma da distribuição.",
     "roles": [("x", "Eixo X — grupos", "cat", True),
               ("y", "Eixo Y — valor numérico", "num", True),
               ("hue", "Subgrupo (cor) — opcional", "cat", False)],
     "palette": True, "pairs": True},
    {"key": "barplot", "label": "Bar plot", "cat": "Categóricos", "func": "barplot",
     "desc": "Média (± erro) de um valor por categoria.",
     "roles": [("x", "Eixo X — grupos", "cat", True),
               ("y", "Eixo Y — valor numérico", "num", True),
               ("hue", "Subgrupo (cor) — opcional", "cat", False)],
     "palette": True, "pairs": True},
    {"key": "stripplot", "label": "Strip plot", "cat": "Categóricos", "func": "stripplot",
     "desc": "Pontos individuais por categoria (com mediana).",
     "roles": [("x", "Eixo X — grupos", "cat", True),
               ("y", "Eixo Y — valor numérico", "num", True),
               ("hue", "Subgrupo (cor) — opcional", "cat", False)],
     "palette": True, "pairs": True},
    {"key": "lollipopplot", "label": "Lollipop plot", "cat": "Categóricos", "func": "lollipopplot",
     "desc": "Valor por categoria em formato de 'pirulito'.",
     "roles": [("x", "Eixo X — grupos", "cat", True),
               ("y", "Eixo Y — valor numérico", "num", True),
               ("hue", "Subgrupo (cor) — opcional", "cat", False)],
     "palette": True, "pairs": True},
    {"key": "stackplot", "label": "Stacked bar (proporção)", "cat": "Categóricos", "func": "stackplot",
     "desc": "Barras empilhadas mostrando a composição de cada grupo.",
     "roles": [("x", "Eixo X — grupos", "cat", True),
               ("stack", "Empilhar por (composição)", "cat", True)],
     "palette": True, "pairs": True},
    {"key": "confusionplot", "label": "Matriz de confusão / contingência", "cat": "Categóricos", "func": "confusionplot",
     "desc": "Tabela cruzada entre duas variáveis categóricas.",
     "roles": [("x", "Eixo X (ex.: predito)", "cat", True),
               ("y", "Eixo Y (ex.: real)", "cat", True)],
     "cmap": True,
     "note": "As duas colunas devem ser categóricas. Ideal para comparar rótulo real × predito."},

    # ---- Correlação ------------------------------------------------------
    {"key": "scatterplot", "label": "Scatter plot", "cat": "Correlação", "func": "scatterplot",
     "desc": "Relação entre duas variáveis numéricas.",
     "roles": [("x", "Eixo X — numérico", "num", True),
               ("y", "Eixo Y — numérico", "num", True),
               ("hue", "Cor por grupo — opcional", "cat", False)],
     "palette": True},
    {"key": "regplot", "label": "Regressão (scatter + linha)", "cat": "Correlação", "func": "regplot",
     "desc": "Dispersão com linha de tendência ajustada.",
     "roles": [("x", "Eixo X — numérico", "num", True),
               ("y", "Eixo Y — numérico", "num", True),
               ("hue", "Cor por grupo — opcional", "cat", False)],
     "palette": True},
    {"key": "lineplot", "label": "Line plot", "cat": "Correlação", "func": "lineplot",
     "desc": "Valor ao longo de um eixo ordenado (ex.: tempo).",
     "roles": [("x", "Eixo X (ex.: tempo)", "any", True),
               ("y", "Eixo Y — numérico", "num", True),
               ("hue", "Cor por grupo — opcional", "cat", False)],
     "palette": True},

    # ---- Distribuição ----------------------------------------------------
    {"key": "histplot", "label": "Histograma", "cat": "Distribuição", "func": "histplot",
     "desc": "Frequência de uma variável numérica.",
     "roles": [("x", "Variável — numérica", "num", True),
               ("hue", "Cor por grupo — opcional", "cat", False)],
     "palette": True},
    {"key": "kdeplot", "label": "Densidade (KDE)", "cat": "Distribuição", "func": "kdeplot",
     "desc": "Curva de densidade suavizada.",
     "roles": [("x", "Variável — numérica", "num", True),
               ("hue", "Cor por grupo — opcional", "cat", False)],
     "palette": True},
    {"key": "distplot", "label": "Distribuição (hist + KDE)", "cat": "Distribuição", "func": "distplot",
     "desc": "Histograma combinado com curva de densidade.",
     "roles": [("x", "Variável — numérica", "num", True),
               ("hue", "Cor por grupo — opcional", "cat", False)],
     "palette": True},
    {"key": "qqplot", "label": "QQ plot (normalidade)", "cat": "Distribuição", "func": "qqplot",
     "desc": "Compara a distribuição da variável com a normal teórica.",
     "roles": [("x", "Variável — numérica", "num", True)]},
    {"key": "ridgeplot", "label": "Ridge plot", "cat": "Distribuição", "func": "ridgeplot",
     "desc": "Uma densidade por grupo, empilhadas verticalmente.",
     "roles": [("x", "Valor — numérico", "num", True),
               ("y", "Grupos (linhas)", "cat", True)],
     "cmap": True},

    # ---- Composição ------------------------------------------------------
    {"key": "pieplot", "label": "Pizza (pie)", "cat": "Composição", "func": "pieplot",
     "desc": "Proporção de cada categoria (contagem automática).",
     "roles": [("x", "Categoria", "cat", True)],
     "palette": True},
    {"key": "donutplot", "label": "Rosca (donut)", "cat": "Composição", "func": "donutplot",
     "desc": "Igual à pizza, com o centro vazado.",
     "roles": [("x", "Categoria", "cat", True)],
     "palette": True},

    # ---- Fluxo -----------------------------------------------------------
    {"key": "sankeyplot", "label": "Sankey (fluxo)", "cat": "Fluxo", "func": "sankeyplot",
     "desc": "Fluxo entre duas categorias (origem → destino).",
     "roles": [("x", "Origem", "cat", True),
               ("y", "Destino", "cat", True)],
     "palette": True},

    # ---- Sobrevivência ---------------------------------------------------
    {"key": "survivalplot", "label": "Sobrevivência (Kaplan-Meier)", "cat": "Sobrevivência", "func": "survivalplot",
     "desc": "Curva de sobrevivência por grupo, com teste log-rank.",
     "roles": [("duration", "Tempo até o evento/censura", "num", True),
               ("event", "Evento (1 = ocorreu, 0 = censurado)", "binary", True),
               ("hue", "Grupo", "cat", True)],
     "palette": True,
     "note": "A coluna de evento deve indicar 1 = evento ocorreu, 0 = censurado. "
             "Se a sua coluna usar outros valores (ex.: 'vivo'/'morto'), o app pergunta qual valor é o evento."},
    {"key": "cumulativeincidenceplot", "label": "Incidência cumulativa", "cat": "Sobrevivência", "func": "cumulativeincidenceplot",
     "desc": "Incidência acumulada com riscos competitivos.",
     "roles": [("duration", "Tempo", "num", True),
               ("event", "Evento (0 = censura, 1, 2, … = eventos)", "intevent", True),
               ("hue", "Grupo", "cat", True)],
     "palette": True,
     "note": "A coluna de evento deve ser inteira: 0 = censurado, 1/2/… = tipos de evento (riscos competitivos)."},

    # ---- Genômica --------------------------------------------------------
    {"key": "volcanoplot", "label": "Volcano plot", "cat": "Genômica", "func": "volcanoplot",
     "desc": "Expressão diferencial: fold-change × significância.",
     "roles": [("x", "log2 Fold Change", "num", True),
               ("y", "-log10(p ajustado)", "num", True),
               ("symbol", "Nome/símbolo do gene", "any", True)],
     "note": "Tabela típica de análise diferencial: uma linha por gene, com log2FC, "
             "-log10 do p-valor ajustado e o símbolo do gene."},

    # ---- Machine Learning ------------------------------------------------
    {"key": "rocplot", "label": "Curva ROC", "cat": "Machine Learning", "func": "rocplot",
     "desc": "Curva ROC com AUC a partir de rótulos e probabilidades.",
     "roles": [("true_label_col", "Rótulo real (0/1)", "binary", True),
               ("pred_prob_cols", "Probabilidade predita (0–1)", "prob", True)],
     "palette": True,
     "note": "Rótulo real binário (0/1) e a probabilidade prevista pelo modelo (entre 0 e 1)."},
]

SPEC = {p["key"]: p for p in PLOTS}
CATEGORIES = list(dict.fromkeys(p["cat"] for p in PLOTS))
NONE = "— nenhuma —"


# --------------------------------------------------------------------------- #
# Núcleo (sem Streamlit) — fácil de testar
# --------------------------------------------------------------------------- #
def read_table(file, sep: str = "auto", decimal: str = ".") -> pd.DataFrame:
    """Lê CSV/TSV/Excel enviado pelo usuário."""
    name = file.name.lower()
    if name.endswith((".xlsx", ".xls")):
        return pd.read_excel(file)
    raw = file.getvalue() if hasattr(file, "getvalue") else file.read()
    if isinstance(raw, str):
        raw = raw.encode()
    sep_arg = None if sep == "auto" else {"vírgula (,)": ",", "ponto e vírgula (;)": ";",
                                          "tab": "\t"}.get(sep, sep)
    return pd.read_csv(io.BytesIO(raw), sep=sep_arg, engine="python", decimal=decimal)


def is_numeric(s: pd.Series) -> bool:
    return pd.api.types.is_numeric_dtype(s) and not pd.api.types.is_bool_dtype(s)


def columns_for(df: pd.DataFrame, kind: str) -> list[str]:
    """Ordena as colunas colocando primeiro as mais adequadas ao tipo do papel."""
    cols = list(df.columns)
    if kind in ("num", "prob"):
        good = [c for c in cols if is_numeric(df[c])]
    elif kind in ("binary", "intevent"):
        good = [c for c in cols if df[c].nunique(dropna=True) <= 10]
    elif kind == "cat":
        good = [c for c in cols if not is_numeric(df[c]) or df[c].nunique(dropna=True) <= 20]
    else:
        good = cols
    rest = [c for c in cols if c not in good]
    return good + rest


def _coerce_binary(series: pd.Series, positive) -> pd.Series:
    if positive is not None and positive != "(já é 0/1)":
        return (series == positive).astype(int)
    return pd.to_numeric(series, errors="coerce").fillna(0).astype(int)


def build_figure(df: pd.DataFrame, key: str, mapping: dict, opts: dict) -> dict:
    """
    Gera a figura e devolve os bytes em PNG/SVG/PDF + mensagens de texto
    impressas pela biblioteca (ex.: teste estatístico usado).
    """
    spec = SPEC[key]
    func = getattr(cns, spec["func"])
    df = df.copy()
    kwargs: dict = {}

    for param, label, kind, required in spec["roles"]:
        col = mapping.get(param)
        if not col or col == NONE:
            if required:
                raise ValueError(f"Selecione a coluna para “{label}”.")
            continue
        if col not in df.columns:
            raise ValueError(f"A coluna “{col}” não existe na tabela.")
        if kind == "num" and not is_numeric(df[col]):
            raise ValueError(f"A coluna “{col}” precisa ser numérica para “{label}”.")
        if kind == "binary":
            df[col] = _coerce_binary(df[col], opts.get(f"pos_{param}"))
        if kind == "intevent":
            df[col] = pd.to_numeric(df[col], errors="coerce")
            if df[col].isna().any():
                raise ValueError(f"A coluna “{col}” precisa ser inteira (0, 1, 2, …).")
            df[col] = df[col].astype(int)
        if kind == "prob":
            if not is_numeric(df[col]):
                raise ValueError(f"A coluna “{col}” precisa ser numérica (0–1).")
        kwargs[param] = col

    # Opções específicas
    if spec.get("cmap") and opts.get("cmap"):
        kwargs["cmap"] = opts["cmap"]
    if spec.get("pairs") and opts.get("pairs_all"):
        kwargs["pairs"] = "all"

    # Configura a figura (cores qualitativas via color_cycle)
    fig_kwargs = {"width": opts.get("width", 180), "height": opts.get("height", 150)}
    if spec.get("palette") and opts.get("palette"):
        fig_kwargs["color_cycle"] = opts["palette"]

    plt.close("all")
    log = io.StringIO()
    with contextlib.redirect_stdout(log):
        cns.figure(**fig_kwargs)
        func(data=df, **kwargs)
        out = {}
        with tempfile.TemporaryDirectory() as d:
            for ext in ("svg", "png", "pdf"):
                path = os.path.join(d, f"figura.{ext}")
                cns.savefig(path)
                with open(path, "rb") as fh:
                    out[ext] = fh.read()
    plt.close("all")
    out["log"] = log.getvalue().strip()
    return out


def make_example(spec: dict) -> pd.DataFrame:
    """Cria uma mini-tabela ilustrando o formato esperado."""
    rng = np.random.default_rng(0)
    n = 6
    data: dict[str, list] = {}
    for param, label, kind, required in spec["roles"]:
        name = {"true_label_col": "rotulo", "pred_prob_cols": "probabilidade",
                "duration": "tempo", "event": "evento", "stack": "empilhar",
                "symbol": "gene"}.get(param, param)
        if kind == "num":
            data[name] = np.round(rng.normal(10, 3, n), 2).tolist()
        elif kind == "prob":
            data[name] = np.round(rng.random(n), 2).tolist()
        elif kind == "binary":
            data[name] = [i % 2 for i in range(n)]
        elif kind == "intevent":
            data[name] = [i % 3 for i in range(n)]
        elif kind == "cat":
            data[name] = [["A", "B", "C"][i % 3] for i in range(n)]
        else:  # any
            data[name] = [["X", "Y"][i % 2] for i in range(n)]
    if spec["key"] == "volcanoplot":
        data = {"log2FC": np.round(rng.normal(0, 2, n), 2).tolist(),
                "-log10p": np.round(np.abs(rng.normal(0, 3, n)), 2).tolist(),
                "gene": [f"GENE{i}" for i in range(n)]}
    return pd.DataFrame(data)


# --------------------------------------------------------------------------- #
# Interface (Streamlit)
# --------------------------------------------------------------------------- #
def check_password() -> bool:
    """Portão simples de senha (link privado). Se não houver senha, libera."""
    try:
        pw = st.secrets["app_password"]
    except Exception:
        pw = None
    if not pw:
        return True
    if st.session_state.get("auth_ok"):
        return True
    st.title("🔒 Acesso restrito")
    st.caption("Esta página é de uso interno. Informe a senha para continuar.")
    entered = st.text_input("Senha", type="password")
    if st.button("Entrar"):
        if entered == pw:
            st.session_state["auth_ok"] = True
            st.rerun()
        else:
            st.error("Senha incorreta.")
    return False


def load_data() -> pd.DataFrame | None:
    st.sidebar.header("1 · Dados")
    source = st.sidebar.radio("Origem da tabela",
                              ["Enviar arquivo", "Usar dados de exemplo"], index=0)
    if source == "Usar dados de exemplo":
        name = st.sidebar.selectbox("Dataset de exemplo",
                                    ["tips", "iris", "penguins", "flights", "fmri"])
        return cns.datasets.load_dataset(name)

    with st.sidebar.expander("Opções de leitura (CSV)", expanded=False):
        sep = st.selectbox("Separador",
                           ["auto", "vírgula (,)", "ponto e vírgula (;)", "tab"], index=0)
        decimal = st.selectbox("Separador decimal", [".", ","], index=0)
    file = st.sidebar.file_uploader("Tabela (.csv, .tsv, .xlsx)",
                                    type=["csv", "tsv", "txt", "xlsx", "xls"])
    if file is None:
        return None
    try:
        return read_table(file, sep=sep, decimal=decimal)
    except Exception as e:
        st.sidebar.error(f"Não consegui ler o arquivo: {e}")
        return None


def format_panel(spec: dict, df: pd.DataFrame | None) -> None:
    st.markdown(f"**{spec['label']}** — {spec['desc']}")
    rows = []
    for param, label, kind, required in spec["roles"]:
        rows.append({"Coluna (papel)": label,
                     "Tipo esperado": KIND_LABEL.get(kind, kind),
                     "Obrigatória?": "sim" if required else "opcional"})
    st.table(pd.DataFrame(rows))
    if spec.get("note"):
        st.info(spec["note"])
    with st.expander("📋 Ver exemplo de tabela no formato certo"):
        ex = make_example(spec)
        st.dataframe(ex, use_container_width=True, hide_index=True)
        st.download_button("Baixar exemplo (CSV)", ex.to_csv(index=False).encode(),
                           file_name=f"exemplo_{spec['key']}.csv", mime="text/csv")


def mapping_and_options(spec: dict, df: pd.DataFrame) -> tuple[dict, dict]:
    st.sidebar.header("3 · Colunas")
    mapping, opts = {}, {}
    for param, label, kind, required in spec["roles"]:
        options = columns_for(df, kind)
        if not required:
            options = [NONE] + options
        sel = st.sidebar.selectbox(label + ("" if required else " (opcional)"),
                                   options, key=f"map_{spec['key']}_{param}")
        mapping[param] = sel
        # Para eventos/rótulos que não são 0/1, pergunta qual valor é o "evento"
        if kind == "binary" and sel and sel != NONE:
            vals = pd.unique(df[sel].dropna())
            already = set(pd.to_numeric(pd.Series(vals), errors="coerce").dropna()) <= {0, 1}
            if not already:
                opts[f"pos_{param}"] = st.sidebar.selectbox(
                    f"↳ Qual valor de “{sel}” é o EVENTO (=1)?",
                    list(vals), key=f"pos_{spec['key']}_{param}")

    st.sidebar.header("4 · Estilo")
    opts["width"] = st.sidebar.number_input("Largura (px)", 60, 1200, 200, step=10)
    opts["height"] = st.sidebar.number_input("Altura (px)", 60, 1200, 150, step=10)
    if spec.get("palette"):
        opts["palette"] = st.sidebar.selectbox("Paleta (qualitativa)", QUAL_PALETTES)
    if spec.get("cmap"):
        opts["cmap"] = st.sidebar.selectbox("Mapa de cores (sequencial)", SEQ_CMAPS)
    if spec.get("pairs"):
        opts["pairs_all"] = st.sidebar.checkbox(
            "Adicionar teste estatístico entre todos os grupos", value=False)
    return mapping, opts


def main() -> None:
    st.set_page_config(page_title="cnsplots web", page_icon="📊", layout="wide")
    if not check_password():
        st.stop()

    st.title("📊 cnsplots — gráficos prontos para publicação")
    st.caption("Envie sua tabela, escolha o gráfico, mapeie as colunas e baixe em SVG/PNG/PDF.")

    df = load_data()

    st.sidebar.header("2 · Gráfico")
    cat = st.sidebar.selectbox("Categoria", CATEGORIES)
    plots_in_cat = [p for p in PLOTS if p["cat"] == cat]
    spec = st.sidebar.selectbox("Tipo de gráfico", plots_in_cat,
                                format_func=lambda p: p["label"])

    left, right = st.columns([1, 1], gap="large")

    with left:
        st.subheader("Formato esperado")
        format_panel(spec, df)
        if df is not None:
            st.subheader("Prévia da sua tabela")
            st.dataframe(df.head(15), use_container_width=True)
            st.caption(f"{len(df)} linhas × {len(df.columns)} colunas")

    if df is None:
        with right:
            st.info("⬅️ Comece enviando uma tabela (ou use os dados de exemplo na barra lateral).")
        return

    mapping, opts = mapping_and_options(spec, df)

    with right:
        st.subheader("Resultado")
        if st.button("🎨 Gerar gráfico", type="primary", use_container_width=True):
            try:
                st.session_state["result"] = build_figure(df, spec["key"], mapping, opts)
                st.session_state["result_key"] = spec["key"]
            except Exception as e:
                st.session_state.pop("result", None)
                st.error(f"Não deu para gerar: {e}")

        result = st.session_state.get("result")
        if result and st.session_state.get("result_key") == spec["key"]:
            st.image(result["png"], caption="Prévia (PNG). Baixe o SVG para qualidade vetorial.")
            if result.get("log"):
                st.caption("ℹ️ " + result["log"])
            c1, c2, c3 = st.columns(3)
            base = spec["key"]
            c1.download_button("⬇️ SVG", result["svg"], f"{base}.svg", "image/svg+xml",
                               use_container_width=True)
            c2.download_button("⬇️ PNG", result["png"], f"{base}.png", "image/png",
                               use_container_width=True)
            c3.download_button("⬇️ PDF", result["pdf"], f"{base}.pdf", "application/pdf",
                               use_container_width=True)


if __name__ == "__main__":
    main()
