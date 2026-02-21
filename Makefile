.PHONY: backend frontend dev install-backend install-frontend install

# Install dependencies
install-backend:
	cd backend && pip install -r requirements.txt

install-frontend:
	cd frontend && npm install

install: install-backend install-frontend

# Run services
backend:
	cd backend && python3 -m uvicorn app.main:app --port 8000 --reload

frontend:
	cd frontend && npm run dev

# Run both (requires 'make -j2 dev' or run backend/frontend in separate terminals)
dev: backend frontend
