import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { PaginationControls } from '@/components/pagination/PaginationControls';
import { usePagination } from '@/hooks/usePagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Users,
  Download,
  Send,
  Filter,
  Calendar,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Search
} from 'lucide-react';
import { useCustomers, usePayments, useCompanies } from '@/hooks/useDatabase';
import { useInvoicesFixed as useInvoices } from '@/hooks/useInvoicesFixed';
import { toast } from 'sonner';
import { generateCustomerStatementPDF } from '@/utils/pdfGenerator';
import { exportCustomerStatementsToCSV, exportCustomerStatementSummaryToCSV } from '@/utils/csvExporter';
import CustomerStatementPreviewModal from '@/components/statements/CustomerStatementPreviewModal';
import { toCollection } from '@/utils/collection';

interface CustomerStatement {
  customer_id: string;
  customer_name: string;
  customer_email?: string;
  total_outstanding: number;
  current_due: number;
  overdue_amount: number;
  days_overdue: number;
  last_payment_date?: string;
  last_payment_amount?: number;
  invoice_count: number;
  selected: boolean;
}

export default function CustomerStatements() {
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateRange, setDateRange] = useState('all_time');
  const [statementDate, setStatementDate] = useState(new Date().toISOString().split('T')[0]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewCustomer, setPreviewCustomer] = useState<CustomerStatement | null>(null);

  const { data: customersResponse } = useCustomers();
  const customers = toCollection(customersResponse);
  const { data: invoiceResponse } = useInvoices();
  const { data: paymentResponse } = usePayments();
  const invoices = toCollection(invoiceResponse);
  const payments = toCollection(paymentResponse);
  const { data: companies } = useCompanies();
  const currentCompany = companies?.[0];

  // Calculate customer statements
  const calculateCustomerStatements = (): CustomerStatement[] => {
    if (!customers || !invoices || !payments) return [];

    return customers.map(customer => {
      // Get customer invoices
      const customerInvoices = invoices.filter(inv => inv.customer_id === customer.id);
      
      // Calculate totals
      const totalOutstanding = customerInvoices.reduce((sum, inv) => 
        sum + ((inv.total_amount || 0) - (inv.paid_amount || 0)), 0
      );

      // Calculate overdue amounts (invoices past due date)
      const today = new Date();
      let overdueAmount = 0;
      let maxDaysOverdue = 0;

      customerInvoices.forEach(inv => {
        const dueDate = new Date(inv.due_date);
        const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        
        if (daysOverdue > 0) {
          const outstanding = (inv.total_amount || 0) - (inv.paid_amount || 0);
          if (outstanding > 0) {
            overdueAmount += outstanding;
            maxDaysOverdue = Math.max(maxDaysOverdue, daysOverdue);
          }
        }
      });

      const currentDue = totalOutstanding - overdueAmount;

      // Get last payment info
      const customerPayments = payments.filter(pay => pay.customer_id === customer.id);
      const sortedPayments = customerPayments.sort((a, b) =>
        new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
      );
      const lastPayment = sortedPayments.length > 0 ? sortedPayments[0] : undefined;

      return {
        customer_id: customer.id,
        customer_name: customer.name,
        customer_email: customer.email,
        total_outstanding: totalOutstanding,
        current_due: currentDue,
        overdue_amount: overdueAmount,
        days_overdue: maxDaysOverdue,
        last_payment_date: lastPayment?.payment_date,
        last_payment_amount: lastPayment?.amount,
        invoice_count: customerInvoices.length,
        selected: selectedCustomers.includes(customer.id)
      };
    }).filter(statement => statement.total_outstanding > 0 || statement.invoice_count > 0);
  };

  const customerStatements = calculateCustomerStatements();

  // Filter statements
  const filteredStatements = customerStatements.filter(statement => {
    // Search filter
    const matchesSearch = statement.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         statement.customer_email?.toLowerCase().includes(searchTerm.toLowerCase());

    // Status filter
    let matchesStatus = true;
    switch (filterStatus) {
      case 'outstanding':
        matchesStatus = statement.total_outstanding > 0;
        break;
      case 'overdue':
        matchesStatus = statement.overdue_amount > 0;
        break;
      case 'current':
        matchesStatus = statement.current_due > 0 && statement.overdue_amount === 0;
        break;
      case 'paid_up':
        matchesStatus = statement.total_outstanding === 0;
        break;
    }

    return matchesSearch && matchesStatus;
  });

  // Pagination hook
  const pagination = usePagination(filteredStatements, { initialPageSize: 10 });
  const paginatedStatements = pagination.paginatedItems;

  // Calculate totals
  const totalOutstanding = filteredStatements.reduce((sum, s) => sum + s.total_outstanding, 0);
  const totalOverdue = filteredStatements.reduce((sum, s) => sum + s.overdue_amount, 0);
  const totalCurrent = filteredStatements.reduce((sum, s) => sum + s.current_due, 0);
  const overdueCustomers = filteredStatements.filter(s => s.overdue_amount > 0).length;

  const getStatusBadge = (statement: CustomerStatement) => {
    if (statement.total_outstanding === 0) {
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />Paid Up</Badge>;
    }
    if (statement.overdue_amount > 0) {
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Overdue</Badge>;
    }
    if (statement.current_due > 0) {
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Current</Badge>;
    }
    return <Badge variant="secondary">No Balance</Badge>;
  };

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomers(prev => 
      prev.includes(customerId) 
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const handleSelectAll = () => {
    if (selectedCustomers.length === filteredStatements.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(filteredStatements.map(s => s.customer_id));
    }
  };

  const handleGenerateStatements = async () => {
    if (selectedCustomers.length === 0) {
      toast.error('Please select at least one customer');
      return;
    }

    try {
      const selectedStatements = filteredStatements.filter(s =>
        selectedCustomers.includes(s.customer_id)
      );

      // Prepare company details for PDF
      const companyDetails = currentCompany ? {
        name: currentCompany.name,
        address: currentCompany.address,
        city: currentCompany.city,
        country: currentCompany.country,
        phone: currentCompany.phone,
        email: currentCompany.email,
        tax_number: currentCompany.tax_number,
        logo_url: currentCompany.logo_url,
        company_services: currentCompany.company_services
      } : undefined;

      for (const statement of selectedStatements) {
        const customer = customers?.find(c => c.id === statement.customer_id);
        if (customer) {
          const customerInvoices = invoices?.filter(inv => inv.customer_id === customer.id) || [];
          const customerPayments = payments?.filter(pay => pay.customer_id === customer.id) || [];

          await generateCustomerStatementPDF(customer, customerInvoices, customerPayments, {
            statement_date: statementDate
          }, companyDetails);
        }
      }

      toast.success(`Generated ${selectedCustomers.length} customer statement${selectedCustomers.length > 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Error generating statements:', error);
      toast.error('Failed to generate some statements');
    }
  };

  const handleSendStatements = async () => {
    if (selectedCustomers.length === 0) {
      toast.error('Please select at least one customer');
      return;
    }

    const selectedWithEmail = filteredStatements.filter(s =>
      selectedCustomers.includes(s.customer_id) && s.customer_email
    );

    if (selectedWithEmail.length === 0) {
      toast.error('Selected customers have no email addresses');
      return;
    }

    try {
      // Prepare company details for PDF
      const companyDetails = currentCompany ? {
        name: currentCompany.name,
        address: currentCompany.address,
        city: currentCompany.city,
        country: currentCompany.country,
        phone: currentCompany.phone,
        email: currentCompany.email,
        tax_number: currentCompany.tax_number,
        logo_url: currentCompany.logo_url,
        company_services: currentCompany.company_services
      } : undefined;

      // Generate and "send" statements for customers with email
      for (const statement of selectedWithEmail) {
        const customer = customers?.find(c => c.id === statement.customer_id);
        if (customer) {
          const customerInvoices = invoices?.filter(inv => inv.customer_id === customer.id) || [];
          const customerPayments = payments?.filter(pay => pay.customer_id === customer.id) || [];

          await generateCustomerStatementPDF(customer, customerInvoices, customerPayments, {
            statement_date: statementDate
          }, companyDetails);
        }
      }

      toast.success(`Generated and prepared statements for ${selectedWithEmail.length} customers. In a real application, these would be emailed.`);
    } catch (error) {
      console.error('Error preparing statements for email:', error);
      toast.error('Failed to prepare some statements for sending');
    }
  };

  const handleExportReport = () => {
    try {
      const statementsToExport = selectedCustomers.length > 0
        ? filteredStatements.filter(s => selectedCustomers.includes(s.customer_id))
        : filteredStatements;

      if (statementsToExport.length === 0) {
        toast.error('No customer statements to export');
        return;
      }

      // Export both detailed and summary reports
      exportCustomerStatementsToCSV(statementsToExport);
      exportCustomerStatementSummaryToCSV(statementsToExport,
        `customer-statements-summary-${new Date().toISOString().split('T')[0]}.csv`
      );

      toast.success(`Exported ${statementsToExport.length} customer statements to CSV`);
    } catch (error) {
      console.error('Error exporting statements:', error);
      toast.error('Failed to export customer statements');
    }
  };

  const handlePreviewStatement = (customer: CustomerStatement) => {
    setPreviewCustomer(customer);
    setShowPreview(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Customer Statements</h1>
          <p className="text-muted-foreground">
            Generate and send statements showing outstanding balances
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={handleExportReport}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button 
            variant="outline"
            onClick={handleGenerateStatements}
            disabled={selectedCustomers.length === 0}
          >
            <FileText className="h-4 w-4 mr-2" />
            Generate PDFs
          </Button>
          <Button 
            onClick={handleSendStatements}
            disabled={selectedCustomers.length === 0}
          >
            <Send className="h-4 w-4 mr-2" />
            Send Statements
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-8 w-8 text-warning" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Outstanding</p>
                <p className="text-lg font-bold text-warning">${totalOutstanding.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">{filteredStatements.length} customers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Overdue Amount</p>
                <p className="text-lg font-bold text-destructive">${totalOverdue.toFixed(2)}</p>
                <p className="text-xs text-destructive">{overdueCustomers} customers overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-8 w-8 text-success" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Current Due</p>
                <p className="text-lg font-bold text-success">${totalCurrent.toFixed(2)}</p>
                <p className="text-xs text-success">Within terms</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Selected</p>
                <p className="text-lg font-bold text-primary">{selectedCustomers.length}</p>
                <p className="text-xs text-muted-foreground">For statement generation</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Statement Generation Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="statement_date">Statement Date</Label>
              <Input
                id="statement_date"
                type="date"
                value={statementDate}
                onChange={(e) => setStatementDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_range">Date Range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_time">All Time</SelectItem>
                  <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                  <SelectItem value="last_90_days">Last 90 Days</SelectItem>
                  <SelectItem value="this_year">This Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="search">Search Customers</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  id="search"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter_status">Filter by Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  <SelectItem value="outstanding">Has Outstanding</SelectItem>
                  <SelectItem value="overdue">Overdue Only</SelectItem>
                  <SelectItem value="current">Current Due</SelectItem>
                  <SelectItem value="paid_up">Paid Up</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer Statements Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Customer Statements</CardTitle>
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={selectedCustomers.length === filteredStatements.length && filteredStatements.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <Label className="text-sm">Select All</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredStatements.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No customer statements found</h3>
              <p className="text-muted-foreground">
                {searchTerm || filterStatus !== 'all' 
                  ? 'No customers match your current filters.' 
                  : 'No customers have outstanding balances.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Select</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Total Outstanding</TableHead>
                    <TableHead>Current Due</TableHead>
                    <TableHead>Overdue Amount</TableHead>
                    <TableHead>Days Overdue</TableHead>
                    <TableHead>Last Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedStatements.map((statement) => (
                    <TableRow key={statement.customer_id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedCustomers.includes(statement.customer_id)}
                          onCheckedChange={() => handleSelectCustomer(statement.customer_id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{statement.customer_name}</div>
                          {statement.customer_email && (
                            <div className="text-sm text-muted-foreground">
                              {statement.customer_email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          ${statement.total_outstanding.toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {statement.invoice_count} invoices
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={statement.current_due > 0 ? 'text-warning' : 'text-muted-foreground'}>
                          ${statement.current_due.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={statement.overdue_amount > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                          ${statement.overdue_amount.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {statement.days_overdue > 0 ? (
                          <span className="text-destructive font-medium">
                            {statement.days_overdue} days
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {statement.last_payment_date ? (
                          <div>
                            <div className="text-sm">
                              {new Date(statement.last_payment_date).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              ${statement.last_payment_amount?.toFixed(2)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No payments</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(statement)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreviewStatement(statement)}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationControls
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                pageSize={pagination.pageSize}
                totalItems={pagination.totalItems}
                onPageChange={pagination.setCurrentPage}
                onPageSizeChange={pagination.setPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Summary */}
      {selectedCustomers.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {selectedCustomers.length} customer{selectedCustomers.length > 1 ? 's' : ''} selected
                </p>
                <p className="text-sm text-muted-foreground">
                  Total outstanding: ${filteredStatements
                    .filter(s => selectedCustomers.includes(s.customer_id))
                    .reduce((sum, s) => sum + s.total_outstanding, 0)
                    .toFixed(2)}
                </p>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" onClick={() => setSelectedCustomers([])}>
                  Clear Selection
                </Button>
                <Button onClick={handleGenerateStatements}>
                  Generate Statements
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer Statement Preview Modal */}
      {showPreview && previewCustomer && (
        <CustomerStatementPreviewModal
          isOpen={showPreview}
          onClose={() => {
            setShowPreview(false);
            setPreviewCustomer(null);
          }}
          customer={previewCustomer}
          statementDate={statementDate}
        />
      )}
    </div>
  );
}
