export type Role = 'owner' | 'manager' | 'cashier' | 'technician'

export interface User {
  id: number; username: string; first_name: string; last_name: string; display_name: string
  phone: string; role: Role; is_active: boolean; allowed_sections: string[]; has_pin: boolean
  repair_commission_percent: number; cash_drawer: number | null
}

export interface ShopConfig {
  serial_label: string; device_types: string[]; brands: string[]; fault_tags: string[]
  repair_checklist: { key: string; label: string }[]; accessories: string[]; spec_templates: Record<string, string[]>
  expense_categories: string[]; default_warranty_days: number
}

export interface Shop {
  id: number; name: string; phone: string; address: string; currency: string
  invoice_footer: string; repair_terms: string; max_discount_percent: number; approve_returns: boolean
  require_shift: boolean; hidden_sections: string[]; catalog_enabled: boolean; catalog_slug: string | null
  catalog_about: string; catalog_whatsapp: string; business_type: string; onboarded: boolean
  customization: Partial<ShopConfig>; config: ShopConfig; status: 'active' | 'suspended'; plan: string
  subscription_ends_at: string | null; days_left: number | null; logo: string | null; receipt_width: '58' | '80' | 'a4'
  receipt_header: string; receipt_show_qr: boolean; receipt_show_cashier: boolean; receipt_show_warranty: boolean
}

export interface Category { id: number; name: string; products_count: number }

export interface Product {
  id: number; name: string; barcode: string; category: number | null; category_name: string | null; brand: string
  cost_price: number; sell_price: number; min_price: number; quantity: number; low_stock_threshold: number
  track_serial: boolean; is_service: boolean; warranty_days: number; specs: Record<string, string>; notes: string
  is_active: boolean; is_low_stock: boolean; created_at: string; is_used: boolean; show_in_catalog: boolean
  image: string | null
}

export interface SerialItem {
  id: number; product: number; product_name: string; serial: string; status: string; cost_price: number
  condition?: string; sold_at: string | null; created_at: string
}

export interface StockMovement {
  id: number; kind: string; kind_display: string; quantity: number; quantity_after: number; note: string; user: string
  created_at: string
}

export interface Customer {
  id: number; name: string; phone: string; national_id: string; address: string; notes: string; balance: number
  created_at: string
}

export interface Supplier {
  id: number; kind: 'supplier' | 'agent'; name: string; company: string; phone: string; address: string; notes: string; balance: number
  created_at: string
}

export interface LedgerEntry {
  id: number; amount: number; balance_after: number; description: string; ref_type: string; ref_id: number | null
  created_at: string
}

export interface InvoiceItem {
  id: number; product: number; name: string; serial: number | null; serial_number: string | null; quantity: number
  returned_quantity: number; unit_price: number; line_total: number; warranty_days: number; bundle_name: string
}

export interface Invoice {
  id: number; number: number; public_token: string; customer: number | null; customer_name: string
  customer_phone: string; subtotal: number; discount: number; bundle_discount: number; trade_in_value: number
  total: number; paid: number; remaining: number
  returned_total: number; payment_method: string; payment_method_display: string; status: string
  status_display: string; notes: string; cashier: string; items: InvoiceItem[]; created_at: string
  cost_total?: number; profit?: number; shop?: Shop
}

export interface PurchaseItem { id: number; product: number; product_name: string; quantity: number; unit_cost: number }

export interface Purchase {
  id: number; number: number; supplier: number | null; supplier_name: string | null; date: string; total: number
  paid: number; notes: string; items: PurchaseItem[]; created_at: string
}

export type RepairStatus = 'received' | 'diagnosing' | 'awaiting_approval' | 'waiting_parts' | 'in_progress' | 'ready' | 'delivered' | 'cancelled'

export interface RepairTicket {
  id: number; number: number; tracking_code: string; customer: number | null; customer_name: string
  customer_phone: string; device_type: string; brand: string; model: string; serial: string; passcode: string
  issue: string; condition_notes: string; accessories: string; status: RepairStatus; status_display: string
  technician: number | null; technician_name: string | null; estimated_cost: number; expected_date: string | null
  labor_cost: number; parts_total: number; deposit: number; paid: number; total: number; remaining: number
  warranty_days: number; delivered_at: string | null; notes: string; created_at: string
  parts?: { id: number; product: number | null; name: string; quantity: number; unit_price: number }[]
  logs?: { id: number; status: RepairStatus; status_display: string; note: string; user: string; created_at: string }[]
  parts_cost?: number; profit?: number; shop?: Shop
  pattern: string; fault_tags: string[]; checklist: Record<string, 'ok' | 'bad' | 'na'>; battery_health: number | null
  quote_amount: number | null; quote_note: string; quote_status: '' | 'pending' | 'approved' | 'rejected'
  quote_status_display: string; quote_responded_at: string | null; warranty_until: string | null; in_warranty: boolean
  is_warranty: boolean; parent: number | null; parent_number: number | null; updated_at: string
  photos?: { id: number; kind: string; kind_display: string; content_type: string; created_at: string }[]
}

export interface RepairHistoryItem {
  id: number; number: number; brand: string; model: string; serial: string; issue: string; status: RepairStatus
  status_display: string; total: number; warranty_until: string | null; is_warranty: boolean; created_at: string
  delivered_at: string | null
}

export interface InstallmentDue {
  id: number; seq: number; due_date: string; amount: number; paid_amount: number; remaining: number
  paid_at: string | null; state: 'paid' | 'overdue' | 'partial' | 'pending'
}

export interface InstallmentPlan {
  id: number; number: number; customer: number; customer_name: string; customer_phone: string
  invoice: number | null; invoice_number: number | null; title: string; total_price: number; down_payment: number
  interest_rate: number; months: number; start_date: string; financed_amount: number; total_due: number
  paid_amount: number; remaining: number; guarantor_name: string; guarantor_phone: string; status: string
  status_display: string; notes: string; next_due: InstallmentDue | null; overdue_amount: number; created_at: string
  dues?: InstallmentDue[]; payments?: { id: number; amount: number; note: string; user: string; created_at: string }[]
}

export interface Wallet {
  id: number; name: string; provider: string; provider_display: string; phone_number: string; balance: number
  daily_limit: number; monthly_limit: number; is_active: boolean; usage: { today: number; month: number }
}

export interface WalletTransaction {
  id: number; wallet: number; wallet_name: string; kind: string; kind_display: string; amount: number
  commission: number; counterparty: string; reference: string; note: string; balance_after: number; user: string
  agent: number | null; agent_name: string | null; cost: number | null
  created_at: string
}

export interface Expense {
  id: number; kind: 'expense' | 'withdrawal'; kind_display: string; category: string; amount: number; date: string
  note: string; user: string; created_at: string
}

export interface CashEntry {
  drawer: number | null; drawer_name: string
  id: number; amount: number; kind: string; kind_display: string; description: string; user: string
  created_at: string
}

export interface PeriodSummary {
  from: string; to: string; sales_count: number; sales_total: number; returns_total: number; net_sales: number
  sales_profit: number; repairs_count: number; repairs_total: number; repair_profit: number
  wallet_commissions: number; installments_collected: number; expenses: number; withdrawals: number
  gross_profit: number; net_profit: number
}

export interface CashDrawer {
  id: number; name: string; is_default: boolean; is_active: boolean; balance: number
  open_shift: { id: number; number: number; opened_by: string } | null; users: string[]
}

export interface CashBalance { balance: number; my_drawer: number; drawers: { id: number; name: string; balance: number }[] }

export interface Shift {
  drawer: number | null; drawer_name: string
  id: number; number: number; status: 'open' | 'closed'; status_display: string; opened_at: string
  closed_at: string | null; opened_by: string; closed_by_name: string; opening_cash: number; system_opening: number
  expected_cash: number | null; counted_cash: number | null; difference: number | null; notes: string
  report?: { by_kind: { kind: string; label: string; total: number }[]; cash_in: number; cash_out: number
    movement: number; expected_cash: number; entries_count: number }
}

export interface Approval {
  id: number; kind: string; kind_display: string; status: 'pending' | 'approved' | 'rejected' | 'failed'
  status_display: string; summary: string; target_id: number | null; payload: Record<string, unknown>
  requested_by: string; decided_by_name: string; decided_at: string | null; decision_note: string
  result: Record<string, unknown>; created_at: string
}

export interface AuditEntry {
  id: number; user: number | null; user_name: string; method: string; path: string; status_code: number
  action: string; resource: string; object_id: string; description: string; payload: Record<string, unknown>
  ip: string | null; created_at: string
}

export interface BundleItem {
  id?: number; product: number; product_name?: string; quantity: number; sell_price?: number; track_serial?: boolean
  available?: number
}

export interface Bundle {
  id: number; name: string; barcode: string; price: number; description: string; is_active: boolean
  items: BundleItem[]; components_total: number; created_at: string
}

export interface UsedDevice {
  id: number; number: number; source: 'cash' | 'trade_in'; source_display: string; customer: number
  customer_name: string; customer_phone: string; customer_national_id: string; product: number
  product_display: string; serial_number: string; serial_status: string; condition: string; accessories: string
  price: number; invoice: number | null; invoice_number: number | null; notes: string; user: string; created_at: string
}

export interface SupplierReturn {
  id: number; number: number; supplier: number; supplier_name: string; total: number; refund_method: string
  refund_method_display: string; reason: string; created_at: string
  items: { id: number; product: number; product_name: string; serial_number: string | null; quantity: number; unit_cost: number }[]
}

export interface CatalogOrder {
  id: number; number: number; customer_name: string; customer_phone: string; address: string; notes: string
  items: { product: number; name: string; quantity: number; unit_price: number }[]; total: number
  status: 'new' | 'confirmed' | 'completed' | 'cancelled'; status_display: string; invoice: number | null
  invoice_number: number | null; created_at: string
}

export interface CustomerDocument {
  id: number; kind: string; kind_display: string; content_type: string; original_name: string; note: string
  user: string; created_at: string
}
