import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  Clock,
  CheckCircle,
  FileText,
  DollarSign,
  Package,
  TrendingUp
} from 'lucide-react';
import { useQuotations, useBOQs } from '@/hooks/useDatabase';
import { useInvoicesFixed as useInvoices } from '@/hooks/useInvoicesFixed';
import { useCompanies } from '@/hooks/useDatabase';
import { cn } from '@/lib/utils';
import { toCollection } from '@/utils/collection';

interface DashboardSummaryCardsProps {
  onDrill?: (module: string, filterType: string) => void;
}

export function DashboardSummaryCards({ onDrill }: DashboardSummaryCardsProps) {
  const { data: companies } = useCompanies();
  const currentCompany = companies?.[0];
  const companyId = currentCompany?.id;

  // Fetch data for all modules
  const { data: quotationResponse } = useQuotations(companyId);
  const quotations = toCollection(quotationResponse);
  const { data: boqs = [] } = useBOQs(companyId);
  const { data: invoiceResponse } = useInvoices(companyId);
  const invoices = toCollection(invoiceResponse);

  // Categorize invoices by due date status
  const categorizeInvoice = (invoice: any) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(invoice.due_date);
    dueDate.setHours(0, 0, 0, 0);

    const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) return 'overdue';
    if (daysUntilDue <= 7) return 'aging';
    return 'current';
  };

  // Categorize BOQs by due date status
  const categorizeBOQ = (boq: any) => {
    if (!boq.due_date) return 'current';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(boq.due_date);
    dueDate.setHours(0, 0, 0, 0);

    const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) return 'overdue';
    if (daysUntilDue <= 7) return 'aging';
    return 'current';
  };

  // Calculate summaries
  const quotationSummary = {
    draft: quotations.filter(q => q.status === 'draft').length,
    sent: quotations.filter(q => q.status === 'sent').length,
    accepted: quotations.filter(q => q.status === 'accepted').length,
    expired: quotations.filter(q => q.status === 'expired').length,
  };

  const boqSummary = {
    overdue: boqs.filter(b => categorizeBOQ(b) === 'overdue').length,
    aging: boqs.filter(b => categorizeBOQ(b) === 'aging').length,
    current: boqs.filter(b => categorizeBOQ(b) === 'current').length,
  };

  const invoiceSummary = {
    overdue: invoices.filter(inv => categorizeInvoice(inv) === 'overdue').length,
    aging: invoices.filter(inv => categorizeInvoice(inv) === 'aging').length,
    current: invoices.filter(inv => categorizeInvoice(inv) === 'current').length,
  };


  const getColorClasses = (color: string) => {
    const colorMap: { [key: string]: { icon: string; text: string; badge: string; border: string } } = {
      destructive: { icon: 'text-destructive', text: 'text-destructive', badge: 'bg-destructive text-destructive-foreground', border: 'border-destructive/20 hover:border-destructive/40' },
      warning: { icon: 'text-warning', text: 'text-warning', badge: 'bg-warning text-warning-foreground', border: 'border-warning/20 hover:border-warning/40' },
      success: { icon: 'text-success', text: 'text-success', badge: 'bg-success text-success-foreground', border: 'border-success/20 hover:border-success/40' },
      primary: { icon: 'text-primary', text: 'text-primary', badge: 'bg-primary text-primary-foreground', border: 'border-primary/20 hover:border-primary/40' },
      muted: { icon: 'text-muted-foreground', text: 'text-muted-foreground', badge: 'bg-muted text-muted-foreground', border: 'border-muted/20 hover:border-muted/40' },
    };
    return colorMap[color] || colorMap.primary;
  };

  const SummaryCard = ({ title, count, icon: Icon, color, onClick, description }: any) => {
    const classes = getColorClasses(color);
    return (
      <Card
        className={cn(
          "shadow-card cursor-pointer hover:shadow-lg transition-all border-2",
          classes.border
        )}
        onClick={onClick}
      >
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Icon className={cn("h-5 w-5", classes.icon)} />
                <p className={cn("text-sm font-medium", classes.text)}>{title}</p>
              </div>
              <Badge className={cn("text-lg font-bold px-3 py-1", classes.badge)}>
                {count}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {description || 'Click to filter'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* BOQs Summary */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-foreground">Bill of Quantities (BOQs)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryCard
            title="Overdue"
            count={boqSummary.overdue}
            icon={AlertCircle}
            color="destructive"
            description={boqSummary.overdue > 0 ? 'Click to filter' : 'None'}
            onClick={() => onDrill?.('boqs', 'overdue')}
          />
          <SummaryCard
            title="Due Soon"
            count={boqSummary.aging}
            icon={Clock}
            color="warning"
            description={boqSummary.aging > 0 ? 'Within 7 days' : 'None'}
            onClick={() => onDrill?.('boqs', 'aging')}
          />
          <SummaryCard
            title="Valid"
            count={boqSummary.current}
            icon={CheckCircle}
            color="success"
            description={`${boqSummary.current} active`}
            onClick={() => onDrill?.('boqs', 'current')}
          />
        </div>
      </div>

      {/* Invoices Summary */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-foreground">Invoices</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SummaryCard
            title="Overdue"
            count={invoiceSummary.overdue}
            icon={AlertCircle}
            color="destructive"
            description={invoiceSummary.overdue > 0 ? 'Click to filter' : 'None'}
            onClick={() => onDrill?.('invoices', 'overdue')}
          />
          <SummaryCard
            title="Due Soon"
            count={invoiceSummary.aging}
            icon={Clock}
            color="warning"
            description={invoiceSummary.aging > 0 ? 'Within 7 days' : 'None'}
            onClick={() => onDrill?.('invoices', 'aging')}
          />
          <SummaryCard
            title="Valid"
            count={invoiceSummary.current}
            icon={CheckCircle}
            color="success"
            description={`${invoiceSummary.current} active`}
            onClick={() => onDrill?.('invoices', 'current')}
          />
        </div>
      </div>

      {/* Quotations Summary */}
      <div>
        <h3 className="text-lg font-semibold mb-3 text-foreground">Quotations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            title="Draft"
            count={quotationSummary.draft}
            icon={FileText}
            color="muted"
            description={`${quotationSummary.draft} quotations`}
            onClick={() => onDrill?.('quotations', 'draft')}
          />
          <SummaryCard
            title="Sent"
            count={quotationSummary.sent}
            icon={TrendingUp}
            color="warning"
            description={`${quotationSummary.sent} awaiting response`}
            onClick={() => onDrill?.('quotations', 'sent')}
          />
          <SummaryCard
            title="Accepted"
            count={quotationSummary.accepted}
            icon={CheckCircle}
            color="success"
            description={`${quotationSummary.accepted} accepted`}
            onClick={() => onDrill?.('quotations', 'accepted')}
          />
          <SummaryCard
            title="Expired"
            count={quotationSummary.expired}
            icon={AlertCircle}
            color="destructive"
            description={`${quotationSummary.expired} expired`}
            onClick={() => onDrill?.('quotations', 'expired')}
          />
        </div>
      </div>
    </div>
  );
}
