import api from './api';

export interface BundlePlan {
  id: string;
  bundle_id: string;
  card_count: number;
  price: number;
}

export interface CardCategory {
  name: string;
  theme_color: string;
}

export interface StoreCard {
  id: string;
  name: string;
  power_description: string;
  card_type: string;
  card_categories?: CardCategory;
}

export interface CardBundle {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  bundle_plans?: BundlePlan[];
  bundle_cards?: { card_id: string; cards: StoreCard }[];
  is_active: boolean;
}

export interface PurchaseRecord {
  id: string;
  user_id: string;
  bundle_id: string;
  plan_id: string;
  transaction_id: string;
  amount_paid: number;
  currency: string;
  status: string;
  created_at: string;
  store_product_id: string;
  card_bundle?: { name: string };
}

export const fetchStoreBundles = async (): Promise<CardBundle[]> => {
  const response = await api.get('/store/bundles');
  // Handle different potential backend data formats
  return response.data.data.bundles || response.data.data || [];
};

export const fetchStoreBundleById = async (bundleId: string): Promise<CardBundle> => {
  const response = await api.get(`/store/bundles/${bundleId}`);
  return response.data.data.bundle || response.data.data;
};

export const fetchPurchaseHistory = async (): Promise<PurchaseRecord[]> => {
  const response = await api.get('/store/purchase/history');
  return response.data.data.purchases || response.data.data || [];
};
