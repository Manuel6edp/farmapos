import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { Layout } from './components/Layout'
import { PosPage } from './pages/pos/PosPage'
import { ProductsPage } from './pages/products/ProductsPage'
import { InventoryPage } from './pages/inventory/InventoryPage'
import { CustomersPage } from './pages/customers/CustomersPage'
import { ReportsPage } from './pages/reports/ReportsPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<PosPage />} />
            <Route path="/productos" element={<ProductsPage />} />
            <Route path="/inventario" element={<InventoryPage />} />
            <Route path="/clientes" element={<CustomersPage />} />
            <Route path="/reportes" element={<ReportsPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
      <Toaster position="top-right" />
    </QueryClientProvider>
  )
}
