# Dia Livre

App de apoio para quem quer parar de pegar dinheiro com agiota por impulso. Um dia de cada vez.

- **Hoje**: contador de dias livres, check-in diário, calendário, conquistas e incentivo da IA
- **Gatilhos**: registro de cada vontade e os padrões que mais se repetem
- **SOS**: 15 minutos de espera com respiração guiada, motivos, carta e pessoa de confiança (opcional)
- **Dinheiro**: resumo do mês com gráficos, lançamentos com categorias, orçamento por categoria, cartões com faturas e parcelas, calendário de contas, dívidas com juros, objetivos, plano do mês com IA e conexão com o banco pelo Meu Pluggy
- **Aparência**: botão da paleta no topo. Temas prontos, cor principal, cor de destaque, fonte, tamanho da letra, cantos e modo claro/escuro
- **Calculadora**: todo campo de valor aceita conta, como `30+15,90` ou `600/6`
- **Conversa**: apoio com IA na hora da vontade
- **Apoio**: motivos, carta para si mesma, barreiras, rede de apoio (CVV 188)

O app não substitui acompanhamento com psicólogo ou CAPS.

## Tecnologia

- Uma página estática (`index.html`, `css/`, `js/`), publicada no GitHub Pages
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

## Conexão com o banco (Meu Pluggy + Cloudflare)

A conexão usa o Open Finance pelo **Meu Pluggy**, que é gratuito para os dados do seu próprio CPF.
O app só **lê** saldos e movimentações; não faz pagamentos. A chave da Pluggy fica num servidor seu
(Cloudflare Worker), nunca no código do site.

1. **Conectar seus bancos no Meu Pluggy**: crie a conta em `meu.pluggy.ai` e conecte cada banco e cartão
   (o próprio banco pede a autorização).
2. **Criar a aplicação na Pluggy**: em `dashboard.pluggy.ai`, crie uma conta de desenvolvedora e uma aplicação.
   Anote o **Client ID** e o **Client Secret** (o secret aparece uma vez só).
3. **Criar o Worker**: em `dash.cloudflare.com` → Workers e Pages → Criar → Worker → nome `dia-livre-banco` → Implantar.
   Depois clique em **Editar código**, apague tudo, cole o conteúdo de `worker/dia-livre-banco.js` e clique em **Implantar**.
4. **Variáveis do Worker**: Configurações → Variáveis e segredos → Adicionar:
   - `PLUGGY_CLIENT_ID` (Segredo)
   - `PLUGGY_CLIENT_SECRET` (Segredo)
   - `ALLOWED_EMAIL` (Texto): o e-mail do Google que você usa no Dia Livre (para mais de um, separe com vírgula)
   - `FIREBASE_PROJECT_ID` (Texto): `dia-livre`
   - `ALLOWED_ORIGIN` (Texto): `https://jmarcicofast-cell.github.io`
5. **No app**: Dinheiro → Banco → cole o endereço do Worker (`https://dia-livre-banco.<sua-conta>.workers.dev`)
   e toque em **Conectar Meu Pluggy**. Na janela que abrir, autorize o Meu Pluggy.

O app atualiza sozinho quando você abre (no máximo a cada 6 horas) e pelo botão **Atualizar agora**.
O consentimento do Open Finance vale 12 meses; depois é só reconectar.

## Publicar no GitHub Pages

Repositório → Settings → Pages → Source: **Deploy from a branch** → branch `main`, pasta `/ (root)` → Save.
Em alguns minutos o app fica em `https://jmarcicofast-cell.github.io/dia-livre/`.

No celular, abra o link e use **Adicionar à tela inicial** para instalar como app.

## Contatos de apoio

- CVV: 188 (24 horas, gratuito)
- CAPS da sua região, pelo SUS
- Em caso de ameaça ou cobrança violenta: 190
