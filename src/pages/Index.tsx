import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DashboardSummaryCards } from '@/components/dashboard/DashboardSummaryCards';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { useCompanies } from '@/hooks/useDatabase';
import { useAuth } from '@/contexts/AuthContext';
import { hasFeature } from '@/utils/rolePermissions';
import type { UserRole } from '@/utils/rolePermissions';
import SEO from '@/components/SEO';
import { ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();
  const { profile, loading, permissions, profileReady, permissionsReady } = useAuth();
  const role = (profile?.role || 'user') as UserRole;
  const canViewDashboard = hasFeature(role, 'dashboard', permissions);
  const { data: companies } = useCompanies();

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePreviousMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const handleCurrentMonth = () => {
    const today = new Date();
    setSelectedMonth(today.getMonth());
    setSelectedYear(today.getFullYear());
  };

  const handleDrillDown = (module: string, filterType: string) => {
    switch (module) {
      case 'quotations':
        navigate(`/quotations?status=${filterType}`);
        break;
      case 'boqs':
        navigate(`/boqs?dueStatus=${filterType}`);
        break;
      case 'invoices':
        navigate(`/invoices?dueStatus=${filterType}`);
        break;
      case 'proforma':
        navigate(`/proforma?status=${filterType}`);
        break;
      case 'payments':
        navigate(`/payments?filter=${filterType}`);
        break;
      default:
        break;
    }
  };

  if (loading || !profileReady || !permissionsReady) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!canViewDashboard) {
    const firstName = (profile?.full_name || '').split(' ')[0];
    return (
      <div className="space-y-6">
        <SEO
          title="Dashboard"
          description="Your account overview."
        />
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back{firstName ? `, ${firstName}` : ''}!
          </h1>
          <p className="text-muted-foreground">Here is your account overview.</p>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-muted-foreground" />
              Dashboard metrics are hidden
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground">
              Dashboard access has been disabled for your account, so performance metrics,
              financial summaries and recent activity are not shown here.
            </p>
            <p className="text-muted-foreground">
              You can keep working from the modules in the sidebar. If you need dashboard
              access restored, please contact your administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SEO
        title="Dashboard"
        description="View your business performance, recent activities, and manage your companies from one place."
      />
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's what's happening with your business today.
        </p>
      </div>

      {/* Period Selection */}
      {hasFeature(role, 'dashboard', permissions) && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Period Selection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePreviousMonth} className="p-2 h-auto">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex flex-col items-center gap-2">
                  <span className="text-lg font-semibold min-w-[180px] text-center">
                    {monthNames[selectedMonth]} {selectedYear}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={handleNextMonth} className="p-2 h-auto">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="secondary" size="sm" onClick={handleCurrentMonth}>
                Current Month
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial Summary for Selected Month */}
      {hasFeature(role, 'dashboard', permissions) && (
        <div>
          <h2 className="text-xl font-semibold mb-4 text-foreground">
            Financial Summary - {monthNames[selectedMonth]} {selectedYear}
          </h2>
          <DashboardStats month={selectedMonth} year={selectedYear} />
        </div>
      )}

      {/* Summary Cards with Drill-down */}
      {hasFeature(role, 'dashboard', permissions) && (
        <div>
          <h2 className="text-xl font-semibold mb-4 text-foreground">Module Summary</h2>
          <DashboardSummaryCards onDrill={handleDrillDown} />
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Takes 2/3 of the space */}
        <div className="lg:col-span-2 space-y-6">
          <RecentActivity />
        </div>

        {/* Right Column - Takes 1/3 of the space */}
        <div className="space-y-6">
          <QuickActions />
        </div>
      </div>
    </div>
  );
};

export default Index;
