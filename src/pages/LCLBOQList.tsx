import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useCurrentCompany } from '@/contexts/CompanyContext';
import { lclBoqService, LCLBOQRecord } from '@/services/lclBoqService';
import { useCustomers } from '@/hooks/useDatabase';
import { lclTemplateService } from '@/services/lclTemplateService';
import { LCLTemplateStructure } from '@/types/lclTemplate';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, Edit2, Trash2, Search } from 'lucide-react';
import { downloadLCLBOQPDF, reconstructHierarchicalDataFromSnapshot } from '@/utils/lclBoqPdfGenerator';
import { EditLCLBOQModal } from '@/components/lcl/EditLCLBOQModal';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { toCollection } from '@/utils/collection';

export default function LCLBOQList() {
  const { currentCompany } = useCurrentCompany();
  const companyId = currentCompany?.id || '';
  const { toast } = useToast();
  const { data: customersResponse } = useCustomers(companyId);
  const customers = toCollection(customersResponse);

  const [boqs, setBoqs] = useState<LCLBOQRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [selectedBoq, setSelectedBoq] = useState<LCLBOQRecord | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [templateStructure, setTemplateStructure] = useState<LCLTemplateStructure | undefined>();

  useEffect(() => {
    loadBoqs();
    loadTemplateStructure();
  }, [companyId]);

  const loadTemplateStructure = async () => {
    if (!companyId) return;
    try {
      const structures = await lclTemplateService.getStructures(companyId);
      const defaultStructure = structures.find(
        (s) => s.name.toLowerCase().includes('default')
      ) || structures[0];
      setTemplateStructure(defaultStructure);
    } catch (error) {
      console.error('Error loading template structure:', error);
      // Gracefully fail - modal will work with fallback
    }
  };

  const loadBoqs = async () => {
    setLoading(true);
    if (!companyId) {
      setLoading(false);
      return;
    }

    try {
      const data = await lclBoqService.getLCLBOQs(companyId);
      setBoqs(data);
    } catch (error) {
      console.error('Error loading LCL BOQs:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to load LCL BOQs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getCustomerName = (customerId?: string | null) => {
    if (!customerId) return '-';
    return customers?.find((c) => c.id === customerId)?.name || '-';
  };

  const handleDownloadPDF = async (boq: LCLBOQRecord) => {
    if (!boq.items_snapshot || boq.items_snapshot.length === 0) {
      toast({
        title: 'Error',
        description: 'No items found in this BOQ',
        variant: 'destructive',
      });
      return;
    }

    setDownloading(boq.id || null);
    try {
      const customerInfo = boq.customer_id
        ? customers?.find((c) => c.id === boq.customer_id)
        : null;

      const hierarchicalData = reconstructHierarchicalDataFromSnapshot(boq.items_snapshot);

      await downloadLCLBOQPDF(
        hierarchicalData,
        boq.number,
        boq.boq_date || new Date().toISOString().split('T')[0],
        customerInfo?.name || 'Unknown Customer',
        boq.project_title || '',
        currentCompany ? {
          name: currentCompany.name || '',
          logo_url: currentCompany.logo_url,
          address: currentCompany.address,
          city: currentCompany.city,
          country: currentCompany.country,
          phone: currentCompany.phone,
          email: currentCompany.email,
        } : undefined
      );

      toast({
        title: 'Success',
        description: 'PDF downloaded successfully',
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to download PDF',
        variant: 'destructive',
      });
    } finally {
      setDownloading(null);
    }
  };

  const handleEditClick = (boq: LCLBOQRecord) => {
    setSelectedBoq(boq);
    setShowEditModal(true);
  };

  const handleDeleteClick = (boqId: string) => {
    setShowDeleteConfirm(boqId);
  };

  const handleConfirmDelete = async () => {
    if (!showDeleteConfirm) return;

    try {
      // Check if BOQ is linked to an invoice
      const boqToDelete = boqs.find((b) => b.id === showDeleteConfirm);
      if (boqToDelete?.boq_id) {
        // Check if boq_id has any linked invoices
        // For now, we'll just warn the user
        toast({
          title: 'Warning',
          description:
            'This BOQ is linked to an invoice. Deletion may affect invoice records.',
        });
      }

      await lclBoqService.deleteLCLBOQ(showDeleteConfirm);
      setBoqs((prev) => prev.filter((b) => b.id !== showDeleteConfirm));
      setShowDeleteConfirm(null);

      toast({
        title: 'Success',
        description: 'LCL BOQ deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting BOQ:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to delete BOQ',
        variant: 'destructive',
      });
    }
  };

  const handleEditSaved = async () => {
    setShowEditModal(false);
    await loadBoqs();
  };

  const filteredBoqs = boqs.filter((boq) => {
    const searchLower = searchText.toLowerCase();
    const customerName = getCustomerName(boq.customer_id);
    return (
      boq.number.toLowerCase().includes(searchLower) ||
      customerName.toLowerCase().includes(searchLower) ||
      (boq.project_title || '').toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Loading LCL BOQs...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-foreground">LCL BOQ List</h1>
        <Button
          onClick={() => window.location.href = '/lcl-template'}
          variant="default"
        >
          Create New BOQ
        </Button>
      </div>

      <div className="flex items-center gap-2 max-w-md">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by BOQ number, customer, or project..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="flex-1"
        />
      </div>

      {filteredBoqs.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          {searchText
            ? 'No BOQs match your search'
            : 'No LCL BOQs created yet'}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>BOQ Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Project Title</TableHead>
                <TableHead>BOQ Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBoqs.map((boq) => (
                <TableRow key={boq.id}>
                  <TableCell className="font-medium">{boq.number}</TableCell>
                  <TableCell>{getCustomerName(boq.customer_id)}</TableCell>
                  <TableCell>{boq.project_title || '-'}</TableCell>
                  <TableCell>
                    {boq.boq_date
                      ? new Date(boq.boq_date).toLocaleDateString()
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        boq.status === 'saved'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {boq.status || 'saved'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditClick(boq)}
                        title="Edit BOQ"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDownloadPDF(boq)}
                        disabled={downloading === boq.id}
                        title="Download PDF"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteClick(boq.id || '')}
                        title="Delete BOQ"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {selectedBoq && (
        <EditLCLBOQModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          boq={selectedBoq}
          onSaved={handleEditSaved}
          templateStructure={templateStructure}
        />
      )}

      <ConfirmationDialog
        open={showDeleteConfirm !== null}
        onCancel={() => setShowDeleteConfirm(null)}
        title="Delete LCL BOQ"
        description="Are you sure you want to delete this LCL BOQ? This action cannot be undone."
        onConfirm={handleConfirmDelete}
        confirmText="Delete"
      />
    </div>
  );
}
