import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useDashboardStats } from '@/hooks/useDatabase';
import { useCurrentCompanyId } from '@/contexts/CompanyContext';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3, Package, FileText, TrendingUp, TrendingDown,
  DollarSign, AlertTriangle, CheckCircle, ArrowRight, Receipt, Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const reportLinks = [
  {
    title: 'Sales Reports',
    description: 'Revenue trends, product performance, customer analysis, and growth metrics',
    icon: BarChart3,
    href: '/reports/sales',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  {
    title: 'Inventory Reports',
    description: 'Stock levels, movement history, turnover analysis, and valuation',
    icon: Package,
    href: '/reports/inventory',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  {
    title: 'Statement of Accounts',
    description: 'Customer aging analysis, outstanding balances, and payment history',
    icon: FileText,
    href: '/reports/statements',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
];

function StatCard({
  title, value, change, changeType, icon: Icon, alert, loading,
}: {
  title: string;
  value?: string;
  change?: string;
  changeType?: 'increase' | 'decrease';
  icon: React.ComponentType<{ className?: string }>;
  alert?: boolean;
  loading?: boolean;
}) {
  return (
    <Card className={cn('shadow-card', alert && 'border-l-4 border-l-warning')}>
      <CardHeader className="flex min-w-0 flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="min-w-0 text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={cn('h-4 w-4', alert ? 'text-warning' : 'text-muted-foreground')} />
      </CardHeader>
      <CardContent className="min-w-0">
        {loading ? (
          <Skeleton className="mb-2 h-8 w-32 max-w-full" />
        ) : (
          <div className="break-words text-xl font-bold sm:text-2xl">{value || 'Ksh 0'}</div>
        )}
        {change && (
          <div className="flex items-center text-xs text-muted-foreground mt-1">
            {changeType === 'increase' && <TrendingUp className="mr-1 h-3 w-3 text-success" />}
            {changeType === 'decrease' && <TrendingDown className="mr-1 h-3 w-3 text-destructive" />}
            <span className={cn(changeType === 'increase' && 'text-success', changeType === 'decrease' && 'text-destructive')}>
              {change}
            </span>
            <span className="ml-1">from last month</span>
          </div>
        )}
        {alert && (
          <div className="flex items-center text-xs text-warning mt-1">
            <AlertTriangle className="mr-1 h-3 w-3" />
            <span>Requires attention</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="break-words text-sm text-muted-foreground">{label}</p>
        <p className="break-words text-base font-semibold sm:text-lg">{value}</p>
      </div>
    </div>
  );
}

export default function ReportsOverview() {
  const navigate = useNavigate();
  const companyId = useCurrentCompanyId();
  const { data: stats, isLoading } = useDashboardStats(companyId);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  const outstanding = stats?.outstandingAmount || 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Reports</h1>
        <p className="text-muted-foreground mt-1">Financial overview and detailed business reports</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats?.totalRevenue || 0)}
          icon={DollarSign}
          loading={isLoading}
        />
        <StatCard
          title="Outstanding Amount"
          value={formatCurrency(outstanding)}
          alert={outstanding > 0}
          icon={AlertTriangle}
          loading={isLoading}
        />
        <StatCard
          title="Total Payments Received"
          value={formatCurrency(stats?.totalPayments || 0)}
          icon={CheckCircle}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <MiniStat label="Total Invoices" value={stats?.totalInvoices ?? '-'} icon={Receipt} />
        <MiniStat label="Total Customers" value={stats?.customerCount ?? '-'} icon={Users} />
        <MiniStat label="Pending Invoices" value={stats?.pendingInvoices ?? '-'} icon={AlertTriangle} />
        <MiniStat label="Products" value={stats?.productCount ?? '-'} icon={Package} />
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Report Categories</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {reportLinks.map((link) => (
            <Card
              key={link.title}
              className={cn(
                'shadow-card hover:shadow-dropdown transition-smooth cursor-pointer border-2',
                link.borderColor
              )}
              onClick={() => navigate(link.href)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className={cn('h-12 w-12 rounded-lg flex items-center justify-center', link.bgColor)}>
                    <link.icon className={cn('h-6 w-6', link.color)} />
                  </div>
                  <ArrowRight className={cn('h-5 w-5', link.color)} />
                </div>
                <CardTitle className="mt-4">{link.title}</CardTitle>
                <CardDescription>{link.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
