import { Request, Response } from 'express';
import { validateCPF, validateCNPJ, validateDocument, validateCEP, formatCPF, formatCNPJ, formatCEP, validateDocument2026 } from '../../shared/utils/validation';
import { env } from '../../config/env';
import { fetchCEPDataSmart } from '../../shared/services/cep.service';

export class ValidationController {
  /**
   * Validates CPF
   */
  validateCPF = async (req: Request, res: Response) => {
    try {
      const { cpf } = req.body;
      
      if (!cpf) {
        return res.status(400).json({
          error: 'CPF é obrigatório'
        });
      }
      
      const result = validateCPF(cpf);
      
      res.json({
        isValid: result.isValid,
        formatted: result.formatted,
        error: result.error
      });
      
    } catch (error) {
      console.error('Error validating CPF:', error);
      res.status(500).json({
        error: 'Erro interno do servidor'
      });
    }
  };

  /**
   * Validates CNPJ
   */
  validateCNPJ = async (req: Request, res: Response) => {
    try {
      const { cnpj } = req.body;
      
      if (!cnpj) {
        return res.status(400).json({
          error: 'CNPJ é obrigatório'
        });
      }
      
      const result = env.ENABLE_CNPJ_2026 ? validateDocument2026(cnpj) : validateCNPJ(cnpj);
      
      res.json({
        isValid: result.isValid,
        formatted: result.formatted,
        error: result.error
      });
      
    } catch (error) {
      console.error('Error validating CNPJ:', error);
      res.status(500).json({
        error: 'Erro interno do servidor'
      });
    }
  };

  /**
   * Validates document (CPF or CNPJ)
   */
  validateDocument = async (req: Request, res: Response) => {
    try {
      const { document } = req.body;
      
      if (!document) {
        return res.status(400).json({
          error: 'Documento é obrigatório'
        });
      }
      
      const result = env.ENABLE_CNPJ_2026 ? validateDocument2026(document) : validateDocument(document);
      
      res.json({
        isValid: result.isValid,
        formatted: result.formatted,
        error: result.error,
        scheme: result.scheme,
        normalized: result.normalized,
      });
      
    } catch (error) {
      console.error('Error validating document:', error);
      res.status(500).json({
        error: 'Erro interno do servidor'
      });
    }
  };

  /**
   * Validates CEP
   */
  validateCEP = async (req: Request, res: Response) => {
    try {
      const { cep } = req.body;
      
      if (!cep) {
        return res.status(400).json({
          error: 'CEP é obrigatório'
        });
      }
      
      const result = validateCEP(cep);
      
      res.json({
        isValid: result.isValid,
        formatted: result.formatted,
        error: result.error
      });
      
    } catch (error) {
      console.error('Error validating CEP:', error);
      res.status(500).json({
        error: 'Erro interno do servidor'
      });
    }
  };

  /**
   * Fetches CEP data for auto-completion
   */
  fetchCEPData = async (req: Request, res: Response) => {
    try {
      const { cep } = req.params;
      
      if (!cep) {
        return res.status(400).json({
          error: 'CEP é obrigatório'
        });
      }
      
      const result = await fetchCEPDataSmart(cep);
      
      if ('error' in result && result.error) {
        return res.status(404).json({
          error: true,
          message: result.message
        });
      }
      
      res.json({
        error: false,
        data: result
      });
      
    } catch (error) {
      console.error('Error fetching CEP data:', error);
      res.status(500).json({
        error: 'Erro interno do servidor'
      });
    }
  };

  /**
   * Formats CPF
   */
  formatCPF = async (req: Request, res: Response) => {
    try {
      const { cpf } = req.body;
      
      if (!cpf) {
        return res.status(400).json({
          error: 'CPF é obrigatório'
        });
      }
      
      const formatted = formatCPF(cpf);
      
      res.json({
        formatted
      });
      
    } catch (error) {
      console.error('Error formatting CPF:', error);
      res.status(500).json({
        error: 'Erro interno do servidor'
      });
    }
  };

  /**
   * Formats CNPJ
   */
  formatCNPJ = async (req: Request, res: Response) => {
    try {
      const { cnpj } = req.body;
      
      if (!cnpj) {
        return res.status(400).json({
          error: 'CNPJ é obrigatório'
        });
      }
      
      const formatted = formatCNPJ(cnpj);
      
      res.json({
        formatted
      });
      
    } catch (error) {
      console.error('Error formatting CNPJ:', error);
      res.status(500).json({
        error: 'Erro interno do servidor'
      });
    }
  };

  /**
   * Formats CEP
   */
  formatCEP = async (req: Request, res: Response) => {
    try {
      const { cep } = req.body;
      
      if (!cep) {
        return res.status(400).json({
          error: 'CEP é obrigatório'
        });
      }
      
      const formatted = formatCEP(cep);
      
      res.json({
        formatted
      });
      
    } catch (error) {
      console.error('Error formatting CEP:', error);
      res.status(500).json({
        error: 'Erro interno do servidor'
      });
    }
  };
}
