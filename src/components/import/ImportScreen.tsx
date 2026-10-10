import React, { useState, useRef } from 'react';
import { Upload, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft, Download, RefreshCw, Sparkles, Check } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { MappedFieldData } from '../../types';
import { validateAndDeduplicateRows } from '@/lib/import/validation-engine';

export const ImportScreen: React.FC = () => {
  const { importExcelBatch, navigateTo, policies, customers, metrics, showToast } = useApp();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [, setFileName] = useState<string>('');
  const [, setFileSize] = useState<string>('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);

  // Step 2 Mapping
  const [mappings, setMappings] = useState<Record<string, string>>({
    customerName: '',
    phone: '',
    email: '',
    policyNumber: '',
    insurer: '',
    policyType: '',
    premium: '',
    startDate: '',
    expiryDate: '',
  });

  // Step 3 Review
  const [mappedRows, setMappedRows] = useState<MappedFieldData[]>([]);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update'>('update');
  const [reviewTab, setReviewTab] = useState<'all' | 'valid' | 'warnings' | 'errors'>('all');

  // Step 4 Stats
  const [importResults, setImportResults] = useState<{
    customersAdded: number;
    policiesAdded: number;
    policiesUpdated: number;
  }>({ customersAdded: 0, policiesAdded: 0, policiesUpdated: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Field definitions for PolicyPilot
  const pilotFields: Array<{ key: keyof typeof mappings; label: string; required: boolean }> = [
    { key: 'customerName', label: 'Customer Name', required: true },
    { key: 'phone', label: 'Mobile / Phone', required: true },
    { key: 'policyNumber', label: 'Policy Number', required: true },
    { key: 'insurer', label: 'Insurance Company', required: true },
    { key: 'policyType', label: 'Policy Type', required: true },
    { key: 'premium', label: 'Premium Amount', required: true },
    { key: 'startDate', label: 'Start Date', required: false },
    { key: 'expiryDate', label: 'Expiry Date', required: true },
    { key: 'email', label: 'Email Address', required: false },
  ];

  // Auto-detect columns
  const autoDetectColumns = (headers: string[]) => {
    const newMappings: Record<string, string> = { ...mappings };

    headers.forEach((h) => {
      const lower = h.toLowerCase().trim();
      if (lower.includes('cust') || lower.includes('client') || lower.includes('name')) {
        if (!newMappings.customerName) newMappings.customerName = h;
      } else if (lower.includes('phone') || lower.includes('mobile') || lower.includes('contact') || lower.includes('cell')) {
        if (!newMappings.phone) newMappings.phone = h;
      } else if (lower.includes('mail')) {
        if (!newMappings.email) newMappings.email = h;
      } else if (lower.includes('pol') && (lower.includes('no') || lower.includes('num') || lower.includes('id'))) {
        if (!newMappings.policyNumber) newMappings.policyNumber = h;
      } else if (lower.includes('comp') || lower.includes('insurer') || lower.includes('provider')) {
        if (!newMappings.insurer) newMappings.insurer = h;
      } else if (lower.includes('type') || lower.includes('category') || lower.includes('plan')) {
        if (!newMappings.policyType) newMappings.policyType = h;
      } else if (lower.includes('prem') || lower.includes('amount') || lower.includes('cost') || lower.includes('price')) {
        if (!newMappings.premium) newMappings.premium = h;
      } else if (lower.includes('start') || lower.includes('issue') || lower.includes('from')) {
        if (!newMappings.startDate) newMappings.startDate = h;
      } else if (lower.includes('exp') || lower.includes('due') || lower.includes('end') || lower.includes('to')) {
        if (!newMappings.expiryDate) newMappings.expiryDate = h;
      }
    });

    setMappings(newMappings);
  };

  // Parse Excel / CSV File
  const handleFileUpload = (file: File) => {
    setFileName(file.name);
    setFileSize((file.size / 1024).toFixed(1) + ' KB');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellFormula: false });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

        if (json.length > 0) {
          const headers = Object.keys(json[0]);
          setRawHeaders(headers);
          setRawRows(json);
          autoDetectColumns(headers);
          setCurrentStep(2);
          showToast(`Read ${json.length} records from ${file.name}`, 'info');
        } else {
          showToast('Uploaded spreadsheet contains no rows', 'error');
        }
      } catch {
        showToast('Error reading spreadsheet file', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Load realistic built-in sample data for 1-click test
  const handleLoadSampleDataset = () => {
    const sampleRows = [
      {
        'Customer Name': 'DEMO Customer 01',
        'Mobile': '+91 9000000001',
        'Policy No': 'DEMO-POL-001',
        'Company': 'ICICI Lombard',
        'Policy Type': 'Motor Insurance',
        'Premium': 18500,
        'Start Date': '15 Oct 2025',
        'Expiry Date': '06 Oct 2026',
        'Email': 'demo.5664@example.com',
      },
      {
        'Customer Name': 'DEMO Customer 02',
        'Mobile': '+91 9000000002',
        'Policy No': 'DEMO-POL-002',
        'Company': 'HDFC ERGO',
        'Policy Type': 'Health Insurance',
        'Premium': 32000,
        'Start Date': '22 Oct 2025',
        'Expiry Date': '06 Oct 2026',
        'Email': 'demo.6003@example.com',
      },
      {
        'Customer Name': 'DEMO Customer 03',
        'Mobile': '+91 9000000003',
        'Policy No': 'DEMO-POL-003',
        'Company': 'Bajaj Allianz',
        'Policy Type': 'Motor Insurance',
        'Premium': 11200,
        'Start Date': '06 Oct 2025',
        'Expiry Date': '07 Oct 2026',
        'Email': 'demo.6348@example.com',
      },
      {
        'Customer Name': 'DEMO Customer 04',
        'Mobile': '+91 9000000004',
        'Policy No': 'DEMO-POL-004',
        'Company': 'LIC',
        'Policy Type': 'Life Insurance',
        'Premium': 45000,
        'Start Date': '28 Sep 2025',
        'Expiry Date': '28 Sep 2026',
        'Email': 'demo.6678@example.com',
      },
      {
        'Customer Name': 'DEMO Customer 05',
        'Mobile': '+91 9000000005',
        'Policy No': 'DEMO-POL-005',
        'Company': 'Star Health',
        'Policy Type': 'Health Insurance',
        'Premium': 27800,
        'Start Date': '10 Nov 2025',
        'Expiry Date': '10 Oct 2026',
        'Email': 'demo.7022@example.com',
      },
      {
        'Customer Name': 'DEMO Customer 06',
        'Mobile': '+91 9000000006',
        'Policy No': 'DEMO-POL-006',
        'Company': 'Tata AIG',
        'Policy Type': 'Motor Insurance',
        'Premium': 14200,
        'Start Date': '12 Oct 2025',
        'Expiry Date': '12 Oct 2026',
        'Email': 'demo.7364@example.com',
      },
      {
        'Customer Name': 'DEMO Customer 07',
        'Mobile': '+91 9000000007',
        'Policy No': 'DEMO-POL-007',
        'Company': 'Max Life',
        'Policy Type': 'Life Insurance',
        'Premium': 38000,
        'Start Date': '18 Oct 2025',
        'Expiry Date': '18 Oct 2026',
        'Email': 'demo.7704@example.com',
      },
      {
        'Customer Name': 'DEMO Customer 08',
        'Mobile': '', // intentional warning
        'Policy No': 'DEMO-POL-008',
        'Company': 'Care Health',
        'Policy Type': 'Health Insurance',
        'Premium': 21500,
        'Start Date': '24 Oct 2025',
        'Expiry Date': '24 Oct 2026',
        'Email': 'demo.8057@example.com',
      },
      {
        'Customer Name': 'DEMO Customer 09',
        'Mobile': '+91 9000000008',
        'Policy No': 'DEMO-POL-009',
        'Company': 'HDFC ERGO',
        'Policy Type': 'Motor Insurance',
        'Premium': 0, // intentional warning
        'Start Date': '28 Oct 2025',
        'Expiry Date': '28 Oct 2026',
        'Email': 'demo.8417@example.com',
      },
    ];

    setFileName('Sample_Insurance_Portfolio.xlsx');
    setFileSize('14.2 KB');
    const headers = Object.keys(sampleRows[0]);
    setRawHeaders(headers);
    setRawRows(sampleRows);
    autoDetectColumns(headers);
    setCurrentStep(2);
    showToast('Loaded demo spreadsheet with 9 insurance records', 'success');
  };

  // Download sample spreadsheet template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Customer Name': 'DEMO Customer 01',
        'Mobile': '+91 9000000001',
        'Email': 'demo.8993@example.com',
        'Policy No': 'DEMO-POL-010',
        'Company': 'ICICI Lombard',
        'Policy Type': 'Motor Insurance',
        'Premium': 18500,
        'Start Date': '15 Oct 2025',
        'Expiry Date': '15 Oct 2026',
      },
      {
        'Customer Name': 'DEMO Customer 02',
        'Mobile': '+91 9000000002',
        'Email': 'demo.9337@example.com',
        'Policy No': 'DEMO-POL-011',
        'Company': 'HDFC ERGO',
        'Policy Type': 'Health Insurance',
        'Premium': 32000,
        'Start Date': '22 Oct 2025',
        'Expiry Date': '22 Oct 2026',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'PolicyPilot_Sample_Template.xlsx');
  };

  // Proceed from Step 2 to Step 3 (Process and Validate Rows)
  const proceedToReview = () => {
    const { validatedRows } = validateAndDeduplicateRows(rawRows, {
      customer_name: mappings.customerName, phone: mappings.phone, email: mappings.email,
      policy_number: mappings.policyNumber, insurance_company: mappings.insurer,
      policy_type: mappings.policyType, premium: mappings.premium,
      start_date: mappings.startDate, expiry_date: mappings.expiryDate,
    }, customers.map(c => ({ id: c.id, name: c.name, phone: c.phone, email: c.email })),
    policies.map(p => ({ id: p.id, policy_number: p.policyNumber, customer_id: p.customerId })));
    const processed: MappedFieldData[] = validatedRows.map(row => ({
      customerName: row.customerName, phone: row.phone || '', email: row.email || '',
      policyNumber: row.policyNumber, insurer: row.insuranceCompany, policyType: row.policyType,
      premium: row.premium ?? 0, startDate: row.startDate || '', expiryDate: row.expiryDate || '',
      isValid: row.category !== 'ERROR', issues: [...row.errors.map(e => e.message), ...row.warnings],
      isDuplicate: row.category === 'DUPLICATE', duplicateResolution: duplicateStrategy,
    }));

    setMappedRows(processed);
    setCurrentStep(3);
  };

  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Step 3 Execute Import
  const handleExecuteImport = async () => {
    setImportError(null);
    setIsImporting(true);
    try {
      const results = await importExcelBatch(mappedRows, duplicateStrategy);
      setImportResults(results);
      setCurrentStep(4);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import encountered an error. Please review your data.');
      console.error('Import execution error:', err);
      showToast('Import encountered an error. Please review your data.', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  // Step 3 metrics
  const totalRowsCount = mappedRows.length;
  const validRowsCount = mappedRows.filter((r) => r.isValid && !r.isDuplicate).length;
  const duplicateRowsCount = mappedRows.filter((r) => r.isDuplicate).length;
  const issueRowsCount = mappedRows.filter((r) => !r.isValid).length;

  const filteredReviewRows = mappedRows.filter((r) => {
    if (reviewTab === 'valid') return r.isValid && !r.isDuplicate;
    if (reviewTab === 'warnings') return r.isDuplicate;
    if (reviewTab === 'errors') return !r.isValid;
    return true;
  });

  const detectedCount = Object.values(mappings).filter(Boolean).length;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-150">
      {importError && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{importError}</p>}
      {/* Header */}
      <div className="pt-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Import Excel / Spreadsheet
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Ingest customers, policy numbers, and expiration dates seamlessly from Excel.
        </p>
      </div>

      {/* 4-Step Stepper Header */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
        <div className="grid grid-cols-4 gap-2">
          {[
            { step: 1, label: '1. Upload File' },
            { step: 2, label: '2. Map Fields' },
            { step: 3, label: '3. Review & Validate' },
            { step: 4, label: '4. Complete' },
          ].map((item) => (
            <div
              key={item.step}
              className={`flex items-center gap-2 pb-2 border-b-2 text-xs font-bold transition-all ${
                currentStep === item.step
                  ? 'border-blue-600 text-blue-600'
                  : currentStep > item.step
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-slate-200 text-slate-400'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  currentStep === item.step
                    ? 'bg-blue-600 text-white'
                    : currentStep > item.step
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {currentStep > item.step ? '✓' : item.step}
              </div>
              <span className="truncate hidden sm:inline">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* STEP 1: UPLOAD */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-8 sm:p-12 text-center hover:border-blue-500 transition-colors shadow-2xs">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx, .xls, .csv"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
              className="hidden"
            />

            <div className="max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-xs">
                <Upload className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Upload your Excel file
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Supported formats: <strong className="text-slate-700">.xlsx, .xls, .csv</strong>
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Your data will be reviewed before anything is imported.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
                >
                  Browse Files
                </button>
                <button
                  onClick={handleLoadSampleDataset}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200 transition-all flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Load Sample Dataset (1-Click)</span>
                </button>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-center">
                <button
                  onClick={handleDownloadTemplate}
                  className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Sample Excel Template</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: MAP FIELDS */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Map Columns to PolicyPilot</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confirm matching Excel columns with PolicyPilot schema fields.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                  {detectedCount} of {pilotFields.length} columns detected
                </span>
              </div>
            </div>

            {/* Mapping Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <th className="py-2.5 px-4">PolicyPilot Field</th>
                    <th className="py-2.5 px-4">Your Excel Column</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pilotFields.map((field) => {
                    const currentMapped = mappings[field.key];
                    const isDetected = Boolean(currentMapped);

                    return (
                      <tr key={field.key} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {field.label} {field.required && <span className="text-red-500">*</span>}
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={currentMapped || ''}
                            onChange={(e) =>
                              setMappings((prev) => ({ ...prev, [field.key]: e.target.value }))
                            }
                            className="w-full max-w-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:outline-none focus:border-blue-600"
                          >
                            <option value="">-- Select Column --</option>
                            {rawHeaders.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isDetected ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <Check className="w-3 h-3" /> Detected
                            </span>
                          ) : field.required ? (
                            <span className="inline-flex items-center text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                              Required
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">Optional</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Step 2 Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                onClick={() => setCurrentStep(1)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                onClick={proceedToReview}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all"
              >
                <span>Continue to Review</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: REVIEW & DUPLICATE MANAGEMENT */}
      {currentStep === 3 && (
        <div className="space-y-6">
          {/* Summary Metric Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-medium block">Total Policies</span>
              <span className="text-2xl font-bold text-slate-900 tabular-nums block mt-0.5">
                {totalRowsCount}
              </span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-medium block">Unique Customers</span>
              <span className="text-2xl font-bold text-blue-600 tabular-nums block mt-0.5">
                {new Set(mappedRows.map((r) => r.phone)).size}
              </span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-medium block">Possible Duplicates</span>
              <span className="text-2xl font-bold text-amber-600 tabular-nums block mt-0.5">
                {duplicateRowsCount}
              </span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-medium block">Data Issues</span>
              <span className="text-2xl font-bold text-red-600 tabular-nums block mt-0.5">
                {issueRowsCount}
              </span>
            </div>
          </div>

          {/* DUPLICATE HANDLING SECTION */}
          {duplicateRowsCount > 0 && (
            <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-amber-900 uppercase">
                    Duplicate Handling Protocol
                  </h3>
                  <p className="text-xs text-amber-800 mt-0.5">
                    {duplicateRowsCount} policies match existing policy numbers in your portfolio.
                    We never silently overwrite data.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setDuplicateStrategy('update')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    duplicateStrategy === 'update'
                      ? 'bg-amber-700 text-white shadow-2xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Update Existing
                </button>
                <button
                  onClick={() => setDuplicateStrategy('skip')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    duplicateStrategy === 'skip'
                      ? 'bg-amber-700 text-white shadow-2xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  Skip Duplicates
                </button>
              </div>
            </div>
          )}

          {/* Review Rows Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <button
                  onClick={() => setReviewTab('all')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    reviewTab === 'all'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All ({mappedRows.length})
                </button>
                <button
                  onClick={() => setReviewTab('valid')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    reviewTab === 'valid'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Valid ({validRowsCount})
                </button>
                <button
                  onClick={() => setReviewTab('warnings')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    reviewTab === 'warnings'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Duplicates ({duplicateRowsCount})
                </button>
                <button
                  onClick={() => setReviewTab('errors')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    reviewTab === 'errors'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Issues ({issueRowsCount})
                </button>
              </div>

              <span className="text-xs text-slate-400">
                Strategy: <strong>{duplicateStrategy === 'update' ? 'Update Existing' : 'Skip Duplicates'}</strong>
              </span>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <th className="py-2.5 px-4">Customer</th>
                    <th className="py-2.5 px-4">Mobile</th>
                    <th className="py-2.5 px-4">Policy No</th>
                    <th className="py-2.5 px-4">Insurer</th>
                    <th className="py-2.5 px-4">Policy Type</th>
                    <th className="py-2.5 px-4 text-right">Premium</th>
                    <th className="py-2.5 px-4">Expiry Date</th>
                    <th className="py-2.5 px-4">Issues / Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReviewRows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{r.customerName}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{r.phone || '—'}</td>
                      <td className="py-2.5 px-4 font-mono text-blue-700 font-semibold">{r.policyNumber}</td>
                      <td className="py-2.5 px-4">{r.insurer}</td>
                      <td className="py-2.5 px-4">{r.policyType}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums font-bold">
                        ₹{r.premium.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-4 font-medium">{r.expiryDate}</td>
                      <td className="py-2.5 px-4">
                        {r.issues.length === 0 ? (
                          <span className="text-emerald-700 font-bold text-[11px]">Valid</span>
                        ) : (
                          <span className="text-amber-700 text-[11px] font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            {r.issues.join(', ')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Step 3 Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setCurrentStep(2)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 text-xs font-semibold transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Adjust Mappings</span>
              </button>
              <button
                onClick={handleExecuteImport}
                disabled={isImporting}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing Ingestion Engine...</span>
                  </>
                ) : (
                  <>
                    <span>Import {mappedRows.length} Records</span>
                    <Check className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: COMPLETE */}
      {currentStep === 4 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-2xs space-y-6 max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Import Completed Successfully!
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Your policies and customers have been synchronized with the live CRM and renewal radar.
            </p>
          </div>

          {/* Results Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <span className="text-[11px] text-slate-400 block">Customers Added</span>
              <span className="text-xl font-bold text-slate-900 tabular-nums">
                {importResults.customersAdded}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <span className="text-[11px] text-slate-400 block">Policies Ingested</span>
              <span className="text-xl font-bold text-slate-900 tabular-nums">
                {importResults.policiesAdded}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <span className="text-[11px] text-slate-400 block">Expiring in 30 Days</span>
              <span className="text-xl font-bold text-blue-600 tabular-nums">
                {metrics.next30Days}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <span className="text-[11px] text-slate-400 block">Expiring Today</span>
              <span className="text-xl font-bold text-red-600 tabular-nums">
                {metrics.expiringToday}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <button
              onClick={() => navigateTo('dashboard')}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              View Dashboard
            </button>
            <button
              onClick={() => navigateTo('policies')}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
            >
              View Policies
            </button>
            <button
              onClick={() => {
                setCurrentStep(1);
                setFileName('');
                setRawRows([]);
                setMappedRows([]);
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
