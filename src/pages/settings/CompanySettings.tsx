import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { DatabaseSchemaInitializer } from '@/components/setup/DatabaseSchemaInitializer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CURRENCY_SELECT_OPTIONS } from '@/utils/getCurrencySelectOptions';
import { Building2, Save, Upload, Plus, Trash2, Edit, Check, X, Image, AlertTriangle, AlertCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCompanies, useUpdateCompany, useCreateCompany, useTaxSettings, useCreateTaxSetting, useUpdateTaxSetting, useDeleteTaxSetting } from '@/hooks/useDatabase';
import { useAuth } from '@/contexts/AuthContext';
import { hasFeature } from '@/utils/rolePermissions';
import type { UserRole } from '@/utils/rolePermissions';
import { toast } from 'sonner';
import { ForceTaxSettings } from '@/components/ForceTaxSettings';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { supabase } from '@/integrations/supabase/client';
import { getUserFriendlyMessage, logError } from '@/utils/errorParser';
import { parseErrorMessage } from '@/utils/errorHelpers';
import { QuickSchemaFix } from '@/components/QuickSchemaFix';
import { addCurrencyColumn, ADD_CURRENCY_COLUMN_SQL } from '@/utils/addCurrencyColumn';

export default function CompanySettings() {
  const { profile, loading: authLoading, isAuthenticated, permissions } = useAuth();
  const role = (profile?.role || 'user') as UserRole;
  const [editingTax, setEditingTax] = useState<string | null>(null);
  const [newTax, setNewTax] = useState({ name: '', rate: 0, is_default: false });
  const [showNewTaxForm, setShowNewTaxForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [fixingCurrency, setFixingCurrency] = useState(false);
  const [testingStorage, setTestingStorage] = useState(false);
  const [storageStatus, setStorageStatus] = useState<'unknown' | 'available' | 'unavailable'>('unknown');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; taxId?: string; taxName?: string }>({ open: false });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [companyData, setCompanyData] = useState({
    name: 'Layons Construction Limited',
    registration_number: '',
    tax_number: 'P051658002D',
    email: 'layonscoltd@gmail.com',
    phone: 'Tel: 0741 207 690/0780 165 490',
    address: 'P.O Box 85988-00200\nNairobi, Kenya',
    city: 'Nairobi',
    state: '',
    postal_code: '00200',
    country: 'Kenya',
    currency: 'KES',
    fiscal_year_start: 1,
    logo_url: '',
    header_image: '',
    stamp_image: '',
    company_services: ''
  });

  const { data: companies, isLoading: companiesLoading, error: companiesError } = useCompanies();
  const currentCompany = companies?.[0]; // Assuming single company for now
  const { data: taxSettings, isLoading: taxSettingsLoading, error: taxSettingsError } = useTaxSettings(currentCompany?.id);
  const updateCompany = useUpdateCompany();
  const createCompany = useCreateCompany();
  const createTaxSetting = useCreateTaxSetting();
  const updateTaxSetting = useUpdateTaxSetting();
  const deleteTaxSetting = useDeleteTaxSetting();

  // Debug logging and schema check
  useEffect(() => {
    // Check for schema errors in the companies query
    if (companiesError) {
      const errorString = String(companiesError);
      if (errorString.includes('fiscal_year_start') && (errorString.includes('column') || errorString.includes('schema cache'))) {
        setSchemaError('fiscal_year_start column missing');
      } else if (errorString.includes('currency') && (errorString.includes('column') || errorString.includes('schema cache'))) {
        setSchemaError('currency column missing');
      } else if (errorString.includes('registration_number') && errorString.includes('column')) {
        setSchemaError('registration_number column missing');
      }
    }
  }, [companies, companiesLoading, companiesError, currentCompany, taxSettings, taxSettingsLoading, taxSettingsError]);

  useEffect(() => {
    if (currentCompany) {
      setCompanyData({
        name: currentCompany.name || '',
        registration_number: currentCompany.registration_number || '',
        tax_number: currentCompany.tax_number || '',
        email: currentCompany.email || '',
        phone: currentCompany.phone || '',
        address: currentCompany.address || '',
        city: currentCompany.city || '',
        state: currentCompany.state || '',
        postal_code: currentCompany.postal_code || '',
        country: currentCompany.country || 'Kenya',
        currency: currentCompany.currency || 'KES',
        fiscal_year_start: currentCompany.fiscal_year_start || 1,
        logo_url: currentCompany.logo_url || '',
        header_image: currentCompany.header_image || '',
        stamp_image: currentCompany.stamp_image || '',
        company_services: currentCompany.company_services || ''
      });
    }
  }, [currentCompany]);

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentCompany) return;

    // Enhanced validation
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validImageTypes.includes(file.type)) {
      toast.error('Please select a valid image file (PNG, JPG, GIF, or WebP)');
      return;
    }

    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      // Try multiple upload strategies
      let logoUrl: string | null = null;

      // Strategy 1: Try Supabase Storage
      try {
        logoUrl = await uploadToSupabaseStorage(file, currentCompany.id);
        console.log('✅ Supabase storage upload successful');
      } catch (storageError) {
        console.warn('⚠️ Supabase storage failed:', storageError);

        // Strategy 2: Fallback to base64 for smaller files
        if (file.size <= 1024 * 1024) { // 1MB limit for base64
          logoUrl = await convertToBase64(file);
          console.log('✅ Base64 fallback successful');
          toast.info('Logo saved locally (storage not available)');
        } else {
          throw new Error('File too large for local storage. Please use a smaller image or configure cloud storage.');
        }
      }

      if (!logoUrl) {
        throw new Error('Failed to process logo upload');
      }

      // Update local state & persist using existing hook
      setCompanyData(prev => ({ ...prev, logo_url: logoUrl }));
      await updateCompany.mutateAsync({ id: currentCompany.id, logo_url: logoUrl });

      toast.success('Logo uploaded and saved successfully!');
    } catch (err: any) {
      // Use centralized error parsing and logging for file upload
      logError(err, 'Logo Upload');
      let userMessage = getUserFriendlyMessage(err, 'Failed to upload logo');

      // Add specific handling for different error types
      if (userMessage.includes('company-logos') || userMessage.includes('bucket')) {
        userMessage = 'Cloud storage not configured. Using local storage for smaller files (max 1MB).';

        // Auto-retry with base64 for small files
        if (file.size <= 1024 * 1024) {
          try {
            const base64Url = await convertToBase64(file);
            setCompanyData(prev => ({ ...prev, logo_url: base64Url }));
            await updateCompany.mutateAsync({ id: currentCompany.id, logo_url: base64Url });
            toast.success('Logo saved locally!');
            return;
          } catch (base64Error) {
            userMessage = 'Failed to save logo. Please try again with a smaller file.';
          }
        }
      }

      toast.error(userMessage);
    } finally {
      setUploading(false);
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handler for header image upload
  const handleHeaderImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!currentCompany) {
      toast.error('Company not loaded');
      return;
    }

    setUploading(true);
    try {
      let headerImageUrl: string | null = null;

      try {
        headerImageUrl = await uploadToSupabaseStorage(file, currentCompany.id);
        console.log('✅ Supabase storage upload successful');
        setStorageStatus('available');
      } catch (storageError) {
        const errorMsg = storageError instanceof Error ? storageError.message : String(storageError);
        console.warn('⚠️ Supabase storage failed:', errorMsg);

        // Mark storage as unavailable if network error
        if (errorMsg.includes('Failed to fetch') || errorMsg.includes('Network')) {
          setStorageStatus('unavailable');
        }

        if (file.size <= 1024 * 1024) {
          headerImageUrl = await convertToBase64(file);
          console.log('✅ Base64 fallback successful');
          toast.info('Header image saved locally (cloud storage not available)');
        } else {
          throw new Error('File too large for local storage. Please use a smaller image or configure cloud storage.');
        }
      }

      if (!headerImageUrl) {
        throw new Error('Failed to process header image upload');
      }

      setCompanyData(prev => ({ ...prev, header_image: headerImageUrl }));
      await updateCompany.mutateAsync({ id: currentCompany.id, header_image: headerImageUrl });

      toast.success('Header image uploaded and saved successfully!');
    } catch (err: any) {
      logError(err, 'Header Image Upload');
      let userMessage = getUserFriendlyMessage(err, 'Failed to upload header image');

      if (userMessage.includes('company-logos') || userMessage.includes('bucket') || userMessage.includes('cloud storage')) {
        userMessage = 'Cloud storage not configured. Using local storage for smaller files (max 1MB).';

        if (file.size <= 1024 * 1024) {
          try {
            const base64Url = await convertToBase64(file);
            setCompanyData(prev => ({ ...prev, header_image: base64Url }));
            await updateCompany.mutateAsync({ id: currentCompany.id, header_image: base64Url });
            toast.success('Header image saved locally!');
            return;
          } catch (base64Error) {
            userMessage = 'Failed to save header image. Please try again with a smaller file.';
          }
        }
      }

      toast.error(userMessage);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handler for stamp image upload
  const handleStampImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!currentCompany) {
      toast.error('Company not loaded');
      return;
    }

    setUploading(true);
    try {
      let stampImageUrl: string | null = null;

      try {
        stampImageUrl = await uploadToSupabaseStorage(file, currentCompany.id);
        console.log('✅ Supabase storage upload successful');
        setStorageStatus('available');
      } catch (storageError) {
        const errorMsg = storageError instanceof Error ? storageError.message : String(storageError);
        console.warn('⚠️ Supabase storage failed:', errorMsg);

        // Mark storage as unavailable if network error
        if (errorMsg.includes('Failed to fetch') || errorMsg.includes('Network')) {
          setStorageStatus('unavailable');
        }

        if (file.size <= 1024 * 1024) {
          stampImageUrl = await convertToBase64(file);
          console.log('✅ Base64 fallback successful');
          toast.info('Stamp image saved locally (cloud storage not available)');
        } else {
          throw new Error('File too large for local storage. Please use a smaller image or configure cloud storage.');
        }
      }

      if (!stampImageUrl) {
        throw new Error('Failed to process stamp image upload');
      }

      setCompanyData(prev => ({ ...prev, stamp_image: stampImageUrl }));
      await updateCompany.mutateAsync({ id: currentCompany.id, stamp_image: stampImageUrl });

      toast.success('Stamp image uploaded and saved successfully!');
    } catch (err: any) {
      logError(err, 'Stamp Image Upload');
      let userMessage = getUserFriendlyMessage(err, 'Failed to upload stamp image');

      if (userMessage.includes('company-logos') || userMessage.includes('bucket') || userMessage.includes('cloud storage')) {
        userMessage = 'Cloud storage not configured. Using local storage for smaller files (max 1MB).';

        if (file.size <= 1024 * 1024) {
          try {
            const base64Url = await convertToBase64(file);
            setCompanyData(prev => ({ ...prev, stamp_image: base64Url }));
            await updateCompany.mutateAsync({ id: currentCompany.id, stamp_image: base64Url });
            toast.success('Stamp image saved locally!');
            return;
          } catch (base64Error) {
            userMessage = 'Failed to save stamp image. Please try again with a smaller file.';
          }
        }
      }

      toast.error(userMessage);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Helper function to upload to Supabase Storage
  const uploadToSupabaseStorage = async (file: File, companyId: string): Promise<string> => {
    // Get file extension safely
    const fileNameParts = file.name.split('.');
    const ext = fileNameParts.length > 1 ? fileNameParts.pop() : 'png';
    const filePath = `company-${companyId}/logo-${Date.now()}.${ext}`;

    const bucketName = import.meta.env.VITE_COMPANY_LOGO_BUCKET || 'company-logos';

    // Upload the file directly to configured bucket (skip bucket listing as it requires admin)
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type
      });

    if (uploadError) {
      // Handle RLS permission errors during upload
      if (uploadError.message.includes('row-level security') ||
          uploadError.message.includes('permission') ||
          uploadError.message.includes('policy')) {
        throw new Error('You don\'t have permission to upload to cloud storage. Please use local storage or contact your administrator.');
      }
      // Catch network errors and bucket not found errors
      if (uploadError.message.includes('Failed to fetch') ||
          uploadError.message.includes('does not exist') ||
          uploadError.message.includes('Not Found')) {
        throw new Error('Cloud storage bucket not found or not accessible. Using local storage instead.');
      }
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase
      .storage
      .from(bucketName)
      .getPublicUrl(filePath);

    if (!publicUrlData.publicUrl) {
      throw new Error('Failed to get public URL for uploaded file');
    }

    return publicUrlData.publicUrl;
  };

  // Helper function to convert file to base64
  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = () => reject(new Error('File reading failed'));
      reader.readAsDataURL(file);
    });
  };

  // Test storage availability
  const testStorageAvailability = async () => {
    setTestingStorage(true);
    try {
      const bucketName = import.meta.env.VITE_COMPANY_LOGO_BUCKET || 'company-logos';
      // Client apps cannot list buckets; instead, try listing the configured bucket directly
      const { error: listError } = await supabase.storage
        .from(bucketName)
        .list('', { limit: 1 });

      if (listError) {
        const msg = listError.message || '';
        if (msg.includes('Not Found') || msg.includes('does not exist') || msg.includes('No such file or directory')) {
          setStorageStatus('unavailable');
          toast.info(`Cloud storage bucket "${bucketName}" not found or not accessible from this client.`);
          return;
        }
        if (msg.includes('row-level security') || msg.includes('permission') || msg.includes('policy') || msg.includes('Forbidden')) {
          setStorageStatus('unavailable');
          toast.warning('Cloud storage bucket exists but access is restricted. Using local storage.');
          return;
        }
        if (msg.includes('Failed to fetch') || msg.includes('Network')) {
          setStorageStatus('unavailable');
          toast.warning('Network issue connecting to cloud storage. Using local storage (max 1MB).');
          return;
        }
        // Any other error -> treat as unavailable but do not hard fail
        setStorageStatus('unavailable');
        toast.warning('Cloud storage not available. Using local storage.');
        return;
      }

      // Bucket is accessible
      setStorageStatus('available');
      toast.success('Cloud storage is available and ready to use!');
    } catch (error) {
      console.warn('Storage test warning:', error instanceof Error ? error.message : String(error));
      setStorageStatus('unavailable');

      // Provide specific error messages based on error type
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('row-level security') ||
          errorMessage.includes('permission') ||
          errorMessage.includes('policy')) {
        toast.info('Cloud storage requires admin setup. Using local storage (max 1MB) for now.');
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network')) {
        toast.warning('Network issue connecting to cloud storage. Using local storage (max 1MB).');
      } else {
        toast.warning('Cloud storage not available. Logo uploads will use local storage (max 1MB).');
      }
    } finally {
      setTestingStorage(false);
    }
  };

  // Test storage on component mount
  useEffect(() => {
    if (currentCompany && storageStatus === 'unknown') {
      testStorageAvailability();
    }
  }, [currentCompany, storageStatus]);

  const validateCompanyData = (data: any) => {
    const errors = [];

    // Required fields
    if (!data.name || !data.name.trim()) {
      errors.push('Company name is required');
    } else if (data.name.length > 255) {
      errors.push('Company name must be less than 255 characters');
    }

    // Email validation
    if (data.email && data.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        errors.push('Please enter a valid email address');
      } else if (data.email.length > 255) {
        errors.push('Email must be less than 255 characters');
      }
    }

    // Length validations for other fields
    if (data.registration_number && data.registration_number.length > 100) {
      errors.push('Registration number must be less than 100 characters');
    }
    if (data.tax_number && data.tax_number.length > 100) {
      errors.push('Tax number must be less than 100 characters');
    }
    if (data.phone && data.phone.length > 50) {
      errors.push('Phone number must be less than 50 characters');
    }
    if (data.city && data.city.length > 100) {
      errors.push('City must be less than 100 characters');
    }
    if (data.state && data.state.length > 100) {
      errors.push('State must be less than 100 characters');
    }
    if (data.postal_code && data.postal_code.length > 20) {
      errors.push('Postal code must be less than 20 characters');
    }
    if (data.country && data.country.length > 100) {
      errors.push('Country must be less than 100 characters');
    }
    if (data.currency && data.currency.length > 3) {
      errors.push('Currency code must be 3 characters or less');
    }

    // Fiscal year validation
    if (data.fiscal_year_start && (data.fiscal_year_start < 1 || data.fiscal_year_start > 12)) {
      errors.push('Fiscal year start must be between 1 and 12');
    }

    return errors;
  };


  const fixCurrencyColumn = async () => {
    setFixingCurrency(true);
    try {
      const result = await addCurrencyColumn();
      if (result.success) {
        toast.success('Currency column added! You can now save company settings.');
        setSchemaError(null);
      } else {
        toast.error(result.message);
        // Copy SQL to clipboard for manual execution
        navigator.clipboard.writeText(ADD_CURRENCY_COLUMN_SQL);
        toast.info('SQL copied to clipboard for manual execution');
      }
    } catch (error) {
      toast.error('Failed to add currency column');
    } finally {
      setFixingCurrency(false);
    }
  };

  const handleSaveCompany = async () => {

    // Comprehensive validation
    const validationErrors = validateCompanyData(companyData);
    if (validationErrors.length > 0) {
      toast.error(`Validation failed: ${validationErrors[0]}`);
      return;
    }

    try {
      // Sanitize and prepare company data to match database schema
      const sanitizedData: any = {
        name: companyData.name?.trim() || '',
        tax_number: companyData.tax_number?.trim() || null,
        email: companyData.email?.trim() || null,
        phone: companyData.phone?.trim() || null,
        address: companyData.address?.trim() || null,
        city: companyData.city?.trim() || null,
        state: companyData.state?.trim() || null,
        postal_code: companyData.postal_code?.trim() || null,
        country: companyData.country?.trim() || 'Kenya',
        logo_url: companyData.logo_url?.trim() || null,
        header_image: companyData.header_image?.trim() || null,
        stamp_image: companyData.stamp_image?.trim() || null,
        company_services: companyData.company_services?.trim() || null
      };

      // Only include optional columns if they might exist in the database
      // This prevents errors when the schema hasn't been fully migrated
      if (companyData.registration_number?.trim()) {
        sanitizedData.registration_number = companyData.registration_number.trim();
      }
      if (companyData.currency?.trim()) {
        sanitizedData.currency = companyData.currency.trim();
      }
      if (companyData.fiscal_year_start) {
        sanitizedData.fiscal_year_start = companyData.fiscal_year_start;
      }

      // Remove empty strings and convert to null for optional fields
      Object.keys(sanitizedData).forEach(key => {
        if (key !== 'name' && key !== 'country' && key !== 'currency' && key !== 'fiscal_year_start') {
          if (sanitizedData[key] === '' || sanitizedData[key] === undefined) {
            sanitizedData[key] = null;
          }
        }
      });

      // Ensure company_services is null if empty
      if (!sanitizedData.company_services) {
        sanitizedData.company_services = null;
      }


      if (!currentCompany) {
        // Create a new company if none exists
        await createCompany.mutateAsync(sanitizedData);
        toast.success('Company created successfully');
      } else {
        // Update existing company
        await updateCompany.mutateAsync({
          id: currentCompany.id,
          ...sanitizedData
        });
        toast.success('Company settings saved successfully');
      }
    } catch (error) {
      // Use centralized error parsing and logging
      logError(error, 'Company Save');
      const userMessage = getUserFriendlyMessage(error, 'Failed to save company settings');

      // Check if this is a schema error
      const errorString = String(error);
      if (errorString.includes('fiscal_year_start') && (errorString.includes('column') || errorString.includes('schema cache'))) {
        setSchemaError('fiscal_year_start column missing');
      } else if (errorString.includes('currency') && (errorString.includes('column') || errorString.includes('schema cache'))) {
        setSchemaError('currency column missing');
      } else if (errorString.includes('registration_number') && errorString.includes('column')) {
        setSchemaError('registration_number column missing');
      }

      toast.error(userMessage);
    }
  };

  const handleCreateTax = async () => {
    if (!currentCompany) {
      toast.error('No company found. Please create a company first.');
      return;
    }

    if (!newTax.name.trim()) {
      toast.error('Please enter a tax name');
      return;
    }

    if (newTax.rate <= 0) {
      toast.error('Please enter a valid tax rate greater than 0');
      return;
    }


    try {
      await createTaxSetting.mutateAsync({
        company_id: currentCompany.id,
        name: newTax.name.trim(),
        rate: newTax.rate,
        is_active: true,
        is_default: newTax.is_default
      });

      setNewTax({ name: '', rate: 0, is_default: false });
      setShowNewTaxForm(false);
      toast.success(`Tax setting "${newTax.name}" created successfully!`);
    } catch (error) {
      console.error('Tax creation error:', error);

      let errorMessage = 'Unknown error occurred';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object') {
        // Handle Supabase error objects
        const supabaseError = error as any;
        if (supabaseError.message) {
          errorMessage = supabaseError.message;
        } else if (supabaseError.details) {
          errorMessage = supabaseError.details;
        } else if (supabaseError.hint) {
          errorMessage = supabaseError.hint;
        } else {
          errorMessage = JSON.stringify(error);
        }
      }

      // Check if it's a table missing error
      if (errorMessage.includes('tax_settings') && (errorMessage.includes('does not exist') || errorMessage.includes('relation') || errorMessage.includes('table'))) {
        toast.error('Tax settings table does not exist. Please create the table first using the migration runner above.');
      } else {
        toast.error(`Failed to create tax setting: ${errorMessage}`);
      }
    }
  };

  const handleUpdateTax = async (taxId: string, updates: any) => {
    try {
      await updateTaxSetting.mutateAsync({
        id: taxId,
        ...updates
      });
      setEditingTax(null);
      toast.success('Tax setting updated successfully');
    } catch (error) {
      console.error('Tax update error:', error);

      let errorMessage = 'Unknown error occurred';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object') {
        const supabaseError = error as any;
        if (supabaseError.message) {
          errorMessage = supabaseError.message;
        } else if (supabaseError.details) {
          errorMessage = supabaseError.details;
        } else if (supabaseError.hint) {
          errorMessage = supabaseError.hint;
        } else {
          errorMessage = JSON.stringify(error);
        }
      }

      toast.error(`Failed to update tax setting: ${errorMessage}`);
    }
  };

  const handleDeleteClick = (taxId: string, taxName: string) => {
    setDeleteDialog({ open: true, taxId, taxName });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.taxId) return;

    try {
      await deleteTaxSetting.mutateAsync(deleteDialog.taxId);
      toast.success('Tax setting deleted successfully');
      setDeleteDialog({ open: false });
    } catch (error) {
      console.error('Tax deletion error:', error);

      let errorMessage = 'Unknown error occurred';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error && typeof error === 'object') {
        const supabaseError = error as any;
        if (supabaseError.message) {
          errorMessage = supabaseError.message;
        } else if (supabaseError.details) {
          errorMessage = supabaseError.details;
        } else if (supabaseError.hint) {
          errorMessage = supabaseError.hint;
        } else {
          errorMessage = JSON.stringify(error);
        }
      }

      toast.error(`Failed to delete tax setting: ${errorMessage}`);
    }
  };

  if (authLoading || companiesLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Loading company settings...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Please sign in again to view company settings.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!hasFeature(role, 'settings-company', permissions)) {
    return (
      <div className="space-y-6 p-6">
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-900">
            You don't have permission to access Settings.
          </AlertDescription>
        </Alert>
        <Card>
          <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
          <CardContent>
            <p className="text-slate-600">You don't have permission to view or manage settings. Please contact your administrator if you believe this is an error.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (companiesError) {
    const errorMessage = parseErrorMessage(companiesError);
    const isSchemaError = schemaError !== null;
    return (
      <div className="space-y-6 p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {isSchemaError
              ? `Company settings could not load because ${schemaError}. Apply the database migration and try again.`
              : `Company settings could not load: ${errorMessage}`}
          </AlertDescription>
        </Alert>
        <p className="text-sm text-muted-foreground">Check your connection and permissions, then reload the page.</p>
      </div>
    );
  }

  if (!currentCompany) {
    return (
      <div className="p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No company is configured for this account. Create a company before editing settings.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Company Settings</h1>
          <p className="text-muted-foreground">
            Manage company information and preferences
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary-gradient" size="lg" onClick={handleSaveCompany}>
            <Save className="h-4 w-4" />
            Save Settings
          </Button>
        </div>
      </div>

      {taxSettingsError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Tax settings could not load: {parseErrorMessage(taxSettingsError)}</AlertDescription>
        </Alert>
      )}

      {/* Simple Currency Column Fix - Show when schema errors are detected */}
      {schemaError && !companiesError && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <span className="font-medium text-orange-800">
                Currency column missing from companies table
              </span>
            </div>
            <Button
              onClick={fixCurrencyColumn}
              disabled={fixingCurrency}
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {fixingCurrency ? 'Adding...' : 'Add Currency Column'}
            </Button>
          </div>
          <p className="text-sm text-orange-700 mt-2">
            Click the button to add the missing currency column to the database.
          </p>
        </div>
      )}

      <div className="grid gap-6">
        {/* Company Information */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building2 className="h-5 w-5" />
              <span>Company Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  value={companyData.name || ''}
                  onChange={(e) => setCompanyData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax-id">Tax ID / Registration Number</Label>
                <Input
                  id="tax-id"
                  value={companyData.registration_number || ''}
                  onChange={(e) => setCompanyData(prev => ({ ...prev, registration_number: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={companyData.address || ''}
                onChange={(e) => setCompanyData(prev => ({ ...prev, address: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-services">Services/Description (appears in PDFs)</Label>
              <Textarea
                id="company-services"
                value={companyData.company_services || ''}
                onChange={(e) => setCompanyData(prev => ({ ...prev, company_services: e.target.value }))}
                rows={3}
                placeholder="e.g., BUILDING WORKS, RENOVATIONS, ROAD WORKS, LANDSCAPING, ELECTRICAL WORKS, WATER WORKS,"
              />
              <p className="text-xs text-muted-foreground">This text will appear at the top of all quotation and invoice PDFs.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={companyData.phone || ''}
                  onChange={(e) => setCompanyData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={companyData.email || ''}
                  onChange={(e) => setCompanyData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax-number">PIN/Tax Number</Label>
                <Input
                  id="tax-number"
                  value={companyData.tax_number || ''}
                  onChange={(e) => setCompanyData(prev => ({ ...prev, tax_number: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logo & Branding */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Logo & Branding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-6">
              <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center overflow-hidden border-2 border-dashed border-muted-foreground/25 relative">
                {uploading ? (
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <span className="text-xs mt-1">Uploading...</span>
                  </div>
                ) : companyData.logo_url ? (
                  <img
                    src={companyData.logo_url}
                    alt="Company Logo"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      console.error('Logo failed to load:', companyData.logo_url);
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      // Show fallback
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = `
                          <div class="flex flex-col items-center justify-center text-muted-foreground">
                            <svg class="h-6 w-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                            <span class="text-xs">Load Failed</span>
                          </div>
                        `;
                      }
                    }}
                    onLoad={() => {
                      console.log('Logo loaded successfully');
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Image className="h-6 w-6 mb-1" />
                    <span className="text-xs">No Logo</span>
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Company Logo</Label>
                    <div className="flex items-center gap-2">
                      <Badge variant={storageStatus === 'available' ? 'success' :
                                    storageStatus === 'unavailable' ? 'warning' : 'outline'}>
                        {storageStatus === 'available' && '✓ Cloud Ready'}
                        {storageStatus === 'unavailable' && '⚠ Local Storage'}
                        {storageStatus === 'unknown' && '⏳ Testing...'}
                      </Badge>
                      {storageStatus === 'unavailable' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={testStorageAvailability}
                          disabled={testingStorage}
                          className="text-xs h-6 px-2"
                        >
                          {testingStorage ? 'Testing...' : 'Retry'}
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload your company logo. Recommended size: 200x200px, max 5MB. Supports PNG, JPG, GIF, WebP.
                    {storageStatus === 'available' && ' Cloud storage is configured and ready for any file size.'}
                    {storageStatus === 'unavailable' && ' Cloud storage not configured - files ≤1MB stored locally. Larger files need cloud storage setup.'}
                    {storageStatus === 'unknown' && ' Checking storage configuration...'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <Button
                    variant="outline"
                    onClick={handleChooseFile}
                    disabled={uploading}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {uploading ? 'Uploading...' : 'Upload Logo'}
                  </Button>
                  {companyData.logo_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCompanyData(prev => ({ ...prev, logo_url: '' }));
                        toast.success('Logo removed. Click Save Settings to apply changes.');
                      }}
                      className="text-destructive hover:text-destructive"
                    >
                      Remove Logo
                    </Button>
                  )}
                </div>
                {companyData.logo_url && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Current: {companyData.logo_url.startsWith('data:') ? 'Local storage (Base64)' : 'Cloud storage'}
                    </p>
                    {companyData.logo_url.startsWith('data:') && (
                      <div className="text-xs text-orange-600 space-y-1">
                        <p>Note: Logo is stored locally. For production use, consider setting up cloud storage.</p>
                        {storageStatus === 'unavailable' && (
                          <details className="cursor-pointer">
                            <summary className="hover:text-orange-700">View cloud storage setup instructions</summary>
                            <div className="mt-2 p-2 bg-orange-50 rounded text-orange-800 space-y-2">
                              <div>
                                <p className="font-medium">Option 1: Create storage bucket (Admin required)</p>
                                <ol className="list-decimal list-inside space-y-1 text-xs mt-1">
                                  <li>Go to your Supabase dashboard</li>
                                  <li>Navigate to Storage section</li>
                                  <li>Create a new bucket named "company-logos"</li>
                                  <li>Set as Public bucket with 5MB file size limit</li>
                                  <li>Allow MIME types: image/jpeg, image/png, image/gif, image/webp</li>
                                  <li>Configure RLS policies to allow authenticated users to upload</li>
                                  <li>Click "Retry" button above to test</li>
                                </ol>
                              </div>
                              <div className="border-t pt-2">
                                <p className="font-medium">Option 2: Use local storage (Current)</p>
                                <p className="text-xs">Files up to 1MB are stored as base64 data. This works for most logos but files won't be accessible via direct URLs.</p>
                              </div>
                              <div className="border-t pt-2">
                                <p className="font-medium">RLS Policy Example:</p>
                                <code className="text-xs bg-orange-100 p-1 rounded block mt-1">
                                  CREATE POLICY "Authenticated users can upload logos" ON storage.objects
                                  FOR INSERT TO authenticated
                                  WITH CHECK (bucket_id = 'company-logos');
                                </code>
                              </div>
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PDF Header Image */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              PDF Header Image
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a header image to display at the top of quotations, invoices, and BOQ PDFs
            </p>
            <div className="space-y-4">
              {companyData.header_image ? (
                <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                  <img
                    src={companyData.header_image}
                    alt="PDF Header"
                    className="h-24 object-contain"
                    onError={(e) => {
                      console.error('Header image failed to load:', companyData.header_image);
                      const target = e.target as HTMLImageElement;
                      target.src = '';
                    }}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Header image configured</p>
                    <p className="text-xs text-muted-foreground">
                      {companyData.header_image.startsWith('data:') ? 'Local storage (Base64)' : 'Cloud storage'}
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                  onChange={handleHeaderImageUpload}
                  style={{ display: 'none' }}
                  id="header-image-input"
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('header-image-input')?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? 'Uploading...' : 'Upload Header Image'}
                </Button>
                {companyData.header_image && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCompanyData(prev => ({ ...prev, header_image: '' }));
                      toast.success('Header image removed. Click Save Settings to apply changes.');
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    Remove Header Image
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PDF Stamp Image */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              PDF Stamp Image
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a company stamp image to display on quotations, invoices, and BOQ PDFs
            </p>
            <div className="space-y-4">
              {companyData.stamp_image ? (
                <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                  <img
                    src={companyData.stamp_image}
                    alt="PDF Stamp"
                    className="h-24 object-contain"
                    onError={(e) => {
                      console.error('Stamp image failed to load:', companyData.stamp_image);
                      const target = e.target as HTMLImageElement;
                      target.src = '';
                    }}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Stamp image configured</p>
                    <p className="text-xs text-muted-foreground">
                      {companyData.stamp_image.startsWith('data:') ? 'Local storage (Base64)' : 'Cloud storage'}
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                  onChange={handleStampImageUpload}
                  style={{ display: 'none' }}
                  id="stamp-image-input"
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('stamp-image-input')?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? 'Uploading...' : 'Upload Stamp Image'}
                </Button>
                {companyData.stamp_image && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCompanyData(prev => ({ ...prev, stamp_image: '' }));
                      toast.success('Stamp image removed. Click Save Settings to apply changes.');
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    Remove Stamp Image
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Default Settings */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Default Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="currency">Default Currency</Label>
                <Select value={companyData.currency || 'KES'} onValueChange={(value) => setCompanyData(prev => ({ ...prev, currency: value }))}>
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_SELECT_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fiscal-year">Fiscal Year Start (Month)</Label>
                <Input
                  id="fiscal-year"
                  type="number"
                  min="1"
                  max="12"
                  value={companyData.fiscal_year_start || 1}
                  onChange={(e) => setCompanyData(prev => ({ ...prev, fiscal_year_start: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={companyData.city || ''}
                  onChange={(e) => setCompanyData(prev => ({ ...prev, city: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={companyData.country || ''}
                  onChange={(e) => setCompanyData(prev => ({ ...prev, country: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="state">State/Province</Label>
                <Input
                  id="state"
                  value={companyData.state || ''}
                  onChange={(e) => setCompanyData(prev => ({ ...prev, state: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postal-code">Postal Code</Label>
                <Input
                  id="postal-code"
                  value={companyData.postal_code || ''}
                  onChange={(e) => setCompanyData(prev => ({ ...prev, postal_code: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tax Settings - Force Implementation */}
        {currentCompany && (
          <ForceTaxSettings companyId={currentCompany.id} />
        )}

      </div>

      <ConfirmationDialog
        open={deleteDialog.open}
        title="Delete Tax Setting"
        description={deleteDialog.taxName ? `Are you sure you want to delete tax setting "${deleteDialog.taxName}"?` : ''}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialog({ open: false })}
        confirmText="Delete"
      />
    </div>
  );
}

// Tax Edit Form Component
interface TaxEditFormProps {
  tax: any;
  onSave: (updates: any) => void;
  onCancel: () => void;
}

function TaxEditForm({ tax, onSave, onCancel }: TaxEditFormProps) {
  const [editData, setEditData] = useState({
    name: tax?.name || '',
    rate: tax?.rate || 0,
    is_active: tax?.is_active || false,
    is_default: tax?.is_default || false
  });

  return (
    <div className="flex-1 grid gap-4 md:grid-cols-4">
      <Input
        value={editData.name || ''}
        onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
      />
      <Input
        type="number"
        step="0.01"
        value={editData.rate || 0}
        onChange={(e) => setEditData(prev => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))}
      />
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Switch
            checked={editData.is_active}
            onCheckedChange={(checked) => setEditData(prev => ({ ...prev, is_active: checked }))}
          />
          <span className="text-sm">Active</span>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            checked={editData.is_default}
            onCheckedChange={(checked) => setEditData(prev => ({ ...prev, is_default: checked }))}
          />
          <span className="text-sm">Default</span>
        </div>
      </div>
      <div className="flex space-x-2">
        <Button size="sm" onClick={() => onSave(editData)}>
          <Check className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
