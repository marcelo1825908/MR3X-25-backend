# MR3X Backend - Node.js

Backend for the MR3X Rental Management System built with Node.js, Express, TypeScript, and Prisma.

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Language**: TypeScript
- **ORM**: Prisma
- **Database**: MySQL
- **Authentication**: JWT
- **Validation**: Zod
- **PDF Generation**: Puppeteer
- **Email**: Nodemailer

## Getting Started

### Prerequisites

- Node.js 20+
- MySQL 8+
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Configure your `.env` file with database credentials and other settings.

4. Generate Prisma client:
```bash
npm run prisma:generate
```

5. Run database migrations:
```bash
npm run prisma:migrate
```

### Development

Start the development server:
```bash
npm run dev
```

The server will start on `http://localhost:8081`

### Building for Production

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── config/           # Configuration files (database, jwt, etc.)
├── middlewares/      # Express middlewares
├── modules/          # Feature modules
│   ├── auth/
│   ├── users/
│   ├── properties/
│   ├── contracts/
│   ├── payments/
│   ├── chats/
│   ├── notifications/
│   └── dashboard/
├── shared/           # Shared utilities, types, DTOs
├── app.ts            # Express app setup
└── server.ts         # Server entry point
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio
- `npm test` - Run tests
- `npm run lint` - Lint code

## API Documentation

API documentation is available at `/api-docs` when the server is running.

## License

ISC

