run-api-dev:
	docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up --build

run-web-dev:
	cd web && bun run dev

run-migration:
	docker compose api exec bun run db:migrate
	docker compose api exec bun run db:seed