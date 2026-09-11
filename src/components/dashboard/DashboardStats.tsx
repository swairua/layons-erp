import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDashboardStats, useCompanies } from '@/hooks/useDatabase';

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon: React.ComponentType<{ className?: string }>;
  alert?: boolean;
}

function StatCard({ title, value, change, changeType, icon: Icon, alert }: StatCardProps) {
  return (
    <Card className={cn(
      "shadow-card hover:shadow-dropdown transition-smooth",
      alert && "border-l-4 border-l-warning"
    )}>
      <CardHeader className="flex min-w-0 flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="min-w-0 text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={cn(
          "h-4 w-4",
          alert ? "text-warning" : "text-muted-foreground"
        )} />
      </CardHeader>
      <CardContent className="min-w-0">
        <div className="break-words text-xl font-bold sm:text-2xl">{value}</div>
        {change && (
          <div className="flex items-center text-xs text-muted-foreground mt-1">
            {changeType === 'increase' && (
              <TrendingUp className="mr-1 h-3 w-3 text-success" />
            )}
            {changeType === 'decrease' && (
              <TrendingDown className="mr-1 h-3 w-3 text-destructive" />
            )}
            <span className={cn(
              changeType === 'increase' && 'text-success',
              changeType === 'decrease' && 'text-destructive'
            )}>
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

interface DashboardStatsProps {
  month?: number;
  year?: number;
}

export function DashboardStats({ month, year }: DashboardStatsProps = {}) {
  const { data: companies } = useCompanies();
  const currentCompany = companies?.[0];
  const { data: stats, isLoading } = useDashboardStats(currentCompany?.id, month, year);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="shadow-card">
              <CardHeader className="space-y-0 pb-2">
                <div className="h-4 bg-muted rounded animate-pulse"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded animate-pulse mb-2"></div>
                <div className="h-3 bg-muted rounded animate-pulse w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const allStats = [
    {
      title: 'Total Revenue',
      value: formatCurrency(stats?.totalRevenue || 0),
      icon: DollarSign
    },
    {
      title: 'Outstanding Amount',
      value: formatCurrency(stats?.outstandingAmount || 0),
      alert: (stats?.outstandingAmount || 0) > 0,
      icon: AlertTriangle
    },
    {
      title: 'Total Payments Received',
      value: formatCurrency(stats?.totalPayments || 0),
      icon: CheckCircle
    }
  ];

  return (
    <div className="space-y-4">
      {/* All Stats in One Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {allStats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>
    </div>
  );
}
