# 🚀 Guia — Publicar Pênaltis em toolhub.hylix.app/penaltis/

Pré-requisito: o repositório `hylixinsights/toolhub` já está no ar com Pages + domínio. Falta: autorizar este MacBook, configurar o Firebase e subir o jogo.

---

## ETAPA 1 — Autorizar o novo MacBook no GitHub (~5 min)

Abra o Terminal:

```bash
# 1. Instale o Homebrew (se ainda não tiver)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Instale o GitHub CLI
brew install gh

# 3. Faça login
gh auth login
```

No `gh auth login`, responda:

1. **Where do you use GitHub?** → `GitHub.com`
2. **Preferred protocol?** → `HTTPS`
3. **Authenticate Git with your GitHub credentials?** → `Yes`
4. **How to authenticate?** → `Login with a web browser`
5. Copie o código de 8 caracteres, aperte Enter → o navegador abre → entre na conta que tem acesso a `hylixinsights` → cole o código → **Authorize**.

Confirme e configure sua identidade:

```bash
gh auth status
git config --global user.name "Seu Nome"
git config --global user.email "email-da-sua-conta-github@exemplo.com"
```

---

## ETAPA 2 — Clonar o toolhub (~1 min)

```bash
cd ~/Desktop/2026/ToolHub
gh repo clone hylixinsights/toolhub
cd toolhub
```

Confira se existe o arquivo `CNAME` na raiz com o conteúdo `toolhub.hylix.app` (se o site já está no ar, ele existe).

---

## ETAPA 3 — Firebase (~10 min, grátis)

Não existe "conta Firebase" separada: basta entrar com uma conta Google em https://console.firebase.google.com.

1. **Criar projeto:** *Adicionar projeto* → nome `penaltis` → pode desativar o Analytics → *Criar*.
2. **Banco:** menu *Criação → Realtime Database → Criar banco de dados* → local **Estados Unidos** → começar no **modo bloqueado**.
3. **Regras:** aba *Regras* → apague tudo, cole e **Publicar**:

```json
{
  "rules": {
    "matches":  { ".read": true, ".write": "auth != null" },
    "history":  { ".read": true, ".write": "auth != null" },
    "stats":    { ".read": true, ".write": "auth != null" },
    "presence": { ".read": true,
      "$uid": { ".write": "auth != null && auth.uid === $uid" } }
  }
}
```

4. **Login anônimo:** *Criação → Authentication → Vamos começar → Sign-in method → Anônimo → Ativar*.
5. **Credenciais:** ⚙️ *Configurações do projeto → Seus apps* → ícone **`</>`** (Web) → apelido `penaltis` (NÃO marque Hosting) → *Registrar app* → copie o objeto `firebaseConfig`.
6. **Colar no jogo:** abra `penaltis/index.html` e preencha o bloco `FIREBASE_CONFIG` (linha ~36) com `apiKey`, `authDomain`, `databaseURL` e `projectId`. Se `databaseURL` não vier no config, copie da página do Realtime Database (ex.: `https://penaltis-default-rtdb.firebaseio.com`).

---

## ETAPA 4 — App Check + reCAPTCHA v3 (opcional, mas recomendado)

1. https://www.google.com/recaptcha/admin/create → tipo **reCAPTCHA v3** → domínio `toolhub.hylix.app` → criar. Guarde a **Chave do site** e a **Chave secreta**.
2. Console Firebase: **App Check → Apps** → registre o app web com **reCAPTCHA v3**, colando a **chave secreta**.
3. No `index.html`, cole a **Chave do site** em `RECAPTCHA_V3_SITE_KEY` (linha ~42).
4. ⚠️ Só depois de testar o jogo funcionando: **App Check → APIs → Realtime Database → Aplicar (enforce)**.

---

## ETAPA 5 — Subir o jogo (~2 min)

Copie só os 5 arquivos do jogo (sem `.DS_Store`, `.Rhistory`, `.jsx`) já com o `index.html` editado:

```bash
cd ~/Desktop/2026/ToolHub/toolhub
mkdir -p penaltis
cp ../penaltis/{index.html,manifest.webmanifest,sw.js,icon-192.png,icon-512.png} penaltis/

git add penaltis
git commit -m "Adiciona jogo Pênaltis"
git push
```

O GitHub Pages publica em ~1–2 min (acompanhe na aba **Actions** do repositório).

---

## ETAPA 6 — Teste final

1. Abra `https://toolhub.hylix.app/penaltis/` em dois celulares.
2. Num deles: *Jogar online* → nome → *Criar partida*.
3. No outro: câmera no **QR code** → nome → *Entrar*.
4. Confira **📜 Partidas jogadas** e o contador "X partidas já disputadas" subindo no menu.
5. Tudo OK? Volte na Etapa 4.4 e ative o **enforce** do App Check.

### Se algo falhar

- **404 na URL:** espere o deploy terminar (aba Actions) e limpe o cache (o PWA usa service worker — feche e reabra o navegador ou use aba anônima).
- **Modo online não conecta:** confira se `FIREBASE_CONFIG` foi preenchido, se o login **Anônimo** está ativo e se as **regras** foram publicadas.
- **`git push` recusado:** rode `gh auth status`; a conta logada precisa de permissão de escrita em `hylixinsights/toolhub`.
