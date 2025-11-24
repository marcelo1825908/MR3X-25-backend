import { createApp } from './app';
import http from 'http';
import { initRealtime } from './realtime/socket';
import { env } from './config/env';
import { prisma } from './config/database';

// Fix BigInt serialization for JSON
BigInt.prototype.toJSON = function() {
  return this.toString();
};

const startServer = async () => {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('Database connected successfully');

    const app = createApp();
    const server = http.createServer(app);
    initRealtime(server);

    server.listen(env.SERVER_PORT, () => {
      console.log(`Server running on port ${env.SERVER_PORT}`);
      console.log(`Environment: ${env.NODE_ENV}`);
      console.log(`Health check: http://localhost:${env.SERVER_PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

