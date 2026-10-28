# Fila Zero

```bash
make up          # http://localhost:8080
make leads       # exporta leads
make reset-rank  # zera o ranking
```

Para usar em vários tablets no estande, deixe o servidor rodando num notebook na
mesma rede Wi-Fi e abra `http://<ip-do-notebook>:8080` em cada tablet.

## Publicar num endereço público (pra o QR funcionar em qualquer celular)

**Opção A — só o jogo, sem servidor (ranking fica em cada aparelho)**
Arraste a pasta `public/` em https://app.netlify.com/drop . Sai um link `*.netlify.app` em segundos.

**Opção B — jogo + servidor (ranking e leads centralizados)**
Suba este repositório no GitHub e conecte em https://railway.app ou https://render.com (ambos
detectam o `Dockerfile`). Porta 8080. Crie um volume em `/app/data` pra não perder os leads.

Em qualquer opção, o QR dentro do jogo passa a apontar pro endereço publicado automaticamente.

## Leads no funil Comercial do NECSO Atende

1. No NECSO Atende: **Empresa → Canais → adicionar canal tipo API**. Copie `clientId` e `clientSecret` (aparece uma vez).
2. `cp .env.example .env` e preencha `NECSO_CLIENT_ID`, `NECSO_CLIENT_SECRET` e um `ADMIN_TOKEN` qualquer.
3. `make up` e depois `make crm` — deve responder com o funil "Comercial" e a etapa de entrada.
4. `make test-lead PHONE=12999999999` (seu número) — o card aparece no funil em segundos.

Na feira: o servidor roda no notebook do estande (`make up`); TV e tablets abrem `http://<ip-do-notebook>:8080`.
Quem joga pelo QR público (GitHub Pages) chega pelo WhatsApp da NECSObr, que já cai no NECSO Atende.
