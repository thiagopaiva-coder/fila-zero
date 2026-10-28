.PHONY: dev up down logs leads reset-rank build resend
-include .env
export

dev:        ## roda sem docker (node local)
	node server/index.js

up:         ## sobe em docker na porta 8080
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

build:
	docker build -t necsobr/fila-zero .

leads:      ## baixa os leads em CSV
	curl -s "http://localhost:8080/api/leads.csv?token=$(ADMIN_TOKEN)" -o leads-fila-zero.csv && echo "salvo em leads-fila-zero.csv"

reset-rank: ## zera o ranking (ex.: início de cada dia de feira)
	curl -s -X POST "http://localhost:8080/api/reset?token=$(ADMIN_TOKEN)"

qr:         ## gera QR do seu endereço: make qr URL=http://192.168.0.10:8080
	@python3 tools/qr.py "$(URL)" public/qr.png && echo "QR salvo em public/qr.png — cole o data URI em QR_DATA no index.html ou use o cartaz"

resend:     ## reenvia pra plataforma os leads que falharam
	curl -s -X POST "http://localhost:8080/api/resend?token=$(ADMIN_TOKEN)"
