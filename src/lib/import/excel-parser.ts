import * as XLSX from 'xlsx';

export interface ColumnMapping {
  customer_name: string;
  phone?: string;
  email?: string;
  address?: string;
  policy_number: string;
  insurance_company: string;
  policy_type: string;
  premium: string;
  start_date?: string;
  expiry_date: string;
  status?: string;
}

export type SupportedField = keyof ColumnMapping;

export interface FieldDefinition {
  key: SupportedField;
  label: string;
  required: boolean;
  aliases: string[];
  description: string;
}

export const SUPPORTED_FIELDS: FieldDefinition[] = [
  {
    key: 'customer_name',
    label: 'Customer Name',
    required: true,
    aliases: [
      'customer name', 'customer', 'client name', 'client', 'name', 
      'policy holder', 'policyholder', 'insured name', 'insured', 
      'proposer name', 'proposer', 'holder name'
    ],
    description: 'Name of the policyholder',
  },
  {
    key: 'phone',
    label: 'Phone / Mobile',
    required: false,
    aliases: [
      'phone', 'mobile', 'mobile number', 'mobile no', 'contact', 
      'contact number', 'contact no', 'phone number', 'phone no', 'cell', 'tel'
    ],
    description: 'Customer contact phone number',
  },
  {
    key: 'email',
    label: 'Email Address',
    required: false,
    aliases: ['email', 'e-mail', 'email address', 'mail', 'email id'],
    description: 'Customer email address',
  },
  {
    key: 'address',
    label: 'Address',
    required: false,
    aliases: ['address', 'city', 'location', 'customer address', 'residence'],
    description: 'Customer physical address',
  },
  {
    key: 'policy_number',
    label: 'Policy Number',
    required: true,
    aliases: [
      'policy no', 'policy number', 'policy_no', 'policy_number', 'policy id', 
      'policy #', 'certificate no', 'certificate number', 'policyno', 'policynumber', 'policy'
    ],
    description: 'Unique policy identifier code',
  },
  {
    key: 'insurance_company',
    label: 'Insurance Company',
    required: true,
    aliases: [
      'insurance company', 'company', 'insurer', 'insurance provider', 
      'carrier', 'insurance co', 'provider', 'company name'
    ],
    description: 'Underwriter / Insurance provider',
  },
  {
    key: 'policy_type',
    label: 'Policy Type',
    required: true,
    aliases: [
      'policy type', 'type', 'insurance type', 'category', 'plan type', 
      'plan', 'product', 'lob', 'line of business'
    ],
    description: 'Coverage category (e.g. Motor, Health, Life)',
  },
  {
    key: 'premium',
    label: 'Premium Amount',
    required: true,
    aliases: [
      'premium', 'premium amount', 'amount', 'gross premium', 'net premium', 
      'total premium', 'annual premium', 'prem'
    ],
    description: 'Premium amount in rupees (₹)',
  },
  {
    key: 'start_date',
    label: 'Start Date',
    required: false,
    aliases: [
      'start date', 'policy start', 'commencement date', 'issue date', 
      'inception date', 'from date', 'effective date', 'start', 'start_date'
    ],
    description: 'Policy commencement date',
  },
  {
    key: 'expiry_date',
    label: 'Expiry Date',
    required: true,
    aliases: [
      'expiry date', 'expiry', 'policy expiry', 'renewal date', 'valid till', 
      'end date', 'to date', 'expiration date', 'expiry_date', 'due date'
    ],
    description: 'Policy expiration / renewal due date',
  },
  {
    key: 'status',
    label: 'Policy Status',
    required: false,
    aliases: ['status', 'policy status', 'state'],
    description: 'Active, Expiring Soon, Expired, or Renewed',
  },
];

export interface ParsedSpreadsheet {
  filename: string;
  sheetNames: string[];
  activeSheet: string;
  headers: string[];
  rawRows: Record<string, unknown>[];
  totalRows: number;
  detectedMappings: Partial<Record<SupportedField, string>>;
}

/**
 * Normalizes header string for fuzzy alias comparison
 */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detects best matching Excel column for each supported field
 */
export function detectColumnMappings(headers: string[]): Partial<Record<SupportedField, string>> {
  const mappings: Partial<Record<SupportedField, string>> = {};
  const normalizedHeaders = headers.map((h) => ({ original: h, normalized: normalizeHeader(h) }));

  for (const field of SUPPORTED_FIELDS) {
    // 1. Exact match on normalized header
    let match = normalizedHeaders.find((h) =>
      field.aliases.some((alias) => h.normalized === alias)
    );

    // 2. Substring match if no exact match
    if (!match) {
      match = normalizedHeaders.find((h) =>
        field.aliases.some(
          (alias) => h.normalized.includes(alias) || alias.includes(h.normalized)
        )
      );
    }

    if (match) {
      mappings[field.key] = match.original;
    }
  }

  return mappings;
}

/**
 * Sanitizes input values against CSV/Formula Injection (DDE attacks)
 */
export function sanitizeCellValue(val: unknown): unknown {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    // If string begins with formula triggers (=, +, -, @), neutralize injection
    if (/^[=+\-@\t\r]/.test(trimmed)) {
      return `'${trimmed}`;
    }
    return val;
  }
  return val;
}

/**
 * Parses an ArrayBuffer or binary string using SheetJS
 */
export function parseSpreadsheetBuffer(buffer: ArrayBuffer, filename: string): ParsedSpreadsheet {
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    cellFormula: false, // Security: Never execute or evaluate spreadsheet formulas
    dateNF: 'yyyy-mm-dd',
  });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Spreadsheet contains no sheets or readable data.');
  }

  const activeSheet = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[activeSheet];

  // Convert sheet to json with raw headers
  const jsonData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (jsonData.length === 0) {
    throw new Error('Spreadsheet is empty.');
  }

  // Row 0 is headers
  const headerRow = (jsonData[0] as unknown[]) || [];
  const headers = headerRow.map((h) => String(h || '').trim()).filter((h) => h.length > 0);

  if (headers.length === 0) {
    throw new Error('No column headers detected in the first row.');
  }

  // Rows 1+ are data
  const rawRows: Record<string, unknown>[] = [];
  for (let r = 1; r < jsonData.length; r++) {
    const rowValues = (jsonData[r] as unknown[]) || [];
    // Check if entire row is empty
    const hasValues = rowValues.some(
      (v) => v !== null && v !== undefined && String(v).trim().length > 0
    );
    if (!hasValues) continue;

    const rowObj: Record<string, unknown> = {};
    headers.forEach((header, colIdx) => {
      rowObj[header] = sanitizeCellValue(rowValues[colIdx] ?? '');
    });
    rawRows.push(rowObj);
  }

  const detectedMappings = detectColumnMappings(headers);

  return {
    filename,
    sheetNames: workbook.SheetNames,
    activeSheet,
    headers,
    rawRows,
    totalRows: rawRows.length,
    detectedMappings,
  };
}
