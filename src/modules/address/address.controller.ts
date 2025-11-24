import { Request, Response } from 'express';
import { AddressService } from './address.service';

export class AddressController {
  private addressService: AddressService;

  constructor() {
    this.addressService = new AddressService();
  }

  getByCep = async (req: Request, res: Response) => {
    const { cep } = req.params;
    const result = await this.addressService.getByCep(cep);
    res.json(result);
  };
}

