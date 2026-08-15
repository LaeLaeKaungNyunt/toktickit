# TokTickIT

TokTickIT is an IT service desk application for Lab 1 of the Software Engineering course.

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

### Database
- PostgreSQL
- Prisma

### Testing
- Vitest
- Supertest

## Prerequisites

Before running the project, install:

- Node.js and npm
- PostgreSQL

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

## Database

The backend uses PostgreSQL with Prisma.

Copy `server/.env.example` to `server/.env` and configure `DATABASE_URL` for your local PostgreSQL database.

Do not commit the real `.env` file.

## Tests

To run the frontend tests:

    cd client
    npm test

To run the backend tests:

    cd server
    npm test

## Lab 1

Lab 1 features are implemented incrementally through separate Issues, feature branches, Pull Requests, and peer review.
