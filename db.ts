import { createClient } from '@supabase/supabase-js';
import Dexie, { type Table } from 'dexie';
import { Customer, InventoryItem, Transaction, Demand } from './types';

const supabaseUrl = 'https://bcyzfmvztffqdclmxnix.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjeXpmbXZ6dGZmcWRjbG14bml4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTI5NjYsImV4cCI6MjA4NTY4ODk2Nn0.fOtK7Egc2UIJDkCzA_oLWzUMCZ2W87_V9U5zCnJY1Zs';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export class CanteenDatabase extends Dexie {
  customers!: Table<Customer>;
  inventory!: Table<InventoryItem>;
  transactions!: Table<Transaction>;
  demands!: Table<Demand>;
  settings!: Table<{ key: string; value: any }>;

  constructor() {
    super('CanteenDB_UAV_V5');
    
    // Move versioning inside constructor with explicit casting for execution stability
    (this as Dexie).version(5).stores({
      customers: '++id, uid, name',
      inventory: '++id, item_name, category',
      transactions: '++id, customer_id, timestamp, type',
      demands: '++id, customer_id, status',
      settings: 'key'
    });
  }
}

export const db = new CanteenDatabase();

export async function ensureSettings() {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'config')
      .maybeSingle();

    let activeConfig = data?.value;

    if (!activeConfig || error) {
      activeConfig = { 
        canteenName: 'Cafe UAV', 
        managerName: 'LAC Zubayer',
        managerPhone: '+8801700000000',
        adminPassword: 'admin123',
        logoUrl: 'https://images4.imagebam.com/12/4d/21/ME1ACODF_o.png',
        managerImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&h=200&auto=format&fit=crop'
      };
      
      if (error?.code !== '42501') {
        await supabase.from('settings').upsert({ key: 'config', value: activeConfig });
      }
    }

    await db.settings.put({ key: 'config', value: activeConfig });
    return activeConfig;
  } catch (err) {
    return null;
  }
}