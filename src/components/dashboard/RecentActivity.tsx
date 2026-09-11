import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { usePayments, useRemittanceAdvice } from '@/hooks/useDatabase';
import { useInvoicesFixed as useInvoices } from '@/hooks/useInvoicesFixed';
import { useCurrentCompany } from '@/contexts/CompanyContext';
import { formatCurrency as formatCurrencyUtil } from '@/utils/currencyFormatter';
import { Skeleton } from '@/components/ui/skeleton';
import { toCollection } from '@/utils/collection';

interface Activity {
  id: string;
  type: 'invoice' | 'payment' | 'remittance' | 'delivery';
  title: string;
  customer: string;
  amount?: string;
  status: 'completed' | 'pending' | 'overdue' | 'draft' | 'sent';
  timestamp: Date;
}

function getStatusColor(status: Activity['status']) {
  switch (status) {
    case 'completed':
    case 'sent':
      return 'bg-success-light text-success border-success/20';
    case 'pending':
      return 'bg-warning-light text-warning border-warning/20';
    case 'overdue':
      return 'bg-destructive-light text-destructive border-destructive/20';
    case 'draft':
      return 'bg-muted text-muted-foreground border-muted-foreground/20';
    default:
      return 'bg-muted text-muted-foreground border-muted-foreground/20';
  }
}

function getTypeIcon(type: Activity['type']) {
  switch (type) {
    case 'invoice':
      return 'IN';
    case 'payment':
      return 'PA';
    case 'remittance':
      return 'RA';
    case 'delivery':
      return 'DE';
    default:
      return 'AC';
  }
}

export function RecentActivity() {
  const { currentCompany } = useCurrentCompany();
  const { data: invoiceResponse, isLoading: invoicesLoading } = useInvoices(currentCompany?.id);
  const { data: paymentResponse, isLoading: paymentsLoading } = usePayments(currentCompany?.id);
  const { data: remittanceResponse, isLoading: remittancesLoading } = useRemittanceAdvice(currentCompany?.id);
  const invoices = toCollection(invoiceResponse);
  const payments = toCollection(paymentResponse);
  const remittances = toCollection(remittanceResponse);

  const isLoading = invoicesLoading || paymentsLoading || remittancesLoading;

  const formatCurrency = (amount: number, currency?: string | null) =>
    formatCurrencyUtil(amount, currency);

  // Combine all activities
  const activities: Activity[] = [];

  // Add invoices
  if (invoices) {
    invoices.slice(0, 3).forEach(invoice => {
      activities.push({
        id: `invoice-${invoice.id}`,
        type: 'invoice',
        title: `Invoice ${invoice.invoice_number}`,
        customer: invoice.customers?.name || 'Unknown Customer',
        amount: formatCurrency(invoice.total_amount || 0, invoice.currency),
        status: invoice.status as Activity['status'],
        timestamp: new Date(invoice.created_at || '')
      });
    });
  }

  // Add payments
  if (payments) {
    payments.slice(0, 2).forEach(payment => {
      activities.push({
        id: `payment-${payment.id}`,
        type: 'payment',
        title: `Payment ${payment.payment_number}`,
        customer: payment.customers?.name || 'Unknown Customer',
        amount: formatCurrency(payment.amount || 0, payment.currency),
        status: 'completed',
        timestamp: new Date(payment.created_at || '')
      });
    });
  }

  // Add remittance advice
  if (remittances) {
    remittances.slice(0, 1).forEach(remittance => {
      activities.push({
        id: `remittance-${remittance.id}`,
        type: 'remittance',
        title: `Remittance ${remittance.advice_number}`,
        customer: remittance.customers?.name || 'Unknown Customer',
        amount: formatCurrency(remittance.total_payment || 0, remittance.currency),
        status: remittance.status as Activity['status'],
        timestamp: new Date(remittance.created_at || '')
      });
    });
  }

  // Sort by timestamp (most recent first)
  activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  if (isLoading) {
    return (
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4 p-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No recent activity</p>
            <p className="text-sm text-muted-foreground mt-1">
              Start creating invoices, payments, or quotations to see activity here
            </p>
          </div>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="flex items-center space-x-4 p-3 rounded-lg hover:bg-muted/50 transition-smooth cursor-pointer">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                  {getTypeIcon(activity.type)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{activity.title}</p>
                  {activity.amount && (
                    <span className="text-sm font-semibold text-foreground">
                      {activity.amount}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{activity.customer}</p>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className={getStatusColor(activity.status)}>
                      {activity.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        
        {activities.length > 0 && (
          <div className="text-center pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Showing latest activity • {activities.length} recent items
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
