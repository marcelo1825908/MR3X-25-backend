import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema, requestEmailCodeSchema, confirmEmailCodeSchema, completeRegisterSchema } from './auth.dto';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  login = async (req: Request, res: Response) => {
    const data = loginSchema.parse(req.body);
    try {
      const result = await this.authService.login(data);
      res.json(result);
    } catch (err: any) {
      // Scrub generic invalid credential errors for better DX logging
      if (process.env.NODE_ENV !== 'production') {
        console.error('Login failed:', err?.message);
      }
      throw err;
    }
  };

  register = async (req: Request, res: Response) => {
    const data = registerSchema.parse(req.body);
    const result = await this.authService.register(data);
    res.status(200).json(result);
  };

  requestEmailCode = async (req: Request, res: Response) => {
    const data = requestEmailCodeSchema.parse(req.body);
    const result = await this.authService.requestEmailCode(data);
    res.json(result);
  };

  confirmEmailCode = async (req: Request, res: Response) => {
    const data = confirmEmailCodeSchema.parse(req.body);
    const result = await this.authService.confirmEmailCode(data);
    res.json(result);
  };

  completeRegistration = async (req: Request, res: Response) => {
    const data = completeRegisterSchema.parse(req.body);
    const result = await this.authService.completeRegistration(data);
    res.status(200).json(result);
  };

  forgotPassword = async (req: Request, res: Response) => {
    const data = forgotPasswordSchema.parse(req.body);
    await this.authService.forgotPassword(data);
    res.status(204).send();
  };

  resetPassword = async (req: Request, res: Response) => {
    const data = resetPasswordSchema.parse(req.body);
    await this.authService.resetPassword(data);
    res.status(204).send();
  };

  logout = async (req: Request, res: Response) => {
    // No refresh token needed - just return success
    const result = await this.authService.logout();
    res.json(result);
  };

  logoutAll = async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const result = await this.authService.logoutAll(userId);
    res.json(result);
  };
}

