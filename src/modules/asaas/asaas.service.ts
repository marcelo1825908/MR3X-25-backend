import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AsaasCustomer,
  CreateCustomerDto,
  AsaasPayment,
  CreatePaymentDto,
  AsaasPixQrCode,
  AsaasSubscription,
  CreateSubscriptionDto,
  AsaasListResponse,
  AsaasBillingType,
  PaymentCreationResult,
  CustomerSyncResult,
} from './interfaces/asaas.interfaces';

@Injectable()
export class AsaasService implements OnModuleInit {
  private readonly logger = new Logger(AsaasService.name);
  private apiKey: string;
  private baseUrl: string;
  private isConfigured = false;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.apiKey = this.configService.get<string>('ASAAS_API_KEY') || '';
    const environment = this.configService.get<string>('ASAAS_ENVIRONMENT') || 'sandbox';

    this.baseUrl = environment === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    this.isConfigured = !!this.apiKey;

    if (this.isConfigured) {
      this.logger.log(`Asaas API configured for ${environment} environment`);
    } else {
      this.logger.warn('Asaas API key not configured. Payment processing will be disabled.');
    }
  }

  isEnabled(): boolean {
    return this.isConfigured;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: any,
  ): Promise<T> {
    if (!this.isConfigured) {
      throw new Error('Asaas API is not configured');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'access_token': this.apiKey,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    try {
      this.logger.debug(`Asaas API ${method} ${endpoint}`);
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.logger.error(`Asaas API error: ${response.status}`, errorData);
        throw new Error(
          errorData.errors?.[0]?.description ||
          `Asaas API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      this.logger.error(`Asaas API request failed: ${error.message}`);
      throw error;
    }
  }

  async createCustomer(data: CreateCustomerDto): Promise<AsaasCustomer> {
    return this.request<AsaasCustomer>('POST', '/customers', data);
  }

  async updateCustomer(customerId: string, data: Partial<CreateCustomerDto>): Promise<AsaasCustomer> {
    return this.request<AsaasCustomer>('PUT', `/customers/${customerId}`, data);
  }

  async getCustomer(customerId: string): Promise<AsaasCustomer> {
    return this.request<AsaasCustomer>('GET', `/customers/${customerId}`);
  }

  async findCustomerByCpfCnpj(cpfCnpj: string): Promise<AsaasCustomer | null> {
    const cleanCpfCnpj = cpfCnpj.replace(/\D/g, '');
    const response = await this.request<AsaasListResponse<AsaasCustomer>>(
      'GET',
      `/customers?cpfCnpj=${cleanCpfCnpj}`,
    );
    return response.data.length > 0 ? response.data[0] : null;
  }

  async findCustomerByExternalReference(externalReference: string): Promise<AsaasCustomer | null> {
    const response = await this.request<AsaasListResponse<AsaasCustomer>>(
      'GET',
      `/customers?externalReference=${externalReference}`,
    );
    return response.data.length > 0 ? response.data[0] : null;
  }

  async listCustomers(offset: number = 0, limit: number = 10): Promise<AsaasListResponse<AsaasCustomer>> {
    return this.request<AsaasListResponse<AsaasCustomer>>(
      'GET',
      `/customers?offset=${offset}&limit=${limit}`,
    );
  }

  async deleteCustomer(customerId: string): Promise<{ deleted: boolean; id: string }> {
    return this.request<{ deleted: boolean; id: string }>('DELETE', `/customers/${customerId}`);
  }

  async syncCustomer(userData: {
    id: string;
    name: string;
    email: string;
    document: string;
    phone?: string;
    address?: string;
    addressNumber?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  }): Promise<CustomerSyncResult> {
    try {
      let customer = await this.findCustomerByExternalReference(`user_${userData.id}`);

      const customerData: CreateCustomerDto = {
        name: userData.name,
        email: userData.email,
        cpfCnpj: userData.document.replace(/\D/g, ''),
        phone: userData.phone?.replace(/\D/g, ''),
        address: userData.address,
        addressNumber: userData.addressNumber,
        city: userData.city,
        state: userData.state,
        postalCode: userData.postalCode?.replace(/\D/g, ''),
        externalReference: `user_${userData.id}`,
        notificationDisabled: false,
      };

      if (customer) {
        // Always update customer with latest data including CPF/CNPJ
        this.logger.log(`Updating existing customer ${customer.id} with CPF/CNPJ: ${customerData.cpfCnpj}`);
        customer = await this.updateCustomer(customer.id, customerData);
        // Verify CPF/CNPJ was updated
        const updatedCustomer = await this.getCustomer(customer.id);
        if (updatedCustomer.cpfCnpj !== customerData.cpfCnpj) {
          this.logger.warn(`Customer CPF/CNPJ mismatch. Expected: ${customerData.cpfCnpj}, Got: ${updatedCustomer.cpfCnpj}`);
          // Try updating again with explicit CPF/CNPJ
          customer = await this.updateCustomer(customer.id, { cpfCnpj: customerData.cpfCnpj });
        }
      } else {
        customer = await this.findCustomerByCpfCnpj(userData.document);

        if (customer) {
          // Update existing customer found by CPF/CNPJ
          this.logger.log(`Updating customer found by CPF/CNPJ ${customer.id} with latest data`);
          customer = await this.updateCustomer(customer.id, customerData);
        } else {
          // Create new customer
          this.logger.log(`Creating new customer with CPF/CNPJ: ${customerData.cpfCnpj}`);
          customer = await this.createCustomer(customerData);
        }
      }

      return {
        success: true,
        customerId: customer.id,
      };
    } catch (error) {
      this.logger.error(`Failed to sync customer: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async createPayment(data: CreatePaymentDto): Promise<AsaasPayment> {
    return this.request<AsaasPayment>('POST', '/payments', data);
  }

  async getPayment(paymentId: string): Promise<AsaasPayment> {
    return this.request<AsaasPayment>('GET', `/payments/${paymentId}`);
  }

  async listPayments(filters: {
    customer?: string;
    status?: string;
    billingType?: AsaasBillingType;
    externalReference?: string;
    offset?: number;
    limit?: number;
  }): Promise<AsaasListResponse<AsaasPayment>> {
    const params = new URLSearchParams();
    if (filters.customer) params.append('customer', filters.customer);
    if (filters.status) params.append('status', filters.status);
    if (filters.billingType) params.append('billingType', filters.billingType);
    if (filters.externalReference) params.append('externalReference', filters.externalReference);
    params.append('offset', String(filters.offset || 0));
    params.append('limit', String(filters.limit || 10));

    return this.request<AsaasListResponse<AsaasPayment>>('GET', `/payments?${params.toString()}`);
  }

  async updatePayment(paymentId: string, data: Partial<CreatePaymentDto>): Promise<AsaasPayment> {
    return this.request<AsaasPayment>('PUT', `/payments/${paymentId}`, data);
  }

  async deletePayment(paymentId: string): Promise<{ deleted: boolean; id: string }> {
    return this.request<{ deleted: boolean; id: string }>('DELETE', `/payments/${paymentId}`);
  }

  async getPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
    return this.request<AsaasPixQrCode>('GET', `/payments/${paymentId}/pixQrCode`);
  }

  async getBankSlipLine(paymentId: string): Promise<{ identificationField: string; nossoNumero: string; barCode: string }> {
    return this.request<{ identificationField: string; nossoNumero: string; barCode: string }>(
      'GET',
      `/payments/${paymentId}/identificationField`,
    );
  }

  async receiveInCash(paymentId: string, paymentDate: string, value: number): Promise<AsaasPayment> {
    return this.request<AsaasPayment>('POST', `/payments/${paymentId}/receiveInCash`, {
      paymentDate,
      value,
    });
  }

  async refundPayment(paymentId: string, value?: number): Promise<AsaasPayment> {
    const body = value ? { value } : {};
    return this.request<AsaasPayment>('POST', `/payments/${paymentId}/refund`, body);
  }

  async createCompletePayment(params: {
    customerId: string;
    customerCpfCnpj?: string;
    value: number;
    dueDate: string;
    description: string;
    externalReference: string;
    billingType?: AsaasBillingType;
    installmentCount?: number;
    discount?: { value: number; dueDateLimitDays: number; type: 'FIXED' | 'PERCENTAGE' };
    interest?: { value: number };
    fine?: { value: number; type: 'FIXED' | 'PERCENTAGE' };
  }): Promise<PaymentCreationResult> {
    try {
      // If customerCpfCnpj is not provided, fetch it from the customer
      let cpfCnpj = params.customerCpfCnpj;
      if (!cpfCnpj) {
        try {
          const customer = await this.getCustomer(params.customerId);
          cpfCnpj = customer.cpfCnpj;
        } catch (error) {
          this.logger.warn(`Could not fetch customer CPF/CNPJ: ${error.message}`);
        }
      }

      const paymentData: CreatePaymentDto = {
        customer: params.customerId,
        customerCpfCnpj: cpfCnpj ? cpfCnpj.replace(/\D/g, '') : undefined,
        billingType: params.billingType || 'UNDEFINED',
        value: params.value,
        dueDate: params.dueDate,
        description: params.description,
        externalReference: params.externalReference,
        discount: params.discount,
        interest: params.interest,
        fine: params.fine,
      };

      if (params.installmentCount && params.installmentCount > 1) {
        paymentData.installmentCount = params.installmentCount;
        paymentData.installmentValue = Math.ceil((params.value / params.installmentCount) * 100) / 100;
      }

      const payment = await this.createPayment(paymentData);

      const result: PaymentCreationResult = {
        success: true,
        paymentId: payment.id,
        invoiceUrl: payment.invoiceUrl,
        bankSlipUrl: payment.bankSlipUrl,
      };

      if (payment.billingType === 'PIX') {
        try {
          const pixData = await this.getPixQrCode(payment.id);
          result.pixQrCode = pixData.encodedImage;
          result.pixCopyPaste = pixData.payload;
        } catch (e) {
          this.logger.warn(`Could not get PIX QR code: ${e.message}`);
        }
      }

      if (payment.billingType === 'BOLETO') {
        try {
          const boletoData = await this.getBankSlipLine(payment.id);
          result.digitableLine = boletoData.identificationField;
          result.barcode = boletoData.barCode;
        } catch (e) {
          this.logger.warn(`Could not get boleto line: ${e.message}`);
        }
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to create payment: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async createSubscription(data: CreateSubscriptionDto): Promise<AsaasSubscription> {
    return this.request<AsaasSubscription>('POST', '/subscriptions', data);
  }

  async getSubscription(subscriptionId: string): Promise<AsaasSubscription> {
    return this.request<AsaasSubscription>('GET', `/subscriptions/${subscriptionId}`);
  }

  async updateSubscription(subscriptionId: string, data: Partial<CreateSubscriptionDto>): Promise<AsaasSubscription> {
    return this.request<AsaasSubscription>('PUT', `/subscriptions/${subscriptionId}`, data);
  }

  async deleteSubscription(subscriptionId: string): Promise<{ deleted: boolean; id: string }> {
    return this.request<{ deleted: boolean; id: string }>('DELETE', `/subscriptions/${subscriptionId}`);
  }

  async listSubscriptionPayments(subscriptionId: string): Promise<AsaasListResponse<AsaasPayment>> {
    return this.request<AsaasListResponse<AsaasPayment>>(
      'GET',
      `/subscriptions/${subscriptionId}/payments`,
    );
  }

  async createInstallmentPayment(params: {
    customerId: string;
    value: number;
    installmentCount: number;
    dueDate: string;
    description: string;
    externalReference: string;
    billingType?: AsaasBillingType;
  }): Promise<{ installmentId: string; payments: AsaasPayment[] }> {
    const installmentValue = Math.ceil((params.value / params.installmentCount) * 100) / 100;

    const paymentData: CreatePaymentDto = {
      customer: params.customerId,
      billingType: params.billingType || 'BOLETO',
      value: params.value,
      dueDate: params.dueDate,
      description: params.description,
      externalReference: params.externalReference,
      installmentCount: params.installmentCount,
      installmentValue,
    };

    const firstPayment = await this.createPayment(paymentData);

    const payments = await this.listPayments({
      externalReference: params.externalReference,
      limit: params.installmentCount,
    });

    return {
      installmentId: firstPayment.id.split('_')[0],
      payments: payments.data,
    };
  }

  formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  calculateDueDate(daysFromNow: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return this.formatDate(date);
  }

  mapPaymentStatus(asaasStatus: string): 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED' {
    switch (asaasStatus) {
      case 'RECEIVED':
      case 'CONFIRMED':
      case 'RECEIVED_IN_CASH':
      case 'DUNNING_RECEIVED':
        return 'PAID';
      case 'OVERDUE':
      case 'DUNNING_REQUESTED':
        return 'OVERDUE';
      case 'REFUNDED':
      case 'PARTIALLY_REFUNDED':
        return 'REFUNDED';
      case 'DELETED':
        return 'CANCELLED';
      case 'PENDING':
      case 'AWAITING_RISK_ANALYSIS':
      default:
        return 'PENDING';
    }
  }
}
