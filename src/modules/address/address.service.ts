import axios from 'axios';
import { AppError } from '../../shared/errors/AppError';

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export class AddressService {
  async getByCep(cep: string) {
    // Remove non-numeric characters
    const cleanCep = cep.replace(/\D/g, '');

    if (cleanCep.length !== 8) {
      throw new AppError('Invalid CEP format', 400);
    }

    try {
      const response = await axios.get<ViaCepResponse>(
        `https://viacep.com.br/ws/${cleanCep}/json/`
      );

      if (response.data.erro) {
        throw new AppError('CEP not found', 404);
      }

      return {
        cep: response.data.cep,
        address: response.data.logradouro,
        complement: response.data.complemento,
        neighborhood: response.data.bairro,
        city: response.data.localidade,
        state: response.data.uf,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new AppError('Error fetching address', 500);
      }
      throw error;
    }
  }
}

