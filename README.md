
# Cafe UAV - Elite Canteen Management

A high-performance, offline-first Progressive Web App (PWA) designed for **LAC Zubayer**.

## 🚀 Setup Instructions

### 1. Supabase Initialization
- Create a new project on [Supabase](https://supabase.com).
- Copy the entire content of `supabase_schema.sql` and run it in the **SQL Editor** of your Supabase dashboard.
- This will set up all tables, RLS security policies, and the **Auto-Sync Balance** trigger.

### 2. Connection
- Replace the `supabaseUrl` and `supabaseAnonKey` in `db.ts` with your project credentials found under Project Settings > API.

### 3. Key Features
- **Member Registry**: Excel import/export with WhatsApp contact integration.
- **Auto-Balance**: Transactions automatically update member "Total Baki" via database triggers.
- **Pre-Order Node**: 10:30 AM cutoff system for member meal requests.
- **Matrix Reporting**: Professional Bengali-language monthly audit spreadsheets.

---
*Created for the Elite Management of Cafe UAV*
