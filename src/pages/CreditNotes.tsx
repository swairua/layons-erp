import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
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
  FileText,
  Download,
  Send,
  Calendar,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { useCompanies } from '@/hooks/useDatabase';
import { useCreditNotes } from '@/hooks/useCreditNotes';
import { toast } from 'sonner';
import { CreateCreditNoteModal } from '@/components/credit-notes/CreateCreditNoteModal';
import { ViewCreditNoteModal } from '@/components/credit-notes/ViewCreditNoteModal';
import { EditCreditNoteModal } from '@/components/credit-notes/EditCreditNoteModal';
import { ApplyCreditNoteModal } from '@/components/credit-notes/ApplyCreditNoteModal';
import { CreditNotesSetupGuide } from '@/components/credit-notes/CreditNotesSetupGuide';
import { SimpleForeignKeyPatch } from '@/components/credit-notes/SimpleForeignKeyPatch';
import { useCreditNotePDFDownload } from '@/hooks/useCreditNotePDF';
import type { CreditNote } from '@/hooks/useCreditNotes';
import { toCollection } from '@/utils/collection';

function getStatusColor(status: string) {
  switch (status) {
    case 'draft':
      return 'bg-muted text-muted-foreground border-muted-foreground/20';
    case 'sent':
      return 'bg-warning-light text-warning border-warning/20';
    case 'applied':
      return 'bg-success-light text-success border-success/20';
    case 'cancelled':
      return 'bg-destructive-light text-destructive border-destructive/20';
    default:
      return 'bg-muted text-muted-foreground border-muted-foreground/20';
  }
}

export default function CreditNotes() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedCreditNote, setSelectedCreditNote] = useState<CreditNote | null>(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [amountFromFilter, setAmountFromFilter] = useState('');
  const [amountToFilter, setAmountToFilter] = useState('');

  const { data: companies } = useCompanies();
  const currentCompany = companies?.[0];

  const pagination = useServerPagination({ initialPageSize: 10 });
  const { data: cnData, isLoading, error, refetch } = useCreditNotes(currentCompany?.id, {
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: pagination.debouncedSearch,
    fetchAll: false,
  });
  const creditNotes = toCollection(cnData);
  const totalCreditNotes = cnData?.total || 0;
  const downloadPDF = useCreditNotePDFDownload();

  // Client-side filters for status/date/amount (applied on server-filtered results)
  const filteredCreditNotes = creditNotes.filter(creditNote => {
    const matchesStatus = statusFilter === 'all' || creditNote.status === statusFilter;
    const creditNoteDate = new Date(creditNote.credit_note_date);
    const matchesDateFrom = !dateFromFilter || creditNoteDate >= new Date(dateFromFilter);
    const matchesDateTo = !dateToFilter || creditNoteDate <= new Date(dateToFilter);
    const matchesAmountFrom = !amountFromFilter || (creditNote.total_amount || 0) >= parseFloat(amountFromFilter);
    const matchesAmountTo = !amountToFilter || (creditNote.total_amount || 0) <= parseFloat(amountToFilter);
    return matchesStatus && matchesDateFrom && matchesDateTo && matchesAmountFrom && matchesAmountTo;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleCreateSuccess = () => {
    refetch();
    toast.success('Credit note created successfully!');
  };

  const handleClearFilters = () => {
    setStatusFilter('all');
    setDateFromFilter('');
    setDateToFilter('');
    setAmountFromFilter('');
    setAmountToFilter('');
    pagination.setSearch('');
    toast.success('Filters cleared');
  };

  // Check if we have the credit_notes table available
  const hasCreditNotesTable = !error || !(
    error.message.includes('relation "credit_notes" does not exist') ||
    error.message.includes("Could not find the table 'public.credit_notes'") ||
    error.message.includes('table "credit_notes" does not exist')
  );

  // Check if this is a relationship error
  const isRelationshipError = error && (
    error.message.includes('Could not find a relationship between') ||
    error.message.includes('relationship') ||
    error.message.includes('schema cache')
  );

  if (error && !hasCreditNotesTable) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Credit Notes</h1>
            <p className="text-muted-foreground">Manage customer credit notes and refunds</p>
          </div>
        </div>
        
        <CreditNotesSetupGuide />
      </div>
    );
  }

  if (error && isRelationshipError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Credit Notes</h1>
            <p className="text-muted-foreground">Manage customer credit notes and refunds</p>
          </div>
        </div>

        <SimpleForeignKeyPatch />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Credit Notes</h1>
            <p className="text-muted-foreground">Manage customer credit notes and refunds</p>
          </div>
        </div>


        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-destructive">Error loading credit notes: {error.message}</p>
              <p className="text-sm text-muted-foreground mt-2">
                If the error persists, please contact support or check the audit page.
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Credit Notes</h1>
          <p className="text-muted-foreground">
            Manage customer credit notes and refunds
          </p>
        </div>
        <Button
          className="gradient-primary text-primary-foreground hover:opacity-90 shadow-card"
          size="lg"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Credit Note
        </Button>
      </div>


      {/* Filters and Search */}
      <Card className="shadow-card">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search credit notes by customer or number..."
                value={pagination.debouncedSearch}
                onChange={(e) => pagination.setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="status-filter">Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="sent">Sent</SelectItem>
                        <SelectItem value="applied">Applied</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="date-from">Date From</Label>
                      <Input
                        id="date-from"
                        type="date"
                        value={dateFromFilter}
                        onChange={(e) => setDateFromFilter(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date-to">Date To</Label>
                      <Input
                        id="date-to"
                        type="date"
                        value={dateToFilter}
                        onChange={(e) => setDateToFilter(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="amount-from">Amount From</Label>
                      <Input
                        id="amount-from"
                        type="number"
                        placeholder="0.00"
                        value={amountFromFilter}
                        onChange={(e) => setAmountFromFilter(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amount-to">Amount To</Label>
                      <Input
                        id="amount-to"
                        type="number"
                        placeholder="0.00"
                        value={amountToFilter}
                        onChange={(e) => setAmountToFilter(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={handleClearFilters}
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Credit Notes Table */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-primary" />
            <span>Credit Notes List</span>
            {!isLoading && (
              <Badge variant="outline" className="ml-auto">
                {totalCreditNotes} credit notes
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          ) : filteredCreditNotes.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No credit notes found</h3>
              <p className="text-muted-foreground mb-6">
                {pagination.debouncedSearch 
                  ? 'Try adjusting your search criteria'
                  : 'Get started by creating your first credit note'
                }
              </p>
              {!pagination.debouncedSearch && (
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="gradient-primary text-primary-foreground hover:opacity-90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Credit Note
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Credit Note Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Applied</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCreditNotes.map((creditNote: CreditNote) => (
                    <TableRow key={creditNote.id} className="hover:bg-muted/50 transition-smooth">
                      <TableCell className="font-medium">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span>{creditNote.credit_note_number}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{creditNote.customers?.name || 'Unknown Customer'}</div>
                          {creditNote.customers?.email && (
                            <div className="text-sm text-muted-foreground">{creditNote.customers.email}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{new Date(creditNote.credit_note_date).toLocaleDateString()}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{creditNote.reason || 'Not specified'}</span>
                      </TableCell>
                      <TableCell className="font-semibold text-success">
                        {formatCurrency(creditNote.total_amount || 0)}
                      </TableCell>
                      <TableCell className="text-warning">
                        {formatCurrency(creditNote.applied_amount || 0)}
                      </TableCell>
                      <TableCell className={`font-medium ${(creditNote.balance || 0) > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                        {formatCurrency(creditNote.balance || 0)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusColor(creditNote.status)}>
                          {creditNote.status.charAt(0).toUpperCase() + creditNote.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedCreditNote(creditNote);
                              setShowViewModal(true);
                            }}
                            title="View credit note"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {creditNote.status === 'draft' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedCreditNote(creditNote);
                                setShowEditModal(true);
                              }}
                              title="Edit credit note"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => downloadPDF.mutate(creditNote)}
                            disabled={downloadPDF.isPending}
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {creditNote.status !== 'applied' && creditNote.balance > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedCreditNote(creditNote);
                                setShowApplyModal(true);
                              }}
                              className="bg-primary-light text-primary border-primary/20 hover:bg-primary hover:text-primary-foreground"
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              Apply
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
                totalPages={Math.ceil(totalCreditNotes / pagination.pageSize)}
                pageSize={pagination.pageSize}
                totalItems={totalCreditNotes}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Credit Note Modal */}
      <CreateCreditNoteModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={handleCreateSuccess}
      />

      {/* View Credit Note Modal */}
      <ViewCreditNoteModal
        open={showViewModal}
        onOpenChange={setShowViewModal}
        creditNote={selectedCreditNote}
      />

      {/* Edit Credit Note Modal */}
      <EditCreditNoteModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        creditNote={selectedCreditNote}
        onSuccess={handleCreateSuccess}
        companyId={currentCompany?.id}
      />

      {/* Apply Credit Note Modal */}
      <ApplyCreditNoteModal
        open={showApplyModal}
        onOpenChange={setShowApplyModal}
        creditNote={selectedCreditNote}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
