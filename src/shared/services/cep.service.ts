/**
 * CEP (Brazilian Postal Code) Service
 * Integrates with BrasilAPI for address auto-completion
 */

export interface CEPData {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  service: string;
}

export interface CEPError {
  error: boolean;
  message: string;
}

/**
 * Fetches CEP data from BrasilAPI
 */
export async function fetchCEPData(cep: string): Promise<CEPData | CEPError> {
  try {
    // Clean CEP (remove non-numeric characters)
    const cleanCEP = cep.replace(/\D/g, '');
    
    // Validate CEP format
    if (cleanCEP.length !== 8) {
      return {
        error: true,
        message: 'CEP deve ter 8 dígitos'
      };
    }
    
    // Format CEP for API call
    const formattedCEP = cleanCEP.replace(/(\d{5})(\d{3})/, '$1-$2');
    
    // Fetch from BrasilAPI with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${formattedCEP}`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      if (response.status === 404) {
        return {
          error: true,
          message: 'CEP não encontrado'
        };
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json() as any;
    
    return {
      cep: data.cep,
      state: data.state,
      city: data.city,
      neighborhood: data.neighborhood,
      street: data.street,
      service: data.service
    };
    
  } catch (error) {
    console.error('Error fetching CEP data:', error);
    return {
      error: true,
      message: 'Erro ao buscar dados do CEP. Tente novamente.'
    };
  }
}

/**
 * Alternative CEP service using ViaCEP (backup)
 */
export async function fetchCEPDataViaCEP(cep: string): Promise<CEPData | CEPError> {
  try {
    const cleanCEP = cep.replace(/\D/g, '');
    
    if (cleanCEP.length !== 8) {
      return {
        error: true,
        message: 'CEP deve ter 8 dígitos'
      };
    }
    
    // Fetch from ViaCEP with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json() as any;
    
    if (data.erro) {
      return {
        error: true,
        message: 'CEP não encontrado'
      };
    }
    
    return {
      cep: data.cep,
      state: data.uf,
      city: data.localidade,
      neighborhood: data.bairro,
      street: data.logradouro,
      service: 'viacep'
    };
    
  } catch (error) {
    console.error('Error fetching CEP data from ViaCEP:', error);
    return {
      error: true,
      message: 'Erro ao buscar dados do CEP. Tente novamente.'
    };
  }
}

/**
 * Smart CEP fetcher that tries multiple services
 */
export async function fetchCEPDataSmart(cep: string): Promise<CEPData | CEPError> {
  // Try BrasilAPI first
  const brasilAPIResult = await fetchCEPData(cep);
  
  if (!('error' in brasilAPIResult) || !brasilAPIResult.error) {
    return brasilAPIResult;
  }
  
  // If BrasilAPI fails, try ViaCEP as backup
  const viaCEPResult = await fetchCEPDataViaCEP(cep);
  
  return viaCEPResult;
}

/**
 * Formats CEP input as user types
 */
export function formatCEPInput(value: string): string {
  const cleanValue = value.replace(/\D/g, '');
  
  if (cleanValue.length <= 5) {
    return cleanValue;
  } else {
    return cleanValue.replace(/(\d{5})(\d{3})/, '$1-$2');
  }
}

/**
 * Validates CEP format
 */
export function isValidCEPFormat(cep: string): boolean {
  const cleanCEP = cep.replace(/\D/g, '');
  return cleanCEP.length === 8 && /^\d{8}$/.test(cleanCEP);
}