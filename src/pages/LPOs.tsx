import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PaginationControls } from '@/components/pagination/PaginationControls';
import { useServerPagination } from '@/hooks/useServerPagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Download,
  Send,
  Calendar,
  ShoppingCart,
  Package,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  User,
  Database
} from 'lucide-react';
import { toast } from 'sonner';
import { useLPOs, useUpdateLPO, useCompanies } from '@/hooks/useDatabase';
import { downloadLPOPDF } from '@/utils/pdfGenerator';
import { CreateLPOModal } from '@/components/lpo/CreateLPOModal';
import { ViewLPOModal } from '@/components/lpo/ViewLPOModal';
import { EditLPOModal } from '@/components/lpo/EditLPOModal';
import { DirectForceMigration } from '@/components/DirectForceMigration';
import { LPOCustomerSupplierAudit } from '@/components/LPOCustomerSupplierAudit';
import { toCollection } from '@/utils/collection';

export default function LPOs() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedLPO, setSelectedLPO] = useState(null);
  const [showCustomerSupplierAudit, setShowCustomerSupplierAudit] = useState(false);
  const [showAuditPanel, setShowAuditPanel] = useState(false);

  // Database hooks
  const { data: companies } = useCompanies();
  const currentCompany = companies?.[0];

  const pagination = useServerPagination({ initialPageSize: 10 });
  const { data: lpoData, isLoading, error, refetch } = useLPOs(currentCompany?.id, {
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.debouncedSearch,
    fetchAll: false,
  });
  const lpos = toCollection(lpoData);
  const totalLPOs = lpoData?.total || 0;
  const updateLPO = useUpdateLPO();

  // Note: Auto-migration removed - using manual migration guide instead

  // Calculate stats (from current page only - total is server-side)
  const draftLPOs = lpos.filter(lpo => lpo.status === 'draft').length;
  const sentLPOs = lpos.filter(lpo => lpo.status === 'sent').length;
  const approvedLPOs = lpos.filter(lpo => lpo.status === 'approved').length;
  const receivedLPOs = lpos.filter(lpo => lpo.status === 'received').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary" className="bg-secondary-light text-secondary border-secondary/20"><FileText className="h-3 w-3 mr-1" />Draft</Badge>;
      case 'sent':
        return <Badge variant="outline" className="bg-primary-light text-primary border-primary/20"><Send className="h-3 w-3 mr-1" />Sent</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-success-light text-success border-success/20"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'received':
        return <Badge variant="outline" className="bg-success text-success-foreground"><Package className="h-3 w-3 mr-1" />Received</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-destructive-light text-destructive border-destructive/20"><AlertTriangle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: number, currency: string = 'KES') => {
    const localeMap: { [key: string]: string } = {
      'KES': 'en-KE',
      'USD': 'en-US',
      'EUR': 'en-GB',
      'GBP': 'en-GB',
    };

    return new Intl.NumberFormat(localeMap[currency] || 'en-KE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleView = (lpo: any) => {
    setSelectedLPO(lpo);
    setShowViewModal(true);
  };

  const handleEdit = (lpo: any) => {
    setSelectedLPO(lpo);
    setShowEditModal(true);
  };

  const handleDownloadPDF = async (lpo: any) => {
    try {
      if (!currentCompany) {
        toast.error('Company information not available');
        return;
      }

      await downloadLPOPDF(lpo, {
        name: currentCompany.name,
        email: currentCompany.email,
        phone: currentCompany.phone,
        address: currentCompany.address,
        city: currentCompany.city,
        country: currentCompany.country,
        tax_number: currentCompany.tax_number,
        logo_url: currentCompany.logo_url,
        header_image: currentCompany.header_image,
        stamp_image: currentCompany.stamp_image,
        company_services: currentCompany.company_services
      });

      toast.success(`LPO ${lpo.lpo_number} PDF generated successfully!`);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF');
    }
  };

  const handleSendEmail = (lpo: any) => {
    const subject = `Purchase Order ${lpo.lpo_number}`;
    const body = `Please find attached Purchase Order ${lpo.lpo_number} for your review.`;
    const emailUrl = `mailto:${lpo.suppliers?.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    window.open(emailUrl);
    toast.success(`Email client opened with LPO ${lpo.lpo_number}`);
  };

  const handleUpdateStatus = async (lpo: any, newStatus: string) => {
    try {
      await updateLPO.mutateAsync({
        id: lpo.id,
        status: newStatus
      });
      toast.success(`LPO ${lpo.lpo_number} status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating LPO status:', error);
      toast.error('Failed to update LPO status');
    }
  };

  const handleFilter = () => {
    toast.info('Advanced filter functionality coming soon!');
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    toast.success('Local Purchase Order created successfully!');
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    setSelectedLPO(null);
    toast.success('Local Purchase Order updated successfully!');
  };

  // Handle error state
  if (error) {
    const isTableMissing = error.message.includes('table') &&
                          (error.message.includes('lpos') || error.message.includes('schema cache'));

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Local Purchase Orders</h1>
            <p className="text-muted-foreground">
              Manage purchase orders to suppliers
            </p>
          </div>
        </div>
        {isTableMissing ? (
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Database Table Missing</h3>
                <p className="text-destructive mb-4">
                  The LPOs table appears to be missing from the database.
                </p>
                <Button
                  variant="outline"
                  onClick={() => window.location.reload()}
                  className="mt-4"
                >
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-card">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <p className="text-destructive">Error loading LPOs: {error.message}</p>
                <Button
                  variant="outline"
                  onClick={() => window.location.reload()}
                  className="mt-4"
                >
                  Retry
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Local Purchase Orders</h1>
          <p className="text-muted-foreground">
            Create and manage purchase orders to suppliers
          </p>
        </div>
        <Button 
          variant="default" 
          size="lg"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          New LPO
        </Button>
      </div>

      {/* Customer vs Supplier Audit Panel */}
      {showCustomerSupplierAudit && (
        <LPOCustomerSupplierAudit />
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalLPOs}</p>
                <p className="text-xs text-muted-foreground">Total LPOs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center space-x-2">
              <FileText className="h-8 w-8 text-secondary" />
              <div>
                <p className="text-2xl font-bold">{draftLPOs}</p>
                <p className="text-xs text-muted-foreground">Draft</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center space-x-2">
              <Send className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{sentLPOs}</p>
                <p className="text-xs text-muted-foreground">Sent</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-8 w-8 text-success" />
              <div>
                <p className="text-2xl font-bold">{approvedLPOs}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center space-x-2">
              <Package className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{receivedLPOs}</p>
                <p className="text-xs text-muted-foreground">Received</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Purchase Orders</CardTitle>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search LPOs..."
                  value={pagination.debouncedSearch}
                  onChange={(e) => pagination.setSearch(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleFilter}>
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAuditPanel(!showAuditPanel)}
              >
                <Database className="h-4 w-4 mr-2" />
                Database Audit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCustomerSupplierAudit(!showCustomerSupplierAudit)}
                className="border-orange-500 text-orange-600 hover:bg-orange-50"
              >
                <User className="h-4 w-4 mr-2" />
                Customer/Supplier Audit
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-4 w-[160px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : lpos.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No purchase orders found</h3>
              <p className="text-muted-foreground mb-4">
                {pagination.debouncedSearch ? 'No LPOs match your search.' : 'Create your first Local Purchase Order to get started.'}
              </p>
              {!pagination.debouncedSearch && (
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create LPO
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>LPO #</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Delivery Date</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lpos.map((lpo) => (
                    <TableRow key={lpo.id}>
                      <TableCell className="font-medium">
                        {lpo.lpo_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{lpo.suppliers?.name}</div>
                          {lpo.suppliers?.email && (
                            <div className="text-sm text-muted-foreground">
                              {lpo.suppliers.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                          {formatDate(lpo.lpo_date)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {lpo.delivery_date ? (
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                            {formatDate(lpo.delivery_date)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(lpo.total_amount)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(lpo.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(lpo)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(lpo)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadPDF(lpo)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSendEmail(lpo)}
                            disabled={!lpo.suppliers?.email}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          {lpo.status === 'approved' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUpdateStatus(lpo, 'received')}
                            >
                              <Package className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationControls
                currentPage={pagination.page}
                totalPages={Math.ceil(totalLPOs / pagination.pageSize)}
                pageSize={pagination.pageSize}
                totalItems={totalLPOs}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <CreateLPOModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={handleCreateSuccess}
      />

      <ViewLPOModal
        open={showViewModal}
        onOpenChange={setShowViewModal}
        lpo={selectedLPO}
        onEdit={() => {
          setShowViewModal(false);
          setShowEditModal(true);
        }}
        onDownloadPDF={handleDownloadPDF}
        onSendEmail={handleSendEmail}
        onUpdateStatus={handleUpdateStatus}
      />

      <EditLPOModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        lpo={selectedLPO}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
