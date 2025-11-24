# Backend Node.js Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
cd backend-nodejs
npm install
```

### 2. Configure Environment

The `.env` file is already created with default values. Update if needed:

```bash
# Review and modify .env file
nano .env
```

### 3. Database Setup

Make sure MySQL is running and the database exists. If using the existing Java backend database, you can reuse it.

#### Option A: Use existing database

The Prisma schema is configured to work with your existing database. Just run:

```bash
npm run prisma:generate
```

#### Option B: Create new database and migrate

```bash
# Create database in MySQL
mysql -u root -p
CREATE DATABASE mr3x_db_v2;
exit;

# Generate Prisma Client
npm run prisma:generate

# Push schema to database (this will create all tables)
npx prisma db push
```

### 4. Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:8081`

### 5. Test the API

Health check:
```bash
curl http://localhost:8081/health
```

Register a user:
```bash
curl -X POST http://localhost:8081/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "123456",
    "role": "PROPRIETARIO",
    "plan": "PREMIUM",
    "name": "Test User"
  }'
```

Login:
```bash
curl -X POST http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "123456"
  }'
```

## Docker Deployment

### Build and run with Docker Compose

```bash
docker-compose up -d
```

This will start both the Node.js backend and MySQL database.

### Stop services

```bash
docker-compose down
```

## Database Management

### Open Prisma Studio (Database GUI)

```bash
npm run prisma:studio
```

### Create a migration

```bash
npm run prisma:migrate
```

### Pull schema from existing database

```bash
npm run prisma:pull
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio
- `npm test` - Run tests

## Project Structure

```
backend-nodejs/
├── src/
│   ├── config/           # Configuration (env, database, jwt)
│   ├── middlewares/      # Express middlewares
│   ├── modules/          # Feature modules
│   │   ├── auth/        # Authentication
│   │   ├── users/       # User management
│   │   └── address/     # Address lookup
│   ├── shared/          # Shared utilities
│   ├── app.ts           # Express app setup
│   └── server.ts        # Server entry point
├── prisma/
│   └── schema.prisma    # Database schema
└── package.json
```

## Next Steps

The following modules still need to be implemented:

- Properties CRUD
- Contracts with PDF generation
- Payments management
- Dashboard endpoints
- Chat system
- Notifications system
- Document management

Each module follows the same pattern as `auth` and `users`:
- `module.dto.ts` - Data transfer objects and validation schemas
- `module.service.ts` - Business logic
- `module.controller.ts` - Request handlers
- `module.routes.ts` - Route definitions

## Troubleshooting

### Port already in use

If port 8081 is already in use (by the Java backend), either:
1. Stop the Java backend, or
2. Change the port in `.env`:
   ```
   SERVER_PORT=8082
   ```

### Database connection errors

- Verify MySQL is running
- Check DATABASE_URL in `.env`
- Ensure the database exists
- Verify credentials are correct

### Prisma errors

- Run `npm run prisma:generate` after schema changes
- Clear node_modules and reinstall if needed
- Check Prisma documentation: https://www.prisma.io/docs

