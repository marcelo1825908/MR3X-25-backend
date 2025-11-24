import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'express-async-errors';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';

// Routes
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/users.routes';
import companyRoutes from './modules/companies/companies.routes';
import agenciesRoutes from './modules/agencies/agencies.routes';
import addressRoutes from './modules/address/address.routes';
import propertyRoutes from './modules/properties/properties.routes';
import contractRoutes from './modules/contracts/contracts.routes';
import paymentRoutes from './modules/payments/payments.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import chatRoutes from './modules/chats/chats.routes';
import notificationRoutes from './modules/notifications/notifications.routes';
import validationRoutes from './modules/validation/validation.routes';
import auditRoutes from './modules/audit/audit.routes';
import documentsRoutes from './modules/documents/documents.routes';
import plansRoutes from './modules/plans/plans.routes';
import settingsRoutes from './modules/settings/settings.routes';
import contractTemplatesRoutes from './modules/contract-templates/contractTemplates.routes';

// Global BigInt serialization for JSON responses
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

export const createApp = (): Express => {
  const app = express();

  // Trust proxy to get real IP addresses (for IP tracking)
  app.set('trust proxy', true);

  // Security middleware
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }));
  
  // CORS configuration
  const allowedOrigins = env.CORS_ALLOWED_ORIGINS.split(',');
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    })
  );

  // Body parser
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API Routes
  app.use('/auth', authRoutes);
  app.use('/users', userRoutes);
  app.use('/companies', companyRoutes);
  app.use('/agencies', agenciesRoutes);
  app.use('/address', addressRoutes);
  app.use('/properties', propertyRoutes);
  app.use('/contracts', contractRoutes);
  app.use('/payments', paymentRoutes);
  app.use('/dashboard', dashboardRoutes);
  app.use('/chats', chatRoutes);
  app.use('/notifications', notificationRoutes);
  app.use('/validation', validationRoutes);
  app.use('/audit', auditRoutes);
  app.use('/documents', documentsRoutes);
  app.use('/plans', plansRoutes);
  app.use('/settings', settingsRoutes);
  app.use('/contract-templates', contractTemplatesRoutes);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
};

