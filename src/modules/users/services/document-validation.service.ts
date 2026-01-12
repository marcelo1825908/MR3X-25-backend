import { Injectable } from '@nestjs/common';

@Injectable()
export class DocumentValidationService {
  /**
   * Validates CPF (Brazilian individual tax ID)
   */
  validateCPF(cpf: string): boolean {
    const cleanCPF = cpf.replace(/[^\d]/g, '');
    if (cleanCPF.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cleanCPF)) return false; // All same digits

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
    }
    let digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(cleanCPF.charAt(9))) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
    }
    digit = 11 - (sum % 11);
    if (digit >= 10) digit = 0;
    if (digit !== parseInt(cleanCPF.charAt(10))) return false;

    return true;
  }

  /**
   * Validates CNPJ (Brazilian company tax ID)
   * Supports both numeric (14 digits) and alphanumeric (from Jan 2026)
   */
  validateCNPJ(cnpj: string): { valid: boolean; isAlphanumeric: boolean; message?: string } {
    const cleanCNPJ = cnpj.replace(/[^\w]/g, '').toUpperCase();
    
    // Check if alphanumeric (new format from Jan 2026)
    const hasLetters = /[A-Z]/.test(cleanCNPJ);
    const isAlphanumeric = hasLetters && cleanCNPJ.length >= 8 && cleanCNPJ.length <= 14;

    if (isAlphanumeric) {
      // Alphanumeric CNPJ validation (new format)
      // Format: 2-4 letters + 8-10 alphanumeric characters
      // Example: ABC12345678901 or ABCD123456789
      const alphanumericPattern = /^[A-Z]{2,4}[A-Z0-9]{8,10}$/;
      if (!alphanumericPattern.test(cleanCNPJ)) {
        return {
          valid: false,
          isAlphanumeric: true,
          message: 'Formato alfanumérico de CNPJ inválido. Use 2-4 letras seguidas de 8-10 caracteres alfanuméricos.',
        };
      }
      return { valid: true, isAlphanumeric: true };
    }

    // Traditional numeric CNPJ validation (14 digits)
    if (cleanCNPJ.length !== 14) {
      return {
        valid: false,
        isAlphanumeric: false,
        message: 'CNPJ deve ter 14 dígitos numéricos',
      };
    }

    if (/^(\d)\1{13}$/.test(cleanCNPJ)) {
      return {
        valid: false,
        isAlphanumeric: false,
        message: 'CNPJ inválido (todos os dígitos são iguais)',
      };
    }

    // Validate CNPJ check digits
    let length = cleanCNPJ.length - 2;
    let numbers = cleanCNPJ.substring(0, length);
    const digits = cleanCNPJ.substring(length);
    let sum = 0;
    let pos = length - 7;

    for (let i = length; i >= 1; i--) {
      sum += parseInt(numbers.charAt(length - i)) * pos--;
      if (pos < 2) pos = 9;
    }

    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) {
      return {
        valid: false,
        isAlphanumeric: false,
        message: 'CNPJ inválido (primeiro dígito verificador incorreto)',
      };
    }

    length = length + 1;
    numbers = cleanCNPJ.substring(0, length);
    sum = 0;
    pos = length - 7;

    for (let i = length; i >= 1; i--) {
      sum += parseInt(numbers.charAt(length - i)) * pos--;
      if (pos < 2) pos = 9;
    }

    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1))) {
      return {
        valid: false,
        isAlphanumeric: false,
        message: 'CNPJ inválido (segundo dígito verificador incorreto)',
      };
    }

    return { valid: true, isAlphanumeric: false };
  }

  /**
   * Validates document (CPF or CNPJ)
   */
  validateDocument(document: string): {
    valid: boolean;
    type: 'CPF' | 'CNPJ' | 'UNKNOWN';
    isAlphanumeric?: boolean;
    message?: string;
  } {
    if (!document) {
      return { valid: false, type: 'UNKNOWN', message: 'Documento não fornecido' };
    }

    const cleanDoc = document.replace(/[^\w]/g, '').toUpperCase();

    // Check if it's likely a CNPJ (has letters or length >= 12)
    if (cleanDoc.length >= 12 || /[A-Z]/.test(cleanDoc)) {
      const cnpjResult = this.validateCNPJ(document);
      return {
        valid: cnpjResult.valid,
        type: 'CNPJ',
        isAlphanumeric: cnpjResult.isAlphanumeric,
        message: cnpjResult.message,
      };
    }

    // Otherwise, treat as CPF
    const cpfValid = this.validateCPF(document);
    return {
      valid: cpfValid,
      type: 'CPF',
      message: cpfValid ? undefined : 'CPF inválido',
    };
  }

  /**
   * Formats document for display (masks sensitive data)
   */
  formatDocumentForDisplay(document: string, mask: boolean = true): string {
    if (!document) return '';
    
    const cleanDoc = document.replace(/[^\w]/g, '').toUpperCase();
    
    if (mask && cleanDoc.length === 11) {
      // CPF: 000.000.000-00
      return cleanDoc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.***-$4');
    } else if (mask && (cleanDoc.length === 14 || cleanDoc.length >= 8)) {
      // CNPJ: 00.000.000/0000-00 or alphanumeric
      if (/[A-Z]/.test(cleanDoc)) {
        // Alphanumeric: mask middle part
        return cleanDoc.substring(0, 2) + '***' + cleanDoc.substring(cleanDoc.length - 2);
      } else {
        return cleanDoc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.***.***/****-$5');
      }
    }
    
    return document;
  }
}

