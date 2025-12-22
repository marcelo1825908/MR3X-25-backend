export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  mobilePhone?: string;
  cpfCnpj: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  city?: string;
  state?: string;
  country?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
  additionalEmails?: string;
  municipalInscription?: string;
  stateInscription?: string;
  observations?: string;
  groupName?: string;
  deleted?: boolean;
  dateCreated?: string;
}

export interface CreateCustomerDto {
  name: string;
  email: string;
  phone?: string;
  mobilePhone?: string;
  cpfCnpj: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  city?: string;
  state?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
  additionalEmails?: string;
  observations?: string;
  groupName?: string;
}

export type AsaasBillingType = 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED';
export type AsaasPaymentStatus =
  | 'PENDING'
  | 'RECEIVED'
  | 'CONFIRMED'
  | 'OVERDUE'
  | 'REFUNDED'
  | 'RECEIVED_IN_CASH'
  | 'REFUND_REQUESTED'
  | 'REFUND_IN_PROGRESS'
  | 'CHARGEBACK_REQUESTED'
  | 'CHARGEBACK_DISPUTE'
  | 'AWAITING_CHARGEBACK_REVERSAL'
  | 'DUNNING_REQUESTED'
  | 'DUNNING_RECEIVED'
  | 'AWAITING_RISK_ANALYSIS';

export interface AsaasPayment {
  id: string;
  dateCreated: string;
  customer: string;
  paymentLink?: string;
  value: number;
  netValue: number;
  originalValue?: number;
  interestValue?: number;
  description?: string;
  billingType: AsaasBillingType;
  confirmedDate?: string;
  pixTransaction?: string;
  status: AsaasPaymentStatus;
  dueDate: string;
  originalDueDate?: string;
  paymentDate?: string;
  clientPaymentDate?: string;
  installmentNumber?: number;
  invoiceUrl?: string;
  invoiceNumber?: string;
  externalReference?: string;
  deleted?: boolean;
  anticipated?: boolean;
  anticipable?: boolean;
  creditDate?: string;
  estimatedCreditDate?: string;
  transactionReceiptUrl?: string;
  nossoNumero?: string;
  bankSlipUrl?: string;
  lastInvoiceViewedDate?: string;
  lastBankSlipViewedDate?: string;
  postalService?: boolean;
  custody?: string;
  refunds?: any[];
}

export interface CreatePaymentDto {
  customer: string;
  customerCpfCnpj?: string;
  billingType: AsaasBillingType;
  value: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
  installmentCount?: number;
  installmentValue?: number;
  discount?: {
    value: number;
    dueDateLimitDays: number;
    type: 'FIXED' | 'PERCENTAGE';
  };
  interest?: {
    value: number;
  };
  fine?: {
    value: number;
    type: 'FIXED' | 'PERCENTAGE';
  };
  postalService?: boolean;
  split?: AsaasSplit[];
}

export interface AsaasSplit {
  walletId: string;
  fixedValue?: number;
  percentualValue?: number;
  totalFixedValue?: number;
}

export interface AsaasPixQrCode {
  encodedImage: string;
  payload: string;
  expirationDate: string;
}

export type AsaasWebhookEvent =
  | 'PAYMENT_CREATED'
  | 'PAYMENT_AWAITING_RISK_ANALYSIS'
  | 'PAYMENT_APPROVED_BY_RISK_ANALYSIS'
  | 'PAYMENT_REPROVED_BY_RISK_ANALYSIS'
  | 'PAYMENT_UPDATED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED'
  | 'PAYMENT_ANTICIPATED'
  | 'PAYMENT_OVERDUE'
  | 'PAYMENT_DELETED'
  | 'PAYMENT_RESTORED'
  | 'PAYMENT_REFUNDED'
  | 'PAYMENT_PARTIALLY_REFUNDED'
  | 'PAYMENT_REFUND_IN_PROGRESS'
  | 'PAYMENT_RECEIVED_IN_CASH_UNDONE'
  | 'PAYMENT_CHARGEBACK_REQUESTED'
  | 'PAYMENT_CHARGEBACK_DISPUTE'
  | 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL'
  | 'PAYMENT_DUNNING_RECEIVED'
  | 'PAYMENT_DUNNING_REQUESTED'
  | 'PAYMENT_BANK_SLIP_VIEWED'
  | 'PAYMENT_CHECKOUT_VIEWED';

export interface AsaasWebhookPayload {
  event: AsaasWebhookEvent;
  payment: AsaasPayment;
}

export interface AsaasSubscription {
  id: string;
  dateCreated: string;
  customer: string;
  paymentLink?: string;
  billingType: AsaasBillingType;
  value: number;
  nextDueDate: string;
  cycle: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'BIMONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY';
  description?: string;
  endDate?: string;
  maxPayments?: number;
  status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  externalReference?: string;
  deleted?: boolean;
}

export interface CreateSubscriptionDto {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  nextDueDate: string;
  cycle: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'BIMONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY';
  description?: string;
  endDate?: string;
  maxPayments?: number;
  externalReference?: string;
  discount?: {
    value: number;
    dueDateLimitDays: number;
    type: 'FIXED' | 'PERCENTAGE';
  };
  interest?: {
    value: number;
  };
  fine?: {
    value: number;
    type: 'FIXED' | 'PERCENTAGE';
  };
  split?: AsaasSplit[];
}

export interface AsaasInstallment {
  id: string;
  value: number;
  netValue: number;
  paymentValue: number;
  installmentCount: number;
  billingType: AsaasBillingType;
  paymentDate?: string;
  description?: string;
  externalReference?: string;
  status: 'ACTIVE' | 'PARTIALLY_PAID' | 'PAID';
  customer: string;
  deleted?: boolean;
  dateCreated: string;
}

export interface AsaasListResponse<T> {
  object: string;
  hasMore: boolean;
  totalCount: number;
  limit: number;
  offset: number;
  data: T[];
}

export interface AsaasError {
  errors: Array<{
    code: string;
    description: string;
  }>;
}

export interface PaymentCreationResult {
  success: boolean;
  paymentId?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  pixQrCode?: string;
  pixCopyPaste?: string;
  barcode?: string;
  digitableLine?: string;
  error?: string;
}

export interface CustomerSyncResult {
  success: boolean;
  customerId?: string;
  error?: string;
}
