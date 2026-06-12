run-api-dev:
	docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up --build

run-web-dev:
	cd web && bun run dev
