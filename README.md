# TokTickIT

TokTickIT is an IT service desk application developed for the Software Engineering course. Lab 2 extends the project with requester ticketing, ticket management, attachments, and the Zen Green UI foundation.

## Technology Stack

### Frontend
- React
- TypeScript
- Vite
- Bootstrap

### Backend
- Node.js
- Express
- TypeScript

### Database and Storage
- PostgreSQL
- Prisma
- SeaweedFS

### Testing
- Vitest
- Supertest
- Playwright

## Prerequisites

Before running the project, install:

- Node.js and npm
- PostgreSQL
- SeaweedFS

## Setup

### Frontend

1. Open a terminal and go to the client folder:

    cd client

2. Install dependencies:

    npm install

3. Copy the environment example:

    cp .env.example .env

4. Start the frontend:

    npm run dev

The frontend runs at http://localhost:5173.

### Backend

1. Open another terminal and go to the server folder:

    cd server

2. Install dependencies:

    npm install

3. Copy the environment example:

    cp .env.example .env

4. Start the backend:

    npm run dev

The backend runs at http://localhost:3000.

### SeaweedFS

Start SeaweedFS for attachment storage:

    weed mini

SeaweedFS provides the object storage used for Lab 2 ticket attachments.

## Database and Environment

The backend uses PostgreSQL with Prisma.

Copy `server/.env.example` to `server/.env` and configure the required environment variables, including:

- `DATABASE_URL`
- `SEAWEEDFS_S3_ENDPOINT`
- `SEAWEEDFS_BUCKET`
- `AWS_REGION`

Run the Prisma migration and seed data before starting the application:

    cd server
    npm run prisma:migrate
    npm run prisma:seed

Do not commit the real `.env` file.

## Tests

To run the frontend tests:

    cd client
    npm test

To run the backend tests:

    cd server
    npm test

## Lab 2

Lab 2 implements the requester ticketing MVP with:

- Development Requester selection
- Create Ticket
- My Tickets with search, filter, sort, and pagination
- Ticket Detail
- Attachment upload, download, and soft removal
- Requester ownership isolation
- Zen Green responsive UI
- Automated frontend and backend tests

Lab 2 was developed using separate Issues, feature branches, Pull Requests, peer review, and final integration through `lab2-staging` into `main`.
