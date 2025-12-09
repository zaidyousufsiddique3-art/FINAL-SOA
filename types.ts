export interface Transaction {
  id: string;
  trxDate: string; // YYYY-MM-DD
  number: string;
  region: string;
  siteLocation: string;
  trxType: 'INV' | 'Payment' | 'INVOICE' | 'PAYMENT';
  originalAmount: number;
  customerName: string;
  // Optional fields that might be parsed from file but not used in manual entry
  glAgency?: string;
  note?: string;
}

export interface StatementConfig {
  operatingUnit: string;
  startDate: string;
  endDate: string;
  openingBalance: number;
  logoUrl: string | null;
}

export interface StatementHistoryItem {
  id: string;
  generatedAt: Date;
  customerName: string;
  period: string;
  fileName: string;
  blobUrl: string;
}

export const DATA_HEADERS = [
  'Trx Date',
  'Number',
  'Region',
  'Site Location',
  'Trx Type',
  'Original',
  'Customer Name'
];