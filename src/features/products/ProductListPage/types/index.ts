// TypeScript interfaces for ProductListPage
export interface TableRow {
  type: 'item' | 'option';
  item_id: string;
  option_id?: string;
  product_name: string;
  image?: string;
  original_price?: number;
  sale_price?: number;
  status?: string;
  sales_method?: string;
  sales_status?: string;
  stock?: number;
  category?: string;
  brand?: string;
  barcode?: string;
  purchase_status?: number;
  [key: string]: any;
}

export interface Progress {
  current: number;
  total: number;
  message: string;
}

export interface SearchSuggestion {
  type: 'product' | 'barcode';
  value: string;
  display: string;
}

export interface HoveredImage {
  url: string;
  x: number;
  y: number;
}

export interface OrderData {
  item_name: string;
  option_name: string;
  quantity: number;
  barcode: string;
  option_id: string;
  _debug?: {
    cellId: string;
    itemId: string;
    original_product_name?: string;
  };
}