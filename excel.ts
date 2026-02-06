import * as XLSX from 'xlsx';
import { Customer } from './types';

export const parseExcelToCustomers = (file: File): Promise<Omit<Customer, 'id'>[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) return reject("Read Error");

        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet) as any[];

        const customers: Omit<Customer, 'id'>[] = json.map(row => {
          const aliases = {
            uid: ['uid', 'id', 'sid', 'serial', 'memberid', 'userid'],
            name: ['name', 'fullname', 'membername', 'customer'],
            phone: ['phone', 'mobile', 'whatsapp', 'contact'],
            email: ['email', 'mail'],
            baki: ['total_baki', 'baki', 'due', 'balance', 'outstanding']
          };

          const get = (f: string[]) => {
            const k = Object.keys(row).find(key => f.some(a => key.toLowerCase().replace(/\s/g, '') === a));
            return k ? row[k] : undefined;
          };

          return {
            uid: String(get(aliases.uid) || '').trim(),
            name: String(get(aliases.name) || 'Unknown').trim(),
            phone: String(get(aliases.phone) || '').trim(),
            email: String(get(aliases.email) || '').trim(),
            total_baki: parseFloat(String(get(aliases.baki) || '0')) || 0
          };
        }).filter(c => c.uid !== '');

        resolve(customers);
      } catch (err) { reject(err); }
    };
    reader.readAsArrayBuffer(file);
  });
};