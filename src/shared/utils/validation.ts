/**
 * Brazilian CNPJ/CPF Validation Utilities
 * Supports current format and prepares for 2026 changes
 */

export interface ValidationResult {
  isValid: boolean;
  formatted?: string;
  error?: string;
  normalized?: string;
  scheme?: 'legacy' | '2026';
}

/**
 * Validates CPF (Cadastro de Pessoas Físicas)
 * Supports current format and prepares for 2026 changes
 */
export function validateCPF(cpf: string): ValidationResult {
  // Remove all non-numeric characters
  const cleanCPF = cpf.replace(/\D/g, '');
  
  // Check if it has 11 digits
  if (cleanCPF.length !== 11) {
    return {
      isValid: false,
      error: 'CPF deve ter 11 dígitos'
    };
  }
  
  // Check for invalid sequences (all same digits)
  if (/^(\d)\1{10}$/.test(cleanCPF)) {
    return {
      isValid: false,
      error: 'CPF inválido (sequência inválida)'
    };
  }
  
  // Calculate first verification digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF[i]) * (10 - i);
  }
  let remainder = sum % 11;
  let firstDigit = remainder < 2 ? 0 : 11 - remainder;
  
  // Calculate second verification digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF[i]) * (11 - i);
  }
  remainder = sum % 11;
  let secondDigit = remainder < 2 ? 0 : 11 - remainder;
  
  // Check if calculated digits match the provided ones
  if (parseInt(cleanCPF[9]) !== firstDigit || parseInt(cleanCPF[10]) !== secondDigit) {
    return {
      isValid: false,
      error: 'CPF inválido (dígitos verificadores incorretos)'
    };
  }
  
  return {
    isValid: true,
    formatted: formatCPF(cleanCPF)
  };
}

/**
 * Validates CNPJ (Cadastro Nacional da Pessoa Jurídica)
 * Supports current format and prepares for 2026 changes
 */
export function validateCNPJ(cnpj: string): ValidationResult {
  // Remove all non-numeric characters
  const cleanCNPJ = cnpj.replace(/\D/g, '');
  
  // Check if it has 14 digits
  if (cleanCNPJ.length !== 14) {
    return {
      isValid: false,
      error: 'CNPJ deve ter 14 dígitos'
    };
  }
  
  // Check for invalid sequences (all same digits)
  if (/^(\d)\1{13}$/.test(cleanCNPJ)) {
    return {
      isValid: false,
      error: 'CNPJ inválido (sequência inválida)'
    };
  }
  
  // Calculate first verification digit
  let sum = 0;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanCNPJ[i]) * weights1[i];
  }
  let remainder = sum % 11;
  let firstDigit = remainder < 2 ? 0 : 11 - remainder;
  
  // Calculate second verification digit
  sum = 0;
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleanCNPJ[i]) * weights2[i];
  }
  remainder = sum % 11;
  let secondDigit = remainder < 2 ? 0 : 11 - remainder;
  
  // Check if calculated digits match the provided ones
  if (parseInt(cleanCNPJ[12]) !== firstDigit || parseInt(cleanCNPJ[13]) !== secondDigit) {
    return {
      isValid: false,
      error: 'CNPJ inválido (dígitos verificadores incorretos)'
    };
  }
  
  return {
    isValid: true,
    formatted: formatCNPJ(cleanCNPJ),
    normalized: cleanCNPJ,
    scheme: 'legacy',
  };
}

/**
 * Formats CPF with dots and dash
 */
export function formatCPF(cpf: string): string {
  const cleanCPF = cpf.replace(/\D/g, '');
  return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formats CNPJ with dots, slash and dash
 */
export function formatCNPJ(cnpj: string): string {
  const cleanCNPJ = cnpj.replace(/\D/g, '');
  return cleanCNPJ.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Validates both CPF and CNPJ based on length
 */
export function validateDocument(document: string): ValidationResult {
  const cleanDoc = document.replace(/\D/g, '');
  
  if (cleanDoc.length === 11) {
    return validateCPF(document);
  } else if (cleanDoc.length === 14) {
    return validateCNPJ(document);
  } else {
    return {
      isValid: false,
      error: 'Documento deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ)'
    };
  }
}

/**
 * Validates CEP (Brazilian postal code)
 */
export function validateCEP(cep: string): ValidationResult {
  const cleanCEP = cep.replace(/\D/g, '');
  
  if (cleanCEP.length !== 8) {
    return {
      isValid: false,
      error: 'CEP deve ter 8 dígitos'
    };
  }
  
  return {
    isValid: true,
    formatted: formatCEP(cleanCEP),
    normalized: cleanCEP,
  };
}

/**
 * Formats CEP with dash
 */
export function formatCEP(cep: string): string {
  const cleanCEP = cep.replace(/\D/g, '');
  return cleanCEP.replace(/(\d{5})(\d{3})/, '$1-$2');
}

/**
 * 2026 Format Preparation
 * This function will be updated when the new format is officially released
 */
export function validateDocument2026(document: string): ValidationResult {
  // Placeholder: accept both legacy and provisional base-36 CNPJ when feature flag is on
  const clean = document.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  // CPF remains numeric
  if (/^\d{11}$/.test(clean)) return validateCPF(document);
  // Legacy CNPJ
  if (/^\d{14}$/.test(clean)) return validateCNPJ(document);
  // Provisional CNPJ 2026: 14 base-36 chars, keep dv rule similar (not official)
  if (/^[0-9A-Z]{14}$/.test(clean)) {
    const map = (ch: string) => (ch >= 'A' && ch <= 'Z' ? ch.charCodeAt(0) - 55 : parseInt(ch, 10));
    const vals = clean.split('').map(map);
    // compute dv with same weight arrays, modulo 11
    const w1 = [5,4,3,2,9,8,7,6,5,4,3,2];
    let sum = 0; for (let i=0;i<12;i++) sum += vals[i]*w1[i];
    let r = sum % 11; const d1 = r < 2 ? 0 : 11 - r;
    const w2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
    sum = 0; for (let i=0;i<13;i++) sum += (i===12?d1:vals[i])*w2[i];
    r = sum % 11; const d2 = r < 2 ? 0 : 11 - r;
    if (vals[12] === d1 && vals[13] === d2) {
      return { isValid: true, formatted: clean, normalized: clean, scheme: '2026' };
    }
    return { isValid: false, error: 'Invalid 2026 CNPJ check digits' };
  }
  return { isValid: false, error: 'Unsupported document format' };
}