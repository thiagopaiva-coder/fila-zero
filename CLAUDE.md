# Fila Zero — jogo de estande da NECSObr (CONSTRUVALE)

Jogo arcade de atendimento: clientes de obra chamam no "WhatsApp da Construtora Exemplo",
o jogador responde antes que desistam; ao perder, vê o NECSO Atende zerar a mesma fila
e deixa o contato para o diagnóstico gratuito.

## Estrutura
- `public/index.html` — o jogo inteiro (HTML + CSS + JS num arquivo). Funciona sozinho,
  sem servidor; com servidor, ranking e leads ficam compartilhados entre dispositivos.
- `server/index.js` — servidor Node sem dependências. Serve `public/` e expõe:
  `GET/POST /api/rank`, `POST /api/leads`, `GET /api/leads.csv?token=`, `POST /api/reset?token=`, `POST /api/resend?token=`, `GET /api/crm?token=`, `GET /health`.
  **Integração NECSO Atende** (`forwardNecso`): cada lead vira contato (tags Fila Zero/CONSTRUVALE) + card no funil do CRM
  (`NECSO_FUNNEL_NAME`, padrão "Comercial", primeira etapa) + comentário com os dados do jogo. Credenciais em `.env` (ver `.env.example`).
  O `clientSecret` nunca vai pro front: a página pública (GitHub Pages) só tem o caminho do WhatsApp.
- `data/` — `rank.json` e `leads.json` (montado como volume no Docker; não versionar).

## Comandos
- `make up` / `make down` — Docker na porta 8080
- `make dev` — Node local
- `make leads` — exporta CSV; `make reset-rank` — zera ranking; `make crm` — confere funil/etapa; `make test-lead PHONE=...` — lead de teste; `make resend` — reenvia leads que falharam

## Marca (manual NECSObr 2026)
Azul cobalto #004aad, azul vívido #017de5, azul escuro #01355c.
Fontes: Hammersmith One (necsobr) e Barlow Semi Condensed (corpo; o slogan oficial usa Cocomat Pro, não disponível no Google Fonts).
Slogan: "Conexão que faz sentido." Contatos: necsobr.com.br · @necsobr · (12) 3204-4300 (telefone). WhatsApp conectado ao NECSO Atende: (12) 2018-0667 (usado no link/QR pós-lead).

## Fluxo no estande
1. **Modo atração** (ninguém jogando): fila roda sozinha, frases de impacto alternam (`HOOKS`), botão "TOQUE PARA ATENDER".
2. **Tutorial** (`#tutOv`, 3 passos com bolhas de exemplo): como responder, barra de paciência, 3 vidas. "Pular" vai direto; "Jogar de novo" não repete o tutorial.
3. **Jogo** até perder 3 clientes.
4. **"A fila venceu"**: pede o nome (só aqui, pra não travar quem está passando) → "Ligar NECSO Atende".
5. **Resultado**: "Jogar de novo" (público geral) ou "Quanto a minha empresa perde?" (interessados) → calculadora de 3 sliders → lead → tela com botão/QR do WhatsApp da NECSObr (mensagem pronta com os números do jogo).
6. Sem interação por 90 s nas telas finais → volta ao modo atração.

## Onde mexer
- Mensagens dos clientes e respostas: array `MSGS` (texto, [3 opções], índice da correta).
- Nomes dos clientes: `CLIENTS`. Valores em jogo: `TICKETS`.
- Dificuldade: `spawnEvery` (intervalo inicial, ms), fator `0.9` de aceleração, `patience` (ms).
- QR: constante `QR_DATA` no index.html (data URI). Pra apontar pro seu servidor: `make qr URL=http://IP:8080` imprime o novo data URI.
- Frases do modo atração: `HOOKS`. Fórmula da calculadora: `calc()` (contatos × 22 dias × % sem resposta × 10% conversão × ticket).
- Duração do modo NECSO: `setTimeout(endScreen, 11000)`.
