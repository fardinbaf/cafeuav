export enum PaymentType {
  CASH = 'Cash',
  UCB = 'UCB',
  BAKI = 'Baki'
}

export type TransactionType = 'sale' | 'payment';

export interface Customer {
  id?: number;
  uid: string;
  name: string;
  phone: string;
  total_baki: number;
  email: string;
}

export interface InventoryItem {
  id?: number;
  item_name: string;
  price: number;
  stock_quantity: number;
  category: string;
  image_url?: string;
}

export interface TransactionItem {
  item_id: number;
  item_name: string;
  quantity: number;
  price: number;
}

export interface Transaction {
  id?: number;
  customer_id?: number;
  items: TransactionItem[];
  total_amount: number;
  payment_type: PaymentType;
  timestamp: number;
  type?: TransactionType;
  note?: string;
}

export interface Demand {
  id?: number;
  customer_id: number;
  customer_name: string;
  item_id: number;
  item_name: string;
  timestamp: number;
  status: 'pending' | 'fulfilled' | 'cancelled';
}

export interface Settings {
  canteenName: string;
  managerName: string;
  managerPhone: string;
  adminPassword?: string;
  logoUrl?: string;
  managerImageUrl?: string;
}