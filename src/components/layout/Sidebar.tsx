import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Building2,
  Package,
  DollarSign,
  Settings,
  ChevronDown,
  ChevronRight,
  Home,
  Users,
  CreditCard,
  FileSpreadsheet,
  ShoppingCart,
  Receipt,
  FileText,
  Truck,
  History,
  BarChart3,
  X,
  Shield,
} from 'lucide-react';
import { BiolegendLogo } from '@/components/ui/biolegend-logo';
import { useCurrentCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { hasFeature } from '@/utils/rolePermissions';
import type { FeatureKey, UserRole } from '@/utils/rolePermissions';

interface SidebarItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  featureKey?: FeatureKey;
  children?: (SidebarItem & { featureKey: FeatureKey })[];
}

const sidebarItems: SidebarItem[] = [
  {
    title: 'Dashboard',
    icon: Home,
    href: '/',
    featureKey: 'dashboard',
  },
  {
    title: 'Customers',
    icon: Users,
    href: '/customers',
    featureKey: 'customers',
  },
  {
    title: 'Products',
    icon: Package,
    href: '/inventory',
    featureKey: 'products',
  },
  {
    title: 'Sales',
    icon: ShoppingCart,
    children: [
      { title: 'Quotations', icon: FileText, href: '/quotations', featureKey: 'quotations' },
      { title: 'Invoices', icon: Receipt, href: '/invoices', featureKey: 'invoices' },
      { title: 'Delivery Notes', icon: Truck, href: '/delivery-notes', featureKey: 'delivery-notes' },
      { title: 'Cash Receipts', icon: Receipt, href: '/cash-receipts', featureKey: 'cash-receipts' },
    ],
  },
  {
    title: 'BOQs',
    icon: FileSpreadsheet,
    children: [
      { title: 'Standard BOQs', icon: FileSpreadsheet, href: '/boqs', featureKey: 'boqs' },
      { title: 'Fixed BOQ', icon: FileSpreadsheet, href: '/fixed-boq', featureKey: 'boqs' },
      { title: 'Hierarchical BOQ', icon: FileSpreadsheet, href: '/boq/hierarchical', featureKey: 'boqs' },
      { title: 'LCL Template', icon: FileSpreadsheet, href: '/lcl-template', featureKey: 'boqs' },
      { title: 'LCL BOQ List', icon: FileSpreadsheet, href: '/lcl-boq-list', featureKey: 'boqs' },
    ],
  },
  {
    title: 'Payments',
    icon: DollarSign,
    featureKey: 'payments',
    children: [
      { title: 'Payments', icon: DollarSign, href: '/payments', featureKey: 'payments' },
    ],
  },
  {
    title: 'Reports',
    icon: BarChart3,
    children: [
      { title: 'Dashboard', icon: BarChart3, href: '/reports/dashboard' }
    ]
  },
  {
    title: 'Audit Logs',
    icon: History,
    href: '/audit-logs',
    featureKey: 'audit-logs',
  },
  {
    title: 'Reports',
    icon: BarChart3,
    children: [
      { title: 'Overview', icon: BarChart3, href: '/reports', featureKey: 'reports-overview' },
      { title: 'Sales Reports', icon: BarChart3, href: '/reports/sales', featureKey: 'reports-sales' },
      { title: 'Inventory Reports', icon: Package, href: '/reports/inventory', featureKey: 'reports-inventory' },
      { title: 'Statement of Accounts', icon: FileText, href: '/reports/statements', featureKey: 'reports-statements' },
      { title: 'Customer Statements', icon: FileText, href: '/reports/customer-statements', featureKey: 'reports-statements' },
    ],
  },
  {
    title: 'Settings',
    icon: Settings,
    children: [
      { title: 'Company Settings', icon: Building2, href: '/settings/company', featureKey: 'settings-company' },
      { title: 'User Management', icon: Users, href: '/settings/users', featureKey: 'settings-users' },
      { title: 'Permissions', icon: Shield, href: '/settings/permissions', featureKey: 'manage-permissions' },
    ],
  },
];

interface SidebarProps {
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isMobile = false, isOpen = true, onClose = () => {} }: SidebarProps) {
  const location = useLocation();
  const { currentCompany } = useCurrentCompany();
  const { profile, permissions } = useAuth();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const role = (profile?.role || 'user') as UserRole;

  const filteredSidebarItems = useMemo(() => {
    return sidebarItems.filter(item => {
      if (item.children) {
        return item.children.some(child => hasFeature(role, child.featureKey, permissions));
      }
      return item.featureKey ? hasFeature(role, item.featureKey, permissions) : true;
    });
  }, [role, permissions]);

  useEffect(() => {
    console.log('🔍 Sidebar - role:', role);
    console.log('📋 Sidebar filtered items:', filteredSidebarItems.map(item => item.title));
  }, [role, filteredSidebarItems]);

  const toggleExpanded = (title: string) => {
    setExpandedItems(prev =>
      prev.includes(title)
        ? prev.filter(item => item !== title)
        : [...prev, title]
    );
  };

  const isItemActive = (href?: string) => {
    if (!href) return false;
    return location.pathname === href;
  };

  const isParentActive = (children?: SidebarItem[]) => {
    if (!children) return false;
    return children.some(child => isItemActive(child.href));
  };

  const renderSidebarItem = (item: SidebarItem) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.includes(item.title);
    const isActive = isItemActive(item.href);
    const isChildActive = isParentActive(item.children);

    if (hasChildren) {
      const visibleChildren = item.children!.filter(
        child => hasFeature(role, (child as any).featureKey, permissions)
      );
      if (visibleChildren.length === 0) return null;

      return (
        <div key={item.title} className="space-y-1">
          <button
            onClick={() => toggleExpanded(item.title)}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-smooth hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              (isChildActive || isExpanded)
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground"
            )}
          >
            <div className="flex items-center space-x-3">
              <item.icon className="h-5 w-5" />
              <span>{item.title}</span>
            </div>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          {isExpanded && (
            <div className="pl-4 space-y-1">
              {visibleChildren.map(child => (
                <Link
                  key={child.title}
                  to={child.href!}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2 text-sm rounded-lg transition-smooth hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isItemActive(child.href)
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground"
                  )}
                >
                  <child.icon className="h-4 w-4" />
                  <span>{child.title}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.title}
        to={item.href!}
        className={cn(
          "flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-lg transition-smooth hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground"
        )}
      >
        <item.icon className="h-5 w-5" />
        <span>{item.title}</span>
      </Link>
    );
  };

  const sidebarContent = (
    <nav className="flex-1 space-y-2 p-4 custom-scrollbar overflow-y-auto">
      {filteredSidebarItems.map(item => {
        const rendered = renderSidebarItem(item);
        if (!rendered) return null;
        return <div key={item.title}>{rendered}</div>;
      })}
    </nav>
  );

  const companyFooter = (
    <div className="border-t border-sidebar-border p-4">
      <div className="space-y-2">
        <div className="flex items-center space-x-3 px-3 py-2 text-sm text-sidebar-foreground">
          <Building2 className="h-4 w-4 text-sidebar-primary" />
          <div className="min-w-0">
            <div className="font-medium truncate">{currentCompany?.name || 'Company'}</div>
            <div className="text-xs text-sidebar-foreground/60 truncate">{currentCompany?.city || currentCompany?.country || 'Management'}</div>
          </div>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border transition-transform duration-300 ease-in-out transform",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-6">
          <BiolegendLogo size="lg" showText={true} className="text-sidebar-foreground" />
          <Button variant="ghost" size="icon" onClick={onClose} className="md:hidden">
            <X className="h-5 w-5" />
          </Button>
        </div>
        {sidebarContent}
        {companyFooter}
      </div>
    );
  }

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <BiolegendLogo size="lg" showText={true} className="text-sidebar-foreground" />
      </div>
      {sidebarContent}
      {companyFooter}
    </div>
  );
}
