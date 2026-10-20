# Dia Livre

App de apoio para quem quer parar de pegar dinheiro com agiota por impulso. Um dia de cada vez.

- **Hoje**: contador de dias livres, check-in diário, calendário, conquistas e incentivo da IA
- **Gatilhos**: registro de cada vontade e os padrões que mais se repetem
- **SOS**: 15 minutos de espera com respiração guiada, motivos, carta e pessoa de confiança (opcional)
- **Dinheiro**: retrato do mês, contas, dívidas ordenadas por juros, objetivos e plano do mês com IA
- **Conversa**: apoio com IA na hora da vontade
- **Apoio**: motivos, carta para si mesma, barreiras, rede de apoio (CVV 188)

O app não substitui acompanhamento com psicólogo ou CAPS.

## Tecnologia

- Uma página estática (`index.html`), publicada no GitHub Pages
- Firebase Authentication (login com Google)
- Cloud Firestore (cada pessoa tem o documento `users/{uid}`, só ela lê e grava)
- Firebase AI Logic com Gemini Developer API para a IA de apoio
- App Check com reCAPTCHA v3 para proteger a IA

Sem o Firebase configurado, o app funciona salvando só no aparelho e sem IA.

## Configuração do Firebase (uma vez só)

1. **Criar o projeto**: console.firebase.google.com → Adicionar projeto → `dia-livre`.
2. **App web**: na página do projeto, clique em `</>`, registre o app e copie o `firebaseConfig` para o arquivo `config.js`.
3. **Login com Google**: Authentication → Começar → Método de login → Google → Ativar.
   Depois, em Authentication → Configurações → Domínios autorizados, adicione `jmarcicofast-cell.github.io`.
4. **Banco de dados**: Firestore Database → Criar banco de dados → modo de produção, local `southamerica-east1` (São Paulo).
   Na aba Regras, cole o conteúdo de `firestore.rules` e clique em Publicar.
5. **IA**: AI Services → AI Logic → Começar → escolha **Gemini Developer API** (tem cota gratuita, não precisa do plano Blaze).
   O AI Logic pede o App Check. Crie uma chave **reCAPTCHA v3** em google.com/recaptcha/admin com o domínio `jmarcicofast-cell.github.io`.
   Em Segurança → App Check, registre o app web com o provedor reCAPTCHA (cole a **chave secreta**) e coloque a **chave do site** em `RECAPTCHA_SITE_KEY` no `config.js`.

## Publicar no GitHub Pages

Repositório → Settings → Pages → Source: **Deploy from a branch** → branch `main`, pasta `/ (root)` → Save.
Em alguns minutos o app fica em `https://jmarcicofast-cell.github.io/dia-livre/`.

No celular, abra o link e use **Adicionar à tela inicial** para instalar como app.

## Contatos de apoio

- CVV: 188 (24 horas, gratuito)
- CAPS da sua região, pelo SUS
- Em caso de ameaça ou cobrança violenta: 190
