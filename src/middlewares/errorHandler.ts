import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/AppError';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export const errorHandler = (
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Handle custom AppError
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      status: 'error',
      message: error.message,
    });
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation error',
      errors: error.errors,
    });
  }

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation
    if (error.code === 'P2002') {
      return res.status(409).json({
        status: 'error',
        message: 'Resource already exists',
      });
    }
    
    // Record not found
    if (error.code === 'P2025') {
      return res.status(404).json({
        status: 'error',
        message: 'Resource not found',
      });
    }
  }

  // Handle unknown errors
  console.error('Unhandled error:', error);
  
  return res.status(500).json({
    status: 'error',
    message: 'Internal server error',
  });
};

