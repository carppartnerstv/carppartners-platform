export interface MockUser {
  id: string;
  email: string;
  name: string | null;
  role: 'user' | 'admin';
  stripe_customer_id: string | null;
  created_at: string;
}

export interface MockSubscription {
  plan: 'monthly' | 'annual';
  status: 'active' | 'trialing' | 'past_due' | 'canceled';
  period_end: string | null;
}

export const MOCK_USER: MockUser = {
  id: 'usr-1',
  email: 'prueba@carppartners.tv',
  name: 'Carlos Angler',
  role: 'user',
  stripe_customer_id: 'cus_mockXXXXXXXX',
  created_at: '2026-01-15T10:00:00Z',
};

export const MOCK_SUBSCRIPTION: MockSubscription = {
  plan: 'annual',
  status: 'active',
  period_end: '2027-01-15T10:00:00Z',
};

export const MOCK_ADMIN_USER: MockUser = {
  ...MOCK_USER,
  id: 'usr-admin',
  email: 'admin@carppartners.tv',
  name: 'Admin CP',
  role: 'admin',
};
