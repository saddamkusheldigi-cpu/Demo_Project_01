# Little List

A simple task list website with a browser-based frontend and a Node.js backend. Tasks can be added, completed, and removed, and are saved locally between server restarts.

## Requirements

- Node.js 18 or newer

## Run locally

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Set the `PORT` environment variable to use a different port.

## Run with Docker

Start the Node.js app, PostgreSQL database, and pgAdmin containers:

```bash
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000). Stop them with `docker compose down`.
PostgreSQL data is kept in the `little-list-postgres` named volume.

Open pgAdmin at [http://localhost:5050](http://localhost:5050). Sign in with
`admin@example.com` / `local-dev-password` by default. Database and pgAdmin ports
bind to localhost by default. In pgAdmin, add a server using
host `database`, port `5432`, database `little_list`, username `little_list`, and
password `little_list_password`. Set `PGADMIN_DEFAULT_EMAIL` and
`PGADMIN_DEFAULT_PASSWORD` environment variables to change the pgAdmin login.
Set `POSTGRES_PASSWORD` to change the database password.

## GitHub Actions deployment

The workflow builds and tests the app on GitHub-hosted runners, packages the Docker
image, then deploys it to a Linux machine with a self-hosted GitHub Actions runner.
Deployments run from pushes to `main`.

On the Linux machine, install Docker Compose and register a self-hosted runner with
the `linux` and `x64` labels. The runner needs Docker access and `openssl` installed.
On first deploy, the workflow generates database and pgAdmin passwords and stores
them with restrictive permissions in `~/.config/little-list/.env` under the runner
user's home directory. To sign in to pgAdmin, read the credentials on Linux with
`cat ~/.config/little-list/.env` as that user. The workflow reuses this file on later
deploys so database credentials remain stable. It does not delete database volumes,
so PostgreSQL data persists across deployments. The app is exposed on port 3000;
PostgreSQL and pgAdmin are bound to localhost by default.

## API

- `GET /api/tasks` — list tasks
- `POST /api/tasks` — add a task with a JSON body such as `{"title":"Plan the day"}`
- `PATCH /api/tasks/:id` — update completion with `{"completed":true}`
- `DELETE /api/tasks/:id` — remove a task

Tasks are stored in the PostgreSQL `tasks` table. Existing tasks from `data/tasks.json`
are migrated into PostgreSQL once when the database is empty.
