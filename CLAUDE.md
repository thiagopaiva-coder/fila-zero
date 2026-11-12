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
1. **Entrada** (`attract()`, classe `.app.intro`, bloco `.hero`): tela parada, sem rolagem — à esquerda marca, "Fila Zero", frase fixa "Sua empresa perde clientes quando ninguém atende rápido.", botão "TOQUE PARA ATENDER" e QR; à direita um celular ilustrativo (`.phone`) com três clientes esperando; fundo com grade de planta. No celular vira uma coluna e o QR some. HUD e lateral ficam ocultos na entrada.
2. **Treinamento jogável** (`start()`, `S.train`, barra `#coachBar`, destaque `.spot`): o supervisor guia dentro do próprio WhatsApp — (1) primeiro cliente parado até a resposta certa, (2) segundo cliente com a barra de paciência correndo, (3) cartão centralizado na tela "Treino concluído!" (`.coachbar.center`) com destaque nos corações e no "perdidos" + botão "Começar pra valer". Nada conta no treino. "Pular treino" e "Jogar de novo" vão direto pra contagem 3-2-1 (`play()`, `#countOv`).
3. **Jogo** até perder 3 clientes.
4. **"A fila venceu"** → "Ligar NECSO Atende" → transição animada `#switchOv` (~4 s: símbolo pulsando, canais conectando, "Nenhum cliente sem resposta.") → modo automático com as respostas certas em bolhas azuis. **Regra: o NECSO sempre atende mais clientes e garante mais dinheiro que o jogador** — meta `target` = max(10, 1,5× atendidos + 5), ritmo ajustado pra ~13 s, e só encerra (`tryEnd`) quando `S.necso ≥ target` e `S.necsoMoney ≥ S.won×1,3 + 3000`.
5. **Resultado**: comparação lado a lado Você × NECSO Atende (clientes atendidos, vendas garantidas, perdidos) e a diferença em reais. "Jogar de novo" (público geral) ou "Quanto a minha empresa perde?" (interessados) → calculadora de 3 sliders → lead → tela com botão/QR do WhatsApp da NECSObr (mensagem pronta com os números do jogo).
6. Sem interação por 90 s nas telas finais → volta ao modo atração.

## Onde mexer
- Mensagens dos clientes e respostas: array `MSGS` (texto, [3 opções], índice da correta).
- Nomes dos clientes: `CLIENTS`. Valores em jogo: `TICKETS`.
- Dificuldade: `spawnEvery` (intervalo inicial, ms), fator `0.9` de aceleração, `patience` (ms).
- Página pública ↔ servidor: `public/config.js` define `window.FZ_API_BASE` (endereço público do servidor, ex. túnel ngrok). Com ele, quem joga pelo celular também gera card no funil; sem ele, só o caminho do WhatsApp. Em endereço local o front ignora e usa a própria origem.
- QR "Jogue no seu celular": embutido (`QR_DATA`) aponta pro GitHub Pages. Em servidor próprio, `GET /api/config` devolve `PUBLIC_URL` do `.env` e o front redesenha o QR; endereço local sem PUBLIC_URL → mantém o link público.
- Botão "↺ Início" no topo (`#homeBtn` → `attract()`) volta pra tela inicial a qualquer momento.
- **Sem ranking**: removido do front a pedido (as rotas `/api/rank` do servidor ficaram, sem uso). Nome, empresa e WhatsApp são pedidos só no formulário do diagnóstico.
- Fórmula da calculadora: `calc()` (contatos × 22 dias × % sem resposta × 10% conversão × ticket).
- Duração do modo NECSO: mínimo de 13 s (`after(13000,tryEnd)` em `necsoMode`).
