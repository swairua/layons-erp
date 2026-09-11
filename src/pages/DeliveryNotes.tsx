import { useState } from 'react';
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
  Truck,
  Package,
  CheckCircle,
  Clock,
  AlertTriangle,
  MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import { downloadDeliveryNotePDF } from '@/utils/pdfGenerator';
import { CreateDeliveryNoteModal } from '@/components/delivery/CreateDeliveryNoteModal';
import { ViewDeliveryNoteModal } from '@/components/delivery/ViewDeliveryNoteModal';
import { useDeliveryNotes, useUpdateDeliveryNote, useCompanies } from '@/hooks/useDatabase';
import { mapDeliveryNoteForDisplay } from '@/utils/deliveryNoteMapper';
import { toCollection } from '@/utils/collection';


export default function DeliveryNotes() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedDeliveryNote, setSelectedDeliveryNote] = useState(null);

  // Database hooks
  const { data: companies } = useCompanies();
  const currentCompany = companies?.[0];

  const pagination = useServerPagination({ initialPageSize: 10 });
  const { data: dnData, isLoading, error } = useDeliveryNotes(currentCompany?.id, {
    fetchAll: false,
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.debouncedSearch,
  });
  const deliveryNotes = toCollection(dnData);
  const totalDeliveryNotes = dnData?.total || 0;
  const updateDeliveryNote = useUpdateDeliveryNote();

  const mappedDeliveryNotes = deliveryNotes.map(mapDeliveryNoteForDisplay);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary" className="bg-secondary-light text-secondary border-secondary/20"><Clock className="h-3 w-3 mr-1" />Prepared</Badge>;
      case 'sent':
        return <Badge variant="default" className="bg-primary text-primary-foreground"><Truck className="h-3 w-3 mr-1" />In Transit</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-success-light text-success border-success/20"><CheckCircle className="h-3 w-3 mr-1" />Delivered</Badge>;
      case 'cancelled':
        return <Badge variant="outline" className="bg-destructive-light text-destructive border-destructive/20"><AlertTriangle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getDeliveryMethodDisplay = (method: string) => {
    switch (method) {
      case 'pickup':
        return 'Customer Pickup';
      case 'delivery':
        return 'Home Delivery';
      case 'courier':
        return 'Courier Service';
      case 'freight':
        return 'Freight Shipping';
      default:
        return method;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleView = (deliveryNote: any) => {
    setSelectedDeliveryNote(deliveryNote);
    setShowViewModal(true);
  };

  const handleDownloadPDF = async (deliveryNote: any) => {
    try {
      // Get current company details for PDF
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

      await downloadDeliveryNotePDF(deliveryNote, companyDetails);
      const noteNumber = deliveryNote.delivery_note_number || deliveryNote.delivery_number;
      toast.success(`Delivery note ${noteNumber} PDF downloaded successfully!`);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF');
    }
  };

  const handleSendEmail = (deliveryNote: any) => {
    const noteNumber = deliveryNote.delivery_note_number || deliveryNote.delivery_number;
    const subject = `Delivery Note ${noteNumber}`;
    const body = `Please find attached delivery note ${noteNumber} for your shipment.`;
    const emailUrl = `mailto:${deliveryNote.customers?.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    window.open(emailUrl);
    toast.success(`Email client opened with delivery note ${noteNumber}`);
  };

  const handleMarkDelivered = async (deliveryNote: any) => {
    try {
      await updateDeliveryNote.mutateAsync({
        id: deliveryNote.id,
        status: 'approved'
      });
      const noteNumber = deliveryNote.delivery_note_number || deliveryNote.delivery_number;
      toast.success(`Delivery note ${noteNumber} marked as delivered`);
    } catch (error) {
      console.error('Error marking delivery note as delivered:', error);
      toast.error('Failed to mark delivery note as delivered');
    }
  };

  const handleFilter = () => {
    toast.info('Advanced filter functionality coming soon!');
  };

  const handleCreateSuccess = () => {
    setShowCreateModal(false);
    toast.success('Delivery note created successfully!');
  };

  // Calculate stats (from server total, not filtered)
  const inTransit = deliveryNotes.filter(note => note.status === 'sent').length;
  const delivered = deliveryNotes.filter(note => note.status === 'approved').length;
  const prepared = deliveryNotes.filter(note => note.status === 'draft').length;

  // Handle error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Delivery Notes</h1>
            <p className="text-muted-foreground">
              Track and manage delivery documentation
            </p>
          </div>
        </div>
        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-destructive">Error loading delivery notes: {error.message}</p>
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Delivery Notes</h1>
          <p className="text-muted-foreground">
            Track and manage delivery documentation
          </p>
        </div>
        <Button 
          variant="default" 
          size="lg"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Delivery Note
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center space-x-2">
              <Package className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalDeliveryNotes}</p>
                <p className="text-xs text-muted-foreground">Total Notes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-8 w-8 text-secondary" />
              <div>
                <p className="text-2xl font-bold">{prepared}</p>
                <p className="text-xs text-muted-foreground">Prepared</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center space-x-2">
              <Truck className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{inTransit}</p>
                <p className="text-xs text-muted-foreground">In Transit</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-8 w-8 text-success" />
              <div>
                <p className="text-2xl font-bold">{delivered}</p>
                <p className="text-xs text-muted-foreground">Delivered</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Delivery Notes</CardTitle>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search delivery notes..."
                  value={pagination.debouncedSearch}
                  onChange={(e) => pagination.setSearch(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleFilter}>
                <Filter className="h-4 w-4 mr-2" />
                Filter
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
          ) : mappedDeliveryNotes.length === 0 ? (
            <div className="text-center py-8">
              <Truck className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No delivery notes found</h3>
              <p className="text-muted-foreground mb-4">
                {pagination.debouncedSearch ? 'No delivery notes match your search.' : 'Create your first delivery note to get started.'}
              </p>
              {!pagination.debouncedSearch && (
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Delivery Note
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Delivery Note #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Delivery Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Tracking #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappedDeliveryNotes.map((note) => (
                    <TableRow key={note.id}>
                      <TableCell className="font-medium">
                        {note.delivery_note_number || note.delivery_number}
                        {note.invoice_number ? (
                          <div className="text-xs text-success">
                            Invoice: {note.invoice_number}
                          </div>
                        ) : (
                          <div className="text-xs text-destructive">
                            ⚠️ No invoice linked
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{note.customers?.name}</div>
                          {note.customers?.email && (
                            <div className="text-sm text-muted-foreground">
                              {note.customers.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                          {formatDate(note.delivery_date)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                          {getDeliveryMethodDisplay(note.delivery_method)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {note.tracking_number ? (
                          <span className="font-mono text-sm">{note.tracking_number}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(note.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(note)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadPDF(note)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSendEmail(note)}
                            disabled={!note.customers?.email}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          {note.status !== 'approved' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkDelivered(note)}
                            >
                              <CheckCircle className="h-4 w-4" />
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
                totalPages={Math.ceil(totalDeliveryNotes / pagination.pageSize)}
                pageSize={pagination.pageSize}
                totalItems={totalDeliveryNotes}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <CreateDeliveryNoteModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={handleCreateSuccess}
      />

      <ViewDeliveryNoteModal
        open={showViewModal}
        onOpenChange={setShowViewModal}
        deliveryNote={selectedDeliveryNote}
        onDownloadPDF={handleDownloadPDF}
        onSendEmail={handleSendEmail}
        onMarkDelivered={handleMarkDelivered}
      />
    </div>
  );
}
