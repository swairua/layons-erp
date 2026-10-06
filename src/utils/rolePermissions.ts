export type UserRole = 'admin' | 'accountant' | 'stock_manager' | 'user' | 'sales';

export type FeatureKey =
  | 'dashboard'
  | 'customers'
  | 'products'
  | 'quotations'
  | 'invoices'
  | 'delivery-notes'
  | 'cash-receipts'
  | 'boqs'
  | 'payments'
  | 'audit-logs'
  | 'reports-overview'
  | 'reports-sales'
  | 'reports-inventory'
  | 'reports-statements'
  | 'settings-company'
  | 'settings-users'
  | 'manage-permissions';

const ROLE_PERMISSIONS: Record<UserRole, FeatureKey[]> = {
  admin: [
    'dashboard', 'customers', 'products', 'quotations', 'invoices',
    'delivery-notes', 'cash-receipts', 'boqs', 'payments', 'audit-logs',
    'reports-overview', 'reports-sales', 'reports-inventory', 'reports-statements',
    'settings-company', 'settings-users', 'manage-permissions',
  ],
  accountant: [
    'dashboard', 'customers', 'invoices', 'cash-receipts', 'payments',
    'reports-overview', 'reports-sales', 'reports-statements',
  ],
  stock_manager: [
    'dashboard', 'customers', 'products', 'delivery-notes',
    'reports-overview', 'reports-inventory',
  ],
  user: [
    'dashboard', 'customers', 'quotations', 'boqs',
  ],
  sales: [
    'dashboard', 'customers', 'products', 'quotations', 'invoices',
    'delivery-notes', 'cash-receipts', 'boqs',
    'reports-overview', 'reports-sales', 'reports-inventory', 'reports-statements',
  ],
};

export function hasFeature(
  role: UserRole | null | undefined,
  feature: FeatureKey,
  overrides?: Record<string, boolean | null>
): boolean {
  if (overrides && feature in overrides) return overrides[feature] === true;
  if (!role) return false;
  const features = ROLE_PERMISSIONS[role];
  return features ? features.includes(feature) : false;
}

export function getAllowedFeatures(role: UserRole | null | undefined): FeatureKey[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role] || [];
}

// Every permission key the UI can display, across all roles.
export const ALL_FEATURE_KEYS: FeatureKey[] = [
  ...new Set(Object.values(ROLE_PERMISSIONS).flat()),
];
