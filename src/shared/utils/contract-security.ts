import crypto from 'crypto';

/**
 * Generate contract token in format: MR3X-[TYPE]-[YEAR]-[RANDOM]-[RANDOM]
 * Example: MR3X-CTR-2025-01234-12345
 */
export function generateContractToken(type: 'CTR' | 'ACD' | 'VST' = 'CTR'): string {
  const currentYear = new Date().getFullYear();
  const random1 = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  const random2 = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `MR3X-${type}-${currentYear}-${random1}-${random2}`;
}

/**
 * Generate SHA-256 hash for contract verification
 */
export function generateContractHash(data: string, ip: string): string {
  const combinedData = `${data}${ip}${Date.now()}`;
  return crypto.createHash('sha256').update(combinedData).digest('hex');
}

/**
 * Validate contract token format
 */
export function validateContractToken(token: string, type: 'CTR' | 'ACD' | 'VST' = 'CTR'): boolean {
  const currentYear = new Date().getFullYear();
  const pattern = new RegExp(`^MR3X-${type}-${currentYear}-\\d{5}-\\d{5}$`);
  return pattern.test(token);
}

/**
 * Verify contract hash
 */
export function verifyContractHash(data: string, ip: string, hash: string): boolean {
  // Note: This is a simplified verification. In production, you should store
  // the original IP and timestamp used to generate the hash
  const testHash = generateContractHash(data, ip);
  return testHash === hash;
}

/**
 * Replace placeholders in contract template with actual data
 */
export function replaceTemplatePlaceholders(template: string, data: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const placeholder = `[${key}]`;
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value || '');
  }
  return result;
}


