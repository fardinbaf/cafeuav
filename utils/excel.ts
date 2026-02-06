
import * as XLSX from 'xlsx';
import { Customer } from '../types';

export const parseExcelToCustomers = (file: File): Promise<Omit<Customer, 'id'>[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) return reject("No data read from file.");

        // Read as array for better cross-platform compatibility
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet) as any[];

        const customers: Omit<Customer, 'id'>[] = json.map(row => {
          // Define possible header aliases for fuzzy matching
          const aliases = {
            uid: ['uid', 'id', 'student id', 'member id', 'member_id', 'user id', 'serial', 'sid'],
            name: ['name', 'full name', 'fullname', 'customer name', 'member name', 'member'],
            phone: ['phone', 'mobile', 'whatsapp', 'contact', 'phone number', 'cell', 'mob'],
            email: ['email', 'mail', 'email address'],
            total_baki: ['total_baki', 'baki', 'due', 'balance', 'outstanding', 'amount', 'debt']
          };

          // Helper to find value regardless of exact header casing or spacing
          const getVal = (fieldAliases: string[]) => {
            const key = Object.keys(row).find(k => 
              fieldAliases.some(alias => 
                k.toLowerCase().replace(/[\s_-]/g, '') === alias.toLowerCase().replace(/[\s_-]/g, '')
              )
            );
            return key ? row[key] : undefined;
          };

          const rawUid = getVal(aliases.uid);
          const uid = rawUid !== undefined ? String(rawUid).trim() : '';
          const name = String(getVal(aliases.name) || 'Unknown').trim();
          const phoneInput = String(getVal(aliases.phone) || '').trim();
          const email = String(getVal(aliases.email) || '').trim();
          const baki = parseFloat(String(getVal(aliases.total_baki) || '0')) || 0;

          // Simple phone formatting for Bangladesh
          let phone = phoneInput;
          if (phone && !phone.startsWith('+')) {
            const cleanPhone = phone.replace(/^0/, '');
            phone = `+880${cleanPhone}`;
          }

          return {
            uid,
            name,
            phone,
            email,
            total_baki: baki
          };
        }).filter(c => c.uid !== '');

        resolve(customers);
      } catch (error) {
        console.error("Excel processing error:", error);
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};
