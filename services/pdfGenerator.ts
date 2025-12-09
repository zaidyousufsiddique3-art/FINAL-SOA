import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction, StatementConfig } from '../types';
import { formatCurrency, formatDate } from '../utils/formatters';

export const generateStatementPDF = (
  fileTransactions: Transaction[],
  manualTransactions: Transaction[],
  selectedCustomer: string,
  config: StatementConfig
): { blob: Blob; blobUrl: string; fileName: string } => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;

  // --- Filter and Merge Data ---

  // 0. Find reference Region/Site from manual transactions for this customer to override file data
  const customerManualTrxs = manualTransactions.filter(t => t.customerName === selectedCustomer);
  const refTrx = customerManualTrxs.length > 0 ? customerManualTrxs[0] : null;

  // 1. Get Invoices from File
  const invoiceTrxs = fileTransactions.filter(t =>
    t.customerName === selectedCustomer &&
    t.trxDate >= config.startDate &&
    t.trxDate <= config.endDate
  ).map(t => ({
    ...t,
    trxType: 'INVOICE', // Force type to INVOICE for file data per requirements
    // Ensure invoice amount is positive for calculation
    calculatedAmount: Math.abs(t.originalAmount),
    // Override Region and Site Location if manual payments exist, otherwise keep file data
    region: refTrx ? refTrx.region : t.region,
    siteLocation: refTrx ? refTrx.siteLocation : t.siteLocation
  }));

  // 2. Get Payments from Manual Entry
  const paymentTrxs = manualTransactions.filter(t =>
    t.customerName === selectedCustomer &&
    t.trxDate >= config.startDate &&
    t.trxDate <= config.endDate
  ).map(t => ({
    ...t,
    trxType: 'PAYMENT',
    // Manual payments are stored as negative in Form, keep them negative or ensure logic matches
    // Requirement: PAYMENT -> Amount is - (reduces balance)
    calculatedAmount: -Math.abs(t.originalAmount)
  }));

  // 3. Combine and Sort
  const allTrxs = [...invoiceTrxs, ...paymentTrxs].sort((a, b) =>
    new Date(a.trxDate).getTime() - new Date(b.trxDate).getTime()
  );

  // --- Header Construction ---

  // Logo Handling: Calculate dimensions to maintain aspect ratio
  if (config.logoUrl) {
    try {
      const imgProps = doc.getImageProperties(config.logoUrl);
      // Determine width/height based on aspect ratio
      // Increased logo size for better visibility
      const maxWidth = 100;
      const maxHeight = 55;
      const ratio = imgProps.height / imgProps.width;

      let finalWidth = maxWidth;
      let finalHeight = finalWidth * ratio;

      if (finalHeight > maxHeight) {
        finalHeight = maxHeight;
        finalWidth = finalHeight / ratio;
      }

      const xPos = (pageWidth - finalWidth) / 2;

      doc.addImage(config.logoUrl, xPos, 10, finalWidth, finalHeight);
    } catch (e) {
      console.error('Error adding logo', e);
      // Fallback text if image add fails
      doc.setFontSize(16);
      doc.setTextColor(0, 95, 163);
      doc.text("AFDHAL AL AGHDHIA FOR TRADING", pageWidth / 2, 25, { align: 'center' });
    }
  } else {
    // Default text if no logo provided
    doc.setFontSize(16);
    doc.setTextColor(0, 95, 163); // Blue-ish
    doc.text("AFDHAL AL AGHDHIA FOR TRADING", pageWidth / 2, 25, { align: 'center' });
  }

  // Header Info Block
  // Customer Name, Statement Period, Operating Unit
  const headerY = 50; // Moved down slightly to accommodate potentially taller logo

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'bold');

  // Left Side: Customer
  doc.text("CUSTOMER NAME:", 14, headerY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);
  doc.text(selectedCustomer, 14, headerY + 6);

  // Right Side: Period
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100);
  doc.text("STATEMENT PERIOD:", pageWidth - 14, headerY, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);
  doc.text(`${formatDate(config.startDate)} - ${formatDate(config.endDate)}`, pageWidth - 14, headerY + 6, { align: 'right' });

  // Below Left: Operating Unit
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100);
  doc.text("OPERATING UNIT:", 14, headerY + 16);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);
  doc.text(config.operatingUnit, 14, headerY + 22);

  // --- Table Generation ---

  let runningBalance = config.openingBalance;

  const tableBody = allTrxs.map(t => {
    // Balance Logic: Previous Balance + Transaction Amount
    runningBalance += t.calculatedAmount;

    const amountStr = `SAR ${formatCurrency(Math.abs(t.calculatedAmount))}`;
    const displayAmount = t.trxType === 'PAYMENT' ? `-${amountStr}` : amountStr;
    const balanceStr = `SAR ${formatCurrency(runningBalance)}`;

    return [
      formatDate(t.trxDate),
      t.number, // Invoice Number
      t.region,
      t.siteLocation,
      t.trxType,
      displayAmount,
      balanceStr
    ];
  });

  const finalBalance = runningBalance;
  const obY = headerY + 32;

  // Define column styles once to use in both tables for alignment
  const sharedColumnStyles: any = {
    0: { cellWidth: 25 },
    1: { cellWidth: 20 },
    2: { cellWidth: 20 },
    3: { cellWidth: 35 },
    4: { cellWidth: 20 },
    5: { cellWidth: 30, halign: 'right' },
    6: { cellWidth: 30, halign: 'right' }
  };

  // 1. Main Table (Opening Balance + Transactions)
  autoTable(doc, {
    startY: obY,
    margin: { left: 14, right: 14 },
    // Define Header with Opening Balance as the first row
    head: [
      [
        {
          content: 'OPENING BALANCE',
          colSpan: 6,
          styles: {
            halign: 'left',
            fillColor: [0, 95, 163],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            cellPadding: { top: 2, bottom: 2, left: 4 },
          }
        },
        {
          content: `SAR ${formatCurrency(config.openingBalance)}`,
          styles: {
            halign: 'right',
            fillColor: [0, 95, 163],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            cellPadding: { top: 2, bottom: 2, right: 4 },
          }
        }
      ],
      [
        'Transaction Date',
        'Number',
        'Region',
        'Site Location',
        'Type',
        'Amount',
        'Balance'
      ]
    ],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [10, 30, 50],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      lineWidth: 0.1,
      lineColor: [200, 200, 200]
    },
    bodyStyles: {
      textColor: [0, 0, 0],
      fontSize: 8,
      halign: 'center',
      lineWidth: 0.1,
      lineColor: [200, 200, 200]
    },
    columnStyles: sharedColumnStyles,
    styles: {
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
      cellPadding: 2
    },
    // Removed tableLineWidth/tableLineColor to fix double-border artifact
  });

  const mainTableY = (doc as any).lastAutoTable.finalY;

  // 2. Total Balance Table (Separate table for gap + custom borders)
  autoTable(doc, {
    startY: mainTableY + 4, // 4 units gap
    margin: { left: 14, right: 14 },
    head: [],
    body: [
      [
        // Empty Spacer cells (cols 0,1,2,3 -> span 4)
        {
          content: '',
          colSpan: 4,
          styles: { lineWidth: 0, fillColor: [255, 255, 255] }
        },
        // Label (cols 4,5 -> span 2)
        {
          content: 'Total Balance Due',
          colSpan: 2,
          styles: {
            fillColor: [5, 237, 5], // #05ed05
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
            lineWidth: 0.1,
            lineColor: [200, 200, 200]
          }
        },
        // Value (col 6)
        {
          content: `SAR ${formatCurrency(finalBalance)}`,
          styles: {
            fillColor: [5, 237, 5], // #05ed05
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            halign: 'right',
            valign: 'middle',
            lineWidth: 0.1,
            lineColor: [200, 200, 200]
          }
        }
      ]
    ],
    theme: 'plain', // Use plain so we control borders manually
    columnStyles: sharedColumnStyles, // Reuse exact widths to align
    styles: {
      cellPadding: 2,
      fontSize: 8
    }
  });

  // Footer Message
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'bold');
  const footerText = "Thank you for your continued cooperation. We kindly request that the outstanding balance be settled at your earliest convenience.";

  // Wrap text
  const splitText = doc.splitTextToSize(footerText, pageWidth - 30);
  doc.text(splitText, 14, finalY);

  const fileName = `SOA_${selectedCustomer}_${config.endDate}.pdf`;
  doc.save(fileName);

  // Return Blob URL for history
  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);

  return { blob, blobUrl, fileName };
};