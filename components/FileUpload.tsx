import React, { useCallback, useRef, useState } from 'react';
import { Upload, FileUp, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Transaction } from '../types';

interface FileUploadProps {
  onDataLoaded: (data: Transaction[]) => void;
}

// Improved helper to find value with strict priority: Exact > Case-Insensitive > Partial
const findValue = (row: any, possibleKeys: string[]): any => {
  const rowKeys = Object.keys(row);
  
  // 1. Try Exact Matches first for all keys
  for (const key of possibleKeys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
  }
  
  // 2. Try Case-Insensitive Matches for all keys
  for (const key of possibleKeys) {
    const foundKey = rowKeys.find(k => k.trim().toLowerCase() === key.trim().toLowerCase());
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== "") return row[foundKey];
  }

  // 3. Try Partial Matches for all keys (Last resort)
  for (const key of possibleKeys) {
    const partialKey = rowKeys.find(k => k.toLowerCase().includes(key.toLowerCase()));
    if (partialKey && row[partialKey] !== undefined && row[partialKey] !== null && row[partialKey] !== "") return row[partialKey];
  }
  
  return undefined;
};

// Robust date parser to handle DD/MM/YYYY, Excel serials, and ISO
const parseDate = (val: any): string => {
    if (!val) return new Date().toISOString().split('T')[0];

    // Handle Excel Serial Date (numbers)
    if (typeof val === 'number') {
        // Excel base date is Dec 30 1899 approx. 
        // (val - 25569) * 86400 * 1000 converts to unix ms
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
    }

    const str = String(val).trim();
    
    // Regex for DD/MM/YYYY or DD-MM-YYYY (Common in regions like SAR/ME)
    // Matches start of string, 1-2 digits / 1-2 digits / 4 digits
    const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmy) {
        const day = dmy[1].padStart(2, '0');
        const month = dmy[2].padStart(2, '0');
        const year = dmy[3];
        // Return ISO YYYY-MM-DD
        return `${year}-${month}-${day}`;
    }

    // Try standard JS date parse (handles YYYY-MM-DD, MM/DD/YYYY often)
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
    }
    
    return new Date().toISOString().split('T')[0];
};

const cleanCustomerName = (name: any): string => {
    if (!name) return 'Unknown';
    // Replace newlines and multiple spaces with a single space
    return String(name).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
};

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');

  const processFile = useCallback((file: File) => {
    setStatus('processing');
    setMessage('Processing file...');
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("File is empty");

        const lib = XLSX as any;
        const readFn = lib.read || lib.default?.read;
        const utilsFn = lib.utils || lib.default?.utils;

        if (!readFn || !utilsFn) throw new Error("XLSX library error");

        let workbook;
        try {
            workbook = readFn(data, { type: 'array' });
        } catch (readError) {
            throw new Error("Invalid file format. Please upload Excel or CSV.");
        }

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // First, get all data as arrays to find the header row
        const rawRows = utilsFn.sheet_to_json(sheet, { header: 1 });
        if (!rawRows || rawRows.length === 0) throw new Error("File appears empty");

        // Find the header row index by looking for "Customer" column
        let headerRowIndex = -1;
        const customerKeywords = ['customer', 'client', 'party name', 'bill to', 'account name', 'payer'];
        
        // Scan first 50 rows
        for (let i = 0; i < Math.min(rawRows.length, 50); i++) {
            const row = rawRows[i] as any[];
            if (row && row.some(cell => {
                if (!cell) return false;
                const str = String(cell).toLowerCase();
                return customerKeywords.some(k => str.includes(k));
            })) {
                headerRowIndex = i;
                break;
            }
        }

        if (headerRowIndex === -1) {
            throw new Error("Could not find a 'Customer' column. Please check file headers.");
        }

        // Now parse properly starting from the identified header row
        const jsonData = utilsFn.sheet_to_json(sheet, { range: headerRowIndex, defval: "" });

        if (!jsonData || jsonData.length === 0) {
            throw new Error("No data found below the header row.");
        }

        const transactions: Transaction[] = [];
        const seenCustomers = new Set<string>();

        jsonData.forEach((row: any, index: number) => {
            // Extract Customer Name first
            const custNameRaw = findValue(row, [
              'Customer Name', 'Customer', 'Client', 'Account Name', 
              'Party Name', 'Bill To', 'Payer', 'Account Description', 
              'Cust Name', 'Customer #', 'English Name', 'Arabic Name'
            ]);
            
            // Skip rows without valid customer name
            if (!custNameRaw || String(custNameRaw).trim() === '') return;
            
            // Normalize Name: Remove newlines, weird spaces
            const customerName = cleanCustomerName(custNameRaw);
            if (customerName.toLowerCase().includes('total')) return;

            seenCustomers.add(customerName);

            // Amount extraction
            // Added 'Total' to the front to prioritize it over 'Amount' (which matches 'Net Amount')
            const rawVal = findValue(row, ['Total', 'Original', 'Amount', 'Value', 'Debit', 'Credit', 'Balance', 'Net']);
            const rawAmount = String(rawVal || '0').replace(/,/g, '');
            let amount = parseFloat(rawAmount);
            if (isNaN(amount)) amount = 0;

            const typeRaw = findValue(row, ['Trx Type', 'Type', 'Transaction Type', 'Doc Type', 'Category', 'Description']) || 'INV';
            const typeString = String(typeRaw);
            
            // Adjust sign based on Type if positive
            if (typeString.toLowerCase().includes('payment') && amount > 0) {
                amount = -amount;
            }
            // Check for parenthesized negative values "(100)"
            if (typeof rawVal === 'string' && rawVal.includes('(') && rawVal.includes(')')) {
               amount = -1 * parseFloat(rawVal.replace(/[(),]/g, ''));
            }

            // Parse Date strictly
            const dateRaw = findValue(row, ['Trx Date', 'Date', 'Transaction Date', 'Invoice Date', 'Gl Date']);
            const isoDate = parseDate(dateRaw);

            transactions.push({
                id: `file-${index}-${Date.now()}`,
                trxDate: isoDate,
                number: String(findValue(row, ['Number', 'Invoice No', 'Ref', 'Reference', 'Doc Num', 'Transaction Number', 'Document Number']) || ''),
                region: findValue(row, ['Region', 'Area', 'Territory', 'Zone']) || '',
                siteLocation: findValue(row, ['Site Location', 'Location', 'Site', 'Branch', 'Store']) || '',
                trxType: (typeString.toLowerCase().includes('payment') ? 'Payment' : 'INV') as 'INV' | 'Payment',
                originalAmount: amount,
                glAgency: findValue(row, ['Gl Agency', 'Agency', 'GL', 'Account']) || '',
                note: findValue(row, ['Note', 'Description', 'Memo', 'Remarks', 'Details', 'Narration']) || '',
                customerName: customerName,
            });
        });

        if (transactions.length === 0) {
          setStatus('error');
          setMessage("Parsed headers but found no valid transactions.");
        } else {
          onDataLoaded(transactions);
          setStatus('success');
          setMessage(`Success! Loaded ${transactions.length} records. Found ${seenCustomers.size} unique customers.`);
          
          setTimeout(() => {
              // keep success state
          }, 3000);
        }
        
      } catch (error: any) {
        console.error("Error parsing file:", error);
        setStatus('error');
        setMessage(error.message || "Unknown error occurred during parsing");
      }
    };

    reader.onerror = () => {
        setStatus('error');
        setMessage("Error reading file from disk.");
    };
    reader.readAsArrayBuffer(file);
  }, [onDataLoaded]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  let containerClasses = "border border-dashed rounded-lg px-4 py-3 flex items-center justify-center transition-all cursor-pointer group bg-[#0B0C10] shadow-inner relative overflow-hidden ";
  if (status === 'error') containerClasses += "border-red-500/50 hover:bg-red-500/10";
  else if (status === 'success') containerClasses += "border-green-500/50 bg-green-500/5 hover:bg-green-500/10";
  else containerClasses += "border-[#2A2D33] hover:bg-[#1C1F24] hover:border-[#14F1E1]";

  return (
    <div 
      className={containerClasses}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <input 
        type="file" 
        onChange={handleChange} 
        className="hidden" 
        id="file-upload"
        ref={fileInputRef}
      />
      
      <label htmlFor="file-upload" className="cursor-pointer flex flex-row items-center gap-3 w-full justify-center h-full">
        {status === 'processing' ? (
           <>
             <Loader2 className="w-5 h-5 text-[#14F1E1] animate-spin" />
             <span className="text-[#14F1E1] text-sm font-medium">{message}</span>
           </>
        ) : status === 'success' ? (
           <>
             <div className="bg-green-500/20 p-1.5 rounded-full">
               <CheckCircle className="w-4 h-4 text-green-400" />
             </div>
             <div className="text-left">
                <span className="text-green-400 font-bold text-sm block">Upload Complete</span>
                <span className="text-green-300/70 text-[10px] block leading-none">{message}</span>
             </div>
           </>
        ) : status === 'error' ? (
           <>
             <div className="bg-red-500/20 p-1.5 rounded-full">
               <AlertCircle className="w-4 h-4 text-red-400" />
             </div>
             <div className="text-left">
                <span className="text-red-400 font-bold text-sm block">Upload Failed</span>
                <span className="text-red-300/70 text-[10px] block leading-tight max-w-[200px]">{message}</span>
             </div>
           </>
        ) : (
           <>
             <div className="bg-[#1C1F24] p-1.5 rounded-full group-hover:scale-110 transition-transform shadow-lg group-hover:shadow-[0_0_10px_rgba(20,241,225,0.2)]">
                <FileUp className="w-4 h-4 text-[#5B6CFF] group-hover:text-[#14F1E1] transition-colors" />
             </div>
             <div className="text-left">
                <span className="text-gray-300 font-medium text-sm group-hover:text-white transition-colors block">Upload Data File</span>
                <span className="text-gray-600 text-[10px] block leading-none">Auto-detects Columns</span>
             </div>
           </>
        )}
      </label>
    </div>
  );
};