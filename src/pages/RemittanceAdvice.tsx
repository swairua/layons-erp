import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PaginationControls } from '@/components/pagination/PaginationControls';
import { useServerPagination } from '@/hooks/useServerPagination';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  FileText,
  Download,
  Edit,
  Calendar,
  CreditCard,
  Building2
} from 'lucide-react';
import { downloadRemittancePDF } from '@/utils/pdfGenerator';
import { toast } from 'sonner';
import { useRemittanceAdvice } from '@/hooks/useDatabase';
import { useCurrentCompany } from '@/contexts/CompanyContext';
import { CreateRemittanceModal } from '@/components/remittance/CreateRemittanceModalFixed';
import { ViewRemittanceModal } from '@/components/remittance/ViewRemittanceModal';
import { EditRemittanceModal } from '@/components/remittance/EditRemittanceModal';

// Remittance advice page - uses real database data via useRemittanceAdvice hook

const RemittanceAdvice = () => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRemittance, setSelectedRemittance] = useState<any>(null);

  // Fetch live remittance advice data and company details
  const pagination = useServerPagination({ initialPageSize: 10 });
  const { currentCompany } = useCurrentCompany();
  const { data: remData, isLoading, error } = useRemittanceAdvice(currentCompany?.id, {
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.debouncedSearch,
    fetchAll: false,
  });
  const remittances = remData?.data || [];
  const totalRemittances = remData?.total || 0;

  const handleViewRemittance = (remittance: any) => {
    setSelectedRemittance(remittance);
    setShowViewModal(true);
  };

  const handleEditRemittance = (remittance: any) => {
    setSelectedRemittance(remittance);
    setShowEditModal(true);
  };

  const handleDownloadRemittance = async (remittance: any) => {
    try {
      // Use live data format
      const remittanceData = {
        advice_number: remittance.advice_number,
        advice_date: remittance.advice_date,
        total_payment: remittance.total_payment,
        customers: {
          name: remittance.customers?.name || 'N/A',
          address: remittance.customers?.address || 'N/A',
          city: remittance.customers?.city || 'Nairobi',
          country: remittance.customers?.country || 'Kenya'
        },
        notes: remittance.notes || `Remittance advice for ${remittance.customers?.name}`,
        // Include line items for PDF generation
        remittance_advice_items: remittance.remittance_advice_items || [],
        items: remittance.items || [] // Fallback for legacy format
      };

      // Pass company details to PDF generator
      const companyDetails = currentCompany ? {
        name: currentCompany.name,
        address: currentCompany.address,
        city: currentCompany.city,
        country: currentCompany.country,
        phone: currentCompany.phone,
        email: currentCompany.email,
        tax_number: currentCompany.tax_number,
        logo_url: currentCompany.logo_url,
        header_image: currentCompany.header_image,
        stamp_image: currentCompany.stamp_image,
        company_services: currentCompany.company_services
      } : undefined;

      await downloadRemittancePDF(remittanceData, companyDetails);
      toast.success(`Remittance ${remittance.advice_number} PDF downloaded`);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to download PDF: ${errorMessage}`);
    }
  };

  const filteredRemittances = remittances.filter(remittance => {
    const matchesStatus = statusFilter === 'all' || remittance.status === statusFilter;
    return matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Remittance Advice</h1>
            <p className="text-muted-foreground">Loading remittance advice data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Remittance Advice</h1>
            <p className="text-destructive">Error loading remittance advice: {error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-success text-success-foreground';
      case 'draft':
        return 'bg-warning text-warning-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Remittance Advice</h1>
          <p className="text-muted-foreground">
            Manage payment advice and remittance documents for customers
          </p>
        </div>
        <Button
          className="shadow-card"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Remittance Advice
        </Button>
      </div>

      {/* Filters */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <span>Filter Remittance Advice</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by customer name or advice number..."
                  value={pagination.debouncedSearch}
                  onChange={(e) => pagination.setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Remittance Advice List */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Remittance Advice Documents</CardTitle>
          <CardDescription>
            List of all remittance advice documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredRemittances.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No remittance advice found</h3>
              <p className="text-muted-foreground mb-4">
                {pagination.debouncedSearch || statusFilter !== 'all'
                  ? 'Try adjusting your search criteria'
                  : 'Create your first remittance advice document'
                }
              </p>
              {!pagination.debouncedSearch && statusFilter === 'all' && (
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Remittance Advice
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Advice Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRemittances.map((remittance) => (
                    <TableRow key={remittance.id} className="hover:bg-muted/50 transition-smooth">
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span>{remittance.adviceNumber || remittance.advice_number || 'N/A'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{remittance.customerName || remittance.customers?.name || 'N/A'}</div>
                          <div className="text-sm text-muted-foreground">
                            {remittance.customerAddress || remittance.customers?.address || 'N/A'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{new Date(remittance.date || remittance.advice_date || new Date()).toLocaleDateString()}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span>{(remittance.remittance_advice_items?.length || remittance.items?.length || 0)} items</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          ${(remittance.total_payment || remittance.totalPayment || 0).toFixed(2)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(remittance.status || 'draft')}>
                          {(remittance.status || 'draft').charAt(0).toUpperCase() + (remittance.status || 'draft').slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewRemittance(remittance)}
                          >
                            <FileText className="mr-1 h-3 w-3" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditRemittance(remittance)}
                          >
                            <Edit className="mr-1 h-3 w-3" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadRemittance(remittance)}
                          >
                            <Download className="mr-1 h-3 w-3" />
                            PDF
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationControls
                currentPage={pagination.page}
                totalPages={Math.ceil(totalRemittances / pagination.pageSize)}
                pageSize={pagination.pageSize}
                totalItems={totalRemittances}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Latest Remittance Advice Preview */}
      {filteredRemittances.length > 0 && filteredRemittances[0] && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span>Remittance Advice Preview - {filteredRemittances[0].adviceNumber || filteredRemittances[0].advice_number || 'N/A'}</span>
            </CardTitle>
            <CardDescription>
              Latest remittance advice document layout
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/30 p-6 rounded-lg">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-primary">REMITTANCE ADVICE</h2>
                <div className="mt-4 space-y-1">
                  <div className="font-semibold">Layons Construction Limited</div>
                  <div className="text-sm text-muted-foreground">
                    P.O Box 85988-00200, Nairobi, Kenya
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Tel: 0720717463
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Email: layonscoltd@gmail.com
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Website:
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <div className="font-semibold text-sm mb-2">TO:</div>
                  <div className="space-y-1">
                    <div className="font-medium">{filteredRemittances[0].customerName || filteredRemittances[0].customers?.name || 'N/A'}</div>
                    <div className="text-sm text-muted-foreground">
                      {filteredRemittances[0].customerAddress || filteredRemittances[0].customers?.address || 'N/A'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="space-y-1">
                    <div><span className="font-semibold">Date:</span> {new Date(filteredRemittances[0].date || filteredRemittances[0].advice_date || new Date()).toLocaleDateString()}</div>
                    <div><span className="font-semibold">Advice No:</span> {filteredRemittances[0].adviceNumber || filteredRemittances[0].advice_number || 'N/A'}</div>
                  </div>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Invoice/Credit Note</TableHead>
                    <TableHead className="text-right">Invoice Amount</TableHead>
                    <TableHead className="text-right">Credit Note</TableHead>
                    <TableHead className="text-right">Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(filteredRemittances[0].items || []).map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.date}</TableCell>
                      <TableCell>
                        {item.invoiceNumber || item.creditNote}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.invoiceAmount ? `$${(item.invoiceAmount || 0).toFixed(2)}` : ''}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.creditAmount ? `$${(item.creditAmount || 0).toFixed(2)}` : ''}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${(item.payment || 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2">
                    <TableCell colSpan={4} className="font-semibold">Total Payment</TableCell>
                    <TableCell className="text-right font-bold text-lg">
                      ${(filteredRemittances[0].totalPayment || 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Remittance Modal */}
      <CreateRemittanceModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={() => {
          // Refresh the data when a new remittance is created
          // In a real app, this would refetch the data
          toast.success('Remittance advice created successfully!');
        }}
      />

      {/* View Remittance Modal */}
      <ViewRemittanceModal
        open={showViewModal}
        onOpenChange={setShowViewModal}
        remittance={selectedRemittance}
        onDownload={() => {
          // Optional callback when PDF is downloaded from view modal
        }}
      />

      {/* Edit Remittance Modal */}
      <EditRemittanceModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        remittance={selectedRemittance}
        onSuccess={() => {
          toast.success('Remittance advice updated successfully!');
        }}
      />
    </div>
  );
};

export default RemittanceAdvice;
