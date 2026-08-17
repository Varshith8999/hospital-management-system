# Hospital Management System

A full-stack hospital management application with role-based access for
Admins, Doctors, Nurses, Receptionists and Patients — covering patient
records, appointments (with double-booking prevention), prescriptions,
medical records and billing.

**Dashboard:** http://localhost:5173 (once the app is running — see setup below)

## Technology stack

| Layer    | Technology                                                        |
| -------- | ----------------------------------------------------------------- |
| Frontend | React 18, Vite, React Router, Axios, Tailwind CSS                 |
| Backend  | Node.js, Express, REST API, JWT auth, bcrypt                      |
| Database | MySQL 8 with Sequelize ORM, migrations and seeders                |
| DevOps   | Git, GitHub, Docker, Docker Compose, Jenkins (CI/CD)              |

## Local setup

```bash
cp .env.example .env          # then replace every CHANGE_ME value

# Backend (http://localhost:5000)
cd backend && npm install && npm run db:setup && npm run dev

# Frontend (http://localhost:5173)
cd frontend && npm install && npm run dev
```

## Run with Docker

```bash
cp .env.example .env          # required: Compose reads it for all credentials
docker compose up --build
```

- Frontend: http://localhost:5173/login
## Tests

```bash
cd backend && npm test        # Jest + Supertest
cd frontend && npm run lint
```

## Demo accounts

Seeded when `RUN_SEEDERS=true`. Password comes from `SEED_PASSWORD`
(default `Password@123`).

| Role         | Email                        |
| ------------ | ---------------------------- |
| Admin        | admin@hospital.test          |
| Doctor       | arjun.mehta@hospital.test    |
| Nurse        | anita.rao@hospital.test      |
| Receptionist | reception@hospital.test      |
| Patient      | ravi.kumar@example.test      |
