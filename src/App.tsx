import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { Loading } from './components/ui'
import { useAuth } from './lib/auth'
import Approvals from './pages/Approvals'
import AuditLog from './pages/AuditLog'
import Bundles from './pages/Bundles'
import OfflineSales from './pages/OfflineSales'
import SetupWizard from './pages/Setup'
import { BlockedScreen, PlatformHome, PlatformLayout, PlatformShopDetail } from './pages/Platform'
import Cash from './pages/Cash'
import CatalogOrders from './pages/CatalogOrders'
import PublicCatalog from './pages/PublicCatalog'
import Shifts from './pages/Shifts'
import SupplierReturns from './pages/SupplierReturns'
import UsedDevices from './pages/UsedDevices'
import { CustomerDetail, SupplierDetail } from './pages/ContactDetail'
import { Agents, Customers, Suppliers } from './pages/Contacts'
import Dashboard from './pages/Dashboard'
import Expenses from './pages/Expenses'
import InstallmentDetail from './pages/InstallmentDetail'
import Installments from './pages/Installments'
import InvoiceDetail from './pages/InvoiceDetail'
import Invoices from './pages/Invoices'
import { Login, Register } from './pages/Auth'
import More from './pages/More'
import POS from './pages/POS'
import ProductDetail from './pages/ProductDetail'
import ProductForm from './pages/ProductForm'
import Products from './pages/Products'
import { PublicInvoice, PublicRepair } from './pages/Public'
import PurchaseForm from './pages/PurchaseForm'
import Purchases from './pages/Purchases'
import RepairDetail from './pages/RepairDetail'
import RepairForm from './pages/RepairForm'
import RepairsReport from './pages/RepairsReport'
import Repairs from './pages/Repairs'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import WalletDetail from './pages/WalletDetail'
import Wallets from './pages/Wallets'

export default function App() {
  const { user, loading, platformAdmin, blocked, shop, isManager } = useAuth()

  return (
    <Routes>
      <Route path="/i/:token" element={<PublicInvoice />} />
      <Route path="/t/:code" element={<PublicRepair />} />
      <Route path="/s/:slug" element={<PublicCatalog />} />
      {loading ? (
        <Route path="*" element={<Loading />} />
      ) : user && platformAdmin ? (
        <Route element={<PlatformLayout />}>
          <Route path="platform" element={<PlatformHome />} />
          <Route path="platform/shops/:id" element={<PlatformShopDetail />} />
          <Route path="*" element={<Navigate to="/platform" replace />} />
        </Route>
      ) : user && blocked ? (
        <Route path="*" element={<BlockedScreen />} />
      ) : user && shop && !shop.onboarded && isManager ? (
        <Route path="*" element={<SetupWizard />} />
      ) : !user ? (
        <>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      ) : (
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="pos" element={<POS />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="invoices/:id" element={<InvoiceDetail />} />
          <Route path="products" element={<Products />} />
          <Route path="products/new" element={<ProductForm />} />
          <Route path="products/:id" element={<ProductDetail />} />
          <Route path="products/:id/edit" element={<ProductForm />} />
          <Route path="purchases" element={<Purchases />} />
          <Route path="purchases/new" element={<PurchaseForm />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="suppliers/:id" element={<SupplierDetail />} />
          <Route path="agents" element={<Agents />} />
          <Route path="repairs" element={<Repairs />} />
          <Route path="repairs/new" element={<RepairForm />} />
          <Route path="repairs/report" element={<RepairsReport />} />
          <Route path="repairs/:id" element={<RepairDetail />} />
          <Route path="installments" element={<Installments />} />
          <Route path="installments/:id" element={<InstallmentDetail />} />
          <Route path="wallets" element={<Wallets />} />
          <Route path="wallets/:id" element={<WalletDetail />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="cash" element={<Cash />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="shifts" element={<Shifts />} />
          <Route path="offline-sales" element={<OfflineSales />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="audit" element={<AuditLog />} />
          <Route path="bundles" element={<Bundles />} />
          <Route path="used-devices" element={<UsedDevices />} />
          <Route path="supplier-returns" element={<SupplierReturns />} />
          <Route path="catalog-orders" element={<CatalogOrders />} />
          <Route path="more" element={<More />} />
          <Route path="login" element={<Navigate to="/" replace />} />
          <Route path="register" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      )}
    </Routes>
  )
}
