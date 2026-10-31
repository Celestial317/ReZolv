# ReZolv

- `server/`    FastAPI + agents (see `architecture.md`, `data_model.md`)
- `app/`       Next.js student PWA (port 3000), UI not built yet
- `dashboard/` Next.js staff dashboard (port 3001), UI not built yet

## Run
```
cp .env.example .env            # fill in keys (all optional to start)
docker compose up --build       # db + server + app + dashboard
docker compose exec server python seed.py --reset
```
Server docs: http://localhost:8000/docs  ·  health: http://localhost:8000/health

Local dev without Docker: start only `yugabytedb` in compose, then in `server/`
`pip install -r requirements.txt && python -m scripts.migrate && uvicorn main:app --reload`
(set `DATABASE_URL` host to `localhost`), and `npm install && npm run dev` in `app/` and `dashboard/`.

## Connectivity checks (run in `server/`)
- `python -m scripts.check_gemini`      lists usable models, tests embed + classify
- `python -m scripts.list_meko_tools`   prints Meko tool names and argument schemas
- `python -m scripts.setup_storage`     creates the Vultr buckets and CORS

Demo logins, password `rezolv123`: `student01@campus.demo` ... `student50@campus.demo`,
`dean@`, `warden@`, `it@`, `estates@`, `committee@` `rezolv.demo`.

Without keys everything still runs: Gemini falls back to keyword classification and mock
embeddings (typed reports only), Meko and Solana calls are skipped.
