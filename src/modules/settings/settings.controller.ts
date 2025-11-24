import { Request, Response } from 'express';
import { SettingsService } from './settings.service';
import { updateSettingSchema, updatePaymentConfigSchema } from './settings.dto';

export class SettingsController {
  private settingsService: SettingsService;

  constructor() {
    this.settingsService = new SettingsService();
  }

  getSetting = async (req: Request, res: Response) => {
    try {
      const { key } = req.params;
      const value = await this.settingsService.getSetting(key);
      
      if (value === null) {
        return res.status(404).json({
          status: 'error',
          message: 'Setting not found',
        });
      }

      res.json({ key, value });
    } catch (error: any) {
      console.error('Error in getSetting:', error);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Internal server error',
      });
    }
  };

  updateSetting = async (req: Request, res: Response) => {
    try {
      const { key } = req.params;
      const data = updateSettingSchema.parse(req.body);
      
      await this.settingsService.setSetting(key, data.value, data.description);
      
      res.json({
        status: 'success',
        message: 'Setting updated successfully',
        key,
        value: data.value,
      });
    } catch (error: any) {
      console.error('Error in updateSetting:', error);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Internal server error',
      });
    }
  };

  getPaymentConfig = async (req: Request, res: Response) => {
    try {
      const config = await this.settingsService.getPaymentConfig();
      res.json(config);
    } catch (error: any) {
      console.error('Error in getPaymentConfig:', error);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Internal server error',
      });
    }
  };

  updatePaymentConfig = async (req: Request, res: Response) => {
    try {
      const data = updatePaymentConfigSchema.parse(req.body);
      const config = await this.settingsService.updatePaymentConfig(data);
      
      res.json({
        status: 'success',
        message: 'Payment configuration updated successfully',
        config,
      });
    } catch (error: any) {
      console.error('Error in updatePaymentConfig:', error);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Internal server error',
      });
    }
  };

  getAllSettings = async (req: Request, res: Response) => {
    try {
      const settings = await this.settingsService.getAllSettings();
      res.json(settings);
    } catch (error: any) {
      console.error('Error in getAllSettings:', error);
      res.status(500).json({
        status: 'error',
        message: error.message || 'Internal server error',
      });
    }
  };
}

