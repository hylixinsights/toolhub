# ⚽ Disputa de Pênaltis — Guia de Publicação

Jogo idealizado e desenvolvido com IA por **@helder_nakaya**.
URL final: `https://toolhub.hylix.app/penaltis/`

## Arquivos do jogo (pasta `penaltis/`)
- `index.html` — o jogo completo
- `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png` — PWA (ícone, tela cheia, offline)

Na **raiz** do repositório: arquivo `CNAME` contendo apenas `toolhub.hylix.app`.

---

## PARTE 1 — Firebase (modo online, ~10 min, grátis)

1. **Criar projeto:** https://console.firebase.google.com → *Adicionar projeto* → nome `penaltis` → pode desativar o Analytics.
2. **Banco:** menu *Criação → Realtime Database → Criar banco de dados* → local Estados Unidos → comece no **modo bloqueado**.
3. **Regras:** aba *Regras* do banco → cole e publique:
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
4. **Login anônimo (identidade invisível):** *Criação → Authentication → Vamos começar → Sign-in method → Anônimo → Ativar*.
5. **Credenciais:** ⚙️ *Configurações do projeto → Seus apps →* ícone **`</>`** (Web) → apelido `penaltis` (não marque Hosting) → copie o `firebaseConfig`.
6. **Colar no jogo:** abra o `index.html` e preencha o bloco `FIREBASE_CONFIG` no topo do script com `apiKey`, `authDomain`, `databaseURL` e `projectId`. Se o `databaseURL` não vier no config, copie da página do Realtime Database (ex.: `https://penaltis-default-rtdb.firebaseio.com`).

## PARTE 2 — Check de humanos (App Check + reCAPTCHA v3, invisível)

1. https://www.google.com/recaptcha/admin/create → tipo **reCAPTCHA v3** → domínio `toolhub.hylix.app` → criar. Guarde a **Chave do site** e a **Chave secreta**.
2. No console do Firebase: **App Check → Apps →** registre o app web com **reCAPTCHA v3**, colando a **chave secreta**.
3. No `index.html`, cole a **Chave do site** em `RECAPTCHA_V3_SITE_KEY`.
4. ⚠️ Só depois de testar o jogo funcionando: **App Check → APIs → Realtime Database → Aplicar (enforce)**. A partir daí, só requisições vindas do seu site (validadas como tráfego humano) escrevem no banco.

## PARTE 3 — GitHub Pages + domínio

1. Crie um repositório público (ex.: `toolhub`) e envie: `CNAME` na raiz + a pasta `penaltis/` com os 5 arquivos.
2. *Settings → Pages* → Source: **Deploy from a branch** → `main` / `/ (root)` → Save.
3. Ainda em Pages, em **Custom domain** digite `toolhub.hylix.app` → Save.
4. **DNS da hylix.app** (no seu registrador): crie um registro **CNAME** com host `toolhub` apontando para `SEUUSUARIO.github.io` (troque pelo seu usuário). Propaga em minutos até ~1h.
5. De volta ao GitHub Pages, marque **Enforce HTTPS** quando a opção liberar.

## PARTE 4 — Teste final

1. Abra `https://toolhub.hylix.app/penaltis/` em dois celulares.
2. Num deles: *Jogar online* → digite o nome → *Criar partida*.
3. No outro: aponte a câmera pro **QR code** (abre o link `?sala=CÓDIGO` já preenchido) → nome → *Entrar*.
4. Confira depois: **📜 Partidas jogadas** registrando o placar e o contador "**X partidas já disputadas**" subindo no menu.

## Como funcionam os recursos pedidos

- **Nº de partidas:** todo fim de jogo incrementa `stats/total` com incremento atômico no servidor (sem contagem dupla); o menu exibe o total mundial.
- **Servidor cheio:** cada aparelho conectado registra presença em `presence/{uid}` (removida automaticamente ao desconectar). O plano grátis suporta **100 conexões simultâneas**; ao tentar criar/entrar com **90+** presentes, o jogo mostra "🥵 Servidor lotado — espere uns minutinhos" em vez de falhar. Se o jogo bombar, ative o plano **Blaze** (paga centavos pelo excedente) e o limite some.
- **Check de humanos:** App Check + reCAPTCHA v3 rodam em segundo plano, sem desafios visíveis, bloqueando scripts e bots fora do seu site.
