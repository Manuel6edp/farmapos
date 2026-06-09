export type Database = {
  public: {
    Tables: {
      categories: {
        Row: Category
        Insert: Omit<Category, 'id' | 'created_at'>
        Update: Partial<Omit<Category, 'id'>>
      }
      products: {
        Row: Product
        Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Product, 'id'>>
      }
      inventory: {
        Row: Inventory
        Insert: Omit<Inventory, 'id' | 'updated_at'>
        Update: Partial<Omit<Inventory, 'id'>>
      }
      customers: {
        Row: Customer
        Insert: Omit<Customer, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Customer, 'id'>>
      }
      sales: {
        Row: Sale
        Insert: Omit<Sale, 'id' | 'created_at'>
        Update: Partial<Omit<Sale, 'id'>>
      }
      sale_items: {
        Row: SaleItem
        Insert: Omit<SaleItem, 'id'>
        Update: Partial<Omit<SaleItem, 'id'>>
      }
      inventory_movements: {
        Row: InventoryMovement
        Insert: Omit<InventoryMovement, 'id' | 'created_at'>
        Update: Partial<Omit<InventoryMovement, 'id'>>
      }
      customer_payments: {
        Row: CustomerPayment
        Insert: Omit<CustomerPayment, 'id' | 'created_at'>
        Update: Partial<Omit<CustomerPayment, 'id'>>
      }
    }
  }
}

export interface Category {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface Product {
  id: string
  name: string
  description: string | null
  barcode: string | null
  category_id: string | null
  price: number
  cost: number
  unit: string
  requires_prescription: boolean
  active: boolean
  created_at: string
  updated_at: string
}

export interface ProductWithCategory extends Product {
  categories: Category | null
}

export interface Inventory {
  id: string
  product_id: string
  quantity: number
  min_stock: number
  lot_number: string | null
  expiry_date: string | null
  updated_at: string
}

export interface InventoryWithProduct extends Inventory {
  products: Product
}

export interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  document_number: string | null
  credit_limit: number
  current_balance: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Sale {
  id: string
  customer_id: string | null
  total: number
  discount: number
  tax: number
  payment_method: string
  payment_status: string
  notes: string | null
  created_at: string
}

export interface SaleWithCustomer extends Sale {
  customers: Customer | null
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  quantity: number
  unit_price: number
  discount: number
  subtotal: number
}

export interface SaleItemWithProduct extends SaleItem {
  products: Product
}

export interface InventoryMovement {
  id: string
  product_id: string
  type: 'entrada' | 'salida' | 'ajuste'
  quantity: number
  reason: string | null
  reference_id: string | null
  created_at: string
}

export interface CustomerPayment {
  id: string
  customer_id: string
  amount: number
  payment_method: string
  reference: string | null
  notes: string | null
  created_at: string
}

export interface CartItem {
  product: Product
  quantity: number
  unit_price: number
  discount: number
  subtotal: number
}
