import React, { useState, useEffect, useCallback } from 'react';
import OverlayProcessingDays from '../OverlayModal/OverlayProcessingDays';
import Swal from 'sweetalert2'; 
import { io } from 'socket.io-client';
import moment from 'moment';
import { FiEdit2, FiSlash, FiSearch, FiChevronDown, FiDownload } from 'react-icons/fi';
import '../index.css';

function calculateNetworkDays(startDate, endDate) {
  if (!startDate || !endDate || endDate === '-') return 0;
  
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    if (start > end) return 0;

    let count = 0;
    const current = new Date(start);
    
    while (current <= end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  } catch (error) {
    console.error('Error calculating network days:', error);
    return 0;
  }
}

function parseDateReleased(dateStr) {
  if (!dateStr || dateStr === '-') return null;
  const [datePart, timePart] = dateStr.split(' at ');
  if (!timePart) return new Date(dateStr);
  const date = new Date(`${datePart} ${timePart}`);
  if (!isNaN(date.getTime())) return date;
  const dateOnly = new Date(datePart);
  return isNaN(dateOnly.getTime()) ? null : dateOnly;
}

function NetworkDays() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toLocaleString('en-US', { month: 'long' })
  );
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const adminData = localStorage.getItem('admin');
  const admin = adminData ? JSON.parse(adminData) : null;
  const isIncomingAdmin = admin?.documentdirection === 'incoming';

  const API_URL = import.meta.env.VITE_API_URL;
  const months = ['All', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/documents`);
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      const filteredDocuments = data
        .filter(doc => 
          doc.documentdirection === 'outgoing' && 
          (doc.route === 'Accounting_Unit' || doc.route === 'ORD')
        )
        .map(doc => {
          const businessDays = doc.datereleased && doc.datereleased !== '-' 
            ? calculateNetworkDays(doc.datesent, doc.datereleased)
            : 0;

          const processingDays = doc.calcnetworkdays !== null 
            ? Number(doc.calcnetworkdays)
            : businessDays - (doc.deducteddays || 0);

          return {
            documentid: doc.documentid,
            dtsNo: doc.dtsno,
            dateSent: doc.datesent,
            dateReceive: doc.datereleased || '-',
            deducteddays: doc.deducteddays !== null ? Number(doc.deducteddays) : null,
            calcnetworkdays: Math.max(0, processingDays),
            networkdaysremarks: doc.networkdaysremarks || '-',
            documentType: doc.documenttype,
            route: doc.route,
            isarchive: doc.isarchive
          };
        })
        .filter(doc => !doc.isarchive)
        .sort((a, b) => new Date(b.dateSent) - new Date(a.dateSent));

      setDocuments(filteredDocuments);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    const socket = io(API_URL);
    socket.on('documents_updated', fetchDocuments);

    return () => {
      socket.off('documents_updated', fetchDocuments);
      socket.disconnect();
    };
  }, [API_URL, fetchDocuments]);

  const handleEdit = (doc) => {
    if (isIncomingAdmin) return;
    setSelectedDocument({
      documentid: doc.documentid,
      dtsno: doc.dtsNo,
      documenttype: doc.documentType,
      documentdirection: 'outgoing',
      route: doc.route,
      networkdaysremarks: doc.networkdaysremarks === '-' ? '' : doc.networkdaysremarks,
      deducteddays: doc.deducteddays !== null ? doc.deducteddays : 0,
      dateSent: doc.dateSent,
      dateReceive: doc.dateReceive,
      calcnetworkdays: doc.calcnetworkdays
    });
    
    setIsViewMode(false);
    setIsEditMode(true);
    setShowNetworkModal(true);
  };

  const handleClear = async (docId) => {
    if (isIncomingAdmin) return;
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'Are you sure you want to clear the deducted days and remarks for this document?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, clear it!',
      cancelButtonText: 'Cancel',
      customClass: {
        popup: 'swal2-minimalist'
      }
    });
    if (!result.isConfirmed) return;

    try {
      const response = await fetch(`${API_URL}/api/documents/${docId}/networkdays`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deducteddays: 0,
          calcnetworkdays: null,
          remarks: ''
        })
      });

      if (response.ok) {
        fetchDocuments();
        Swal.fire({
          icon: 'success',
          title: 'Cleared Successfully',
          text: 'Deducted days and remarks have been cleared.',
          timer: 1800,
          showConfirmButton: false,
          customClass: {
            popup: 'swal2-minimalist'
          }
        });
      } else {
        const error = await response.json();
        Swal.fire({
          icon: 'error',
          title: 'Failed to Clear',
          text: error.message || 'Failed to clear document. Please try again.',
          timer: 2500,
          showConfirmButton: false,
          customClass: {
            popup: 'swal2-minimalist'
          }
        });
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'An error occurred while clearing. Please try again.',
        timer: 2500,
        showConfirmButton: false,
        customClass: {
          popup: 'swal2-minimalist'
        }
      });
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const search = searchTerm.toLowerCase();
    const matchesDtsNo = doc.dtsNo?.toLowerCase().includes(search);
    const matchesDocType = doc.documentType?.toLowerCase().includes(search);
    const matchesStatus = 'outgoing'.includes(search);

    let matchesMonth = true;
    let matchesYear = true;
    if (selectedMonth !== 'All' || selectedYear !== 'All') {
      const dateReleased = parseDateReleased(doc.dateReceive);
      if (dateReleased) {
        matchesMonth = selectedMonth === 'All' || dateReleased.toLocaleString('en-US', { month: 'long' }) === selectedMonth;
        matchesYear = selectedYear === 'All' || dateReleased.getFullYear() === selectedYear;
      } else {
        matchesMonth = false;
        matchesYear = false;
      }
    }

    return (
      (!search || matchesDtsNo || matchesDocType || matchesStatus)
      && matchesMonth && matchesYear
    );
  });

  const formatDate = (dateString) => {
    if (!dateString || dateString === '-') return '-';
    try {
      const date = moment(dateString);
      return date.isValid() ? date.format('MMMM D, YYYY [at] h:mm A') : '-';
    } catch (e) {
      return '-';
    }
  };

  const handleExportToExcel = async () => {
    const exportDocuments = documents.filter(doc => {
      const docDate = new Date(doc.dateSent);
      const matchesMonth =
        selectedMonth === 'All' ||
        docDate.toLocaleString('en-US', { month: 'long' }) === selectedMonth;
      const matchesYear = selectedYear === 'All' || docDate.getFullYear() === selectedYear;
      return matchesMonth && matchesYear;
    });

    if (exportDocuments.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'No Data to Export',
        text: 'There are no documents to export.',
        timer: 1800,
        showConfirmButton: false,
        customClass: {
          popup: 'swal2-minimalist'
        }
      });
      return;
    }

    const ExcelJS = await import('exceljs');
    const { saveAs } = await import('file-saver');

    const workbook = new ExcelJS.Workbook();
    let sheetName = '';
    if (selectedMonth !== 'All' || selectedYear !== 'All') {
      const monthYear = [];
      if (selectedMonth !== 'All') monthYear.push(selectedMonth);
      if (selectedYear !== 'All') monthYear.push(selectedYear.toString());
      sheetName = `${monthYear.join(' ')}`;
    }
    
    if (sheetName.length > 31) {
      sheetName = sheetName.substring(0, 28) + '...';
    }
    
    const worksheet = workbook.addWorksheet(sheetName || 'Network Days');

    const headers = [
      'DATE SENT',
      'DATE RELEASED',
      'DTS NO.',
      'DOCUMENT STATUS',
      'DOCUMENT TYPE',
      'PROCESSING DAYS',
      'REMARKS'
    ];
    worksheet.addRow(headers);

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 13, name: 'Arial' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '1460A2' }
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    headerRow.height = 30;

    exportDocuments.slice().reverse().forEach((doc) => {
      const rowValues = [
        formatDate(doc.dateSent),
        doc.dateReceive,
        doc.dtsNo,
        'Outgoing',
        doc.documentType?.trim() || '-',
        doc.calcnetworkdays !== null && !isNaN(doc.calcnetworkdays)
          ? `${doc.calcnetworkdays} days`
          : '-',
        doc.networkdaysremarks && doc.networkdaysremarks !== '-'
          ? doc.networkdaysremarks
          : '-'
      ];
      const row = worksheet.addRow(rowValues);

      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 11 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber === 7 ? 'left' : 'center',
          wrapText: true
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'D3D3D3' } },
          left: { style: 'thin', color: { argb: 'D3D3D3' } },
          bottom: { style: 'thin', color: { argb: 'D3D3D3' } },
          right: { style: 'thin', color: { argb: 'D3D3D3' } }
        };

        const textWhite = { argb: 'FFFFFFFF' };

        if (colNumber === 3) {
          cell.font = {
            name: 'Arial',
            bold: true,
            size: 11
          };
        }

        if (colNumber === 4) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '123052' } };
          cell.font = { name: 'Arial', color: textWhite, bold: true, size: 11 };
        }

        if (colNumber === 6) {
          if (doc.calcnetworkdays > 5 || doc.calcnetworkdays <= 0) {
            cell.font = { name: 'Arial', color: { argb: 'FF0000' }, size: 11 };
          } else {
            cell.font = { name: 'Arial', color: { argb: '28A745' }, size: 11 };
          }
        }
      });

      row.height = 25;
    });

    const validProcessingDays = exportDocuments
      .map(doc => doc.calcnetworkdays)
      .filter(days => days !== null && !isNaN(days) && days > 0);
    
    if (validProcessingDays.length > 0) {
      const averageDays = (validProcessingDays.reduce((sum, days) => sum + days, 0) / validProcessingDays.length).toFixed(2);
      
      const emptyRow = worksheet.addRow(['', '', '', '', '', '', '']);
      emptyRow.height = 20;
      
      const averageRow = worksheet.addRow(['', '', '', '', '', `Average: ${averageDays} days`, '']);
      averageRow.height = 25;
      
      averageRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 11, bold: true };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber === 6 ? 'center' : 'left',
          wrapText: true
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'D3D3D3' } },
          left: { style: 'thin', color: { argb: 'D3D3D3' } },
          bottom: { style: 'thin', color: { argb: 'D3D3D3' } },
          right: { style: 'thin', color: { argb: 'D3D3D3' } }
        };
        
        if (colNumber === 6) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0F0F0' } };
          cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: '000000' } };
        }
      });
    }

    const currentDate = new Date();
    const dateStr = currentDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    const timeStr = currentDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    for (let i = 0; i < 3; i++) {
      const spacingRow = worksheet.addRow(['', '', '', '', '', '', '']);
      spacingRow.height = 15;
    }
    
    const noteRow = worksheet.addRow(['', '', '', '', '', '', '']);
    noteRow.height = 20;
    
    worksheet.mergeCells(`A${noteRow.number}:G${noteRow.number}`);
    
    const noteCell = worksheet.getCell(`A${noteRow.number}`);
    noteCell.value = `Note: This is a system-generated file. Generated on: ${dateStr} ${timeStr}`;
    noteCell.font = { 
      name: 'Arial', 
      size: 11, 
      bold: true, 
      italic: true,
      color: { argb: '000000' }
    };
    noteCell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true
    };
    noteCell.border = {
      top: { style: 'thin', color: { argb: 'D3D3D3' } },
      left: { style: 'thin', color: { argb: 'D3D3D3' } },
      bottom: { style: 'thin', color: { argb: 'D3D3D3' } },
      right: { style: 'thin', color: { argb: 'D3D3D3' } }
    };

    worksheet.columns = [
      { width: 33 },
      { width: 33 },
      { width: 28 },
      { width: 30 },
      { width: 35 },
      { width: 30 },
      { width: 40 }
    ];

    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Processing_Days_${selectedMonth !== 'All' ? selectedMonth : ''}_${selectedYear !== 'All' ? selectedYear : ''}.xlsx`;
    saveAs(new Blob([buffer]), fileName);
  };

  // Dropdown Component Helpers
  const DropdownButton = ({ label, value, onClick, isOpen }) => (
    <div className="relative w-36">
      <button
        onClick={onClick}
        className={`h-10 bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 ${
          isOpen ? 'rounded-t-xl border-b-0 shadow-lg' : 'rounded-xl'
        } shadow-2xs flex items-center justify-between px-4 font-bold text-xs cursor-pointer transition-all duration-200 w-full`}
      >
        <span className="truncate">{value}</span>
        <FiChevronDown className={`w-3.5 h-3.5 ml-2 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-slate-600' : ''}`} />
      </button>
    </div>
  );

  const DropdownMenu = ({ items, onSelect, isOpen, className }) => (
    isOpen && (
      <div
        className={`absolute top-[98%] left-0 z-30 w-full bg-white rounded-b-xl shadow-lg border border-slate-200/60 overflow-hidden py-1 divide-y divide-slate-100 ${className}`}
      >
        {items.map((item) => (
          <button
            key={item}
            className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
            onClick={() => onSelect(item)}
          >
            {item}
          </button>
        ))}
      </div>
    )
  );

  return (
    <div className="p-2 space-y-6">
      {/* Header Panel with Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Processing Days</h1>
          <p className="text-xs text-slate-400 mt-0.5 font-medium font-sans">Track business turnaround times, calculate network days, and manage exceptions</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search bar */}
          <div className="relative w-72 h-10 bg-white border border-slate-200/80 rounded-xl shadow-2xs flex items-center px-3.5 focus-within:border-[#0b4c95] focus-within:ring-4 focus-within:ring-sky-500/10 transition-all duration-200">
            <FiSearch className="text-slate-400 w-4 h-4 mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by DTS no. or doc type..."
              className="w-full bg-transparent outline-none text-slate-700 placeholder:text-slate-400 text-xs font-semibold"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Month Dropdown */}
          <div className="relative">
            <DropdownButton 
              value={selectedMonth} 
              onClick={() => {
                setShowMonthDropdown(!showMonthDropdown);
                setShowYearDropdown(false);
              }}
              isOpen={showMonthDropdown}
            />
            <DropdownMenu
              items={months}
              onSelect={(month) => {
                setSelectedMonth(month);
                setShowMonthDropdown(false);
              }}
              isOpen={showMonthDropdown}
            />
          </div>

          {/* Year Dropdown */}
          <div className="relative">
            <DropdownButton 
              value={selectedYear} 
              onClick={() => {
                setShowYearDropdown(!showYearDropdown);
                setShowMonthDropdown(false);
              }}
              isOpen={showYearDropdown}
            />
            <DropdownMenu
              items={years.map(String)}
              onSelect={(year) => {
                setSelectedYear(Number(year));
                setShowYearDropdown(false);
              }}
              isOpen={showYearDropdown}
            />
          </div>

          {/* Export to Excel */}
          <button
            onClick={handleExportToExcel}
            className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-2xs transition-all duration-200 cursor-pointer flex items-center gap-1.5"
            title="Export filtered records to Excel"
          >
            <FiDownload className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Processing Days Table Container */}
      <div className="table-container-premium shadow-2xs">
        <div className="overflow-x-auto">
          <table className="table-premium w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="w-[15%] text-center">
                  {admin?.documentdirection === 'incoming' ? 'Date Sent' : 'Date Received'}
                </th>
                <th className="w-[15%] text-center">Date Released</th>
                <th className="w-[12%] text-center">DTS No.</th>
                <th className="w-[12%] text-center">Direction</th>
                <th className="w-[18%]">Document Type</th>
                <th className="w-[12%] text-center font-bold">Processing Days</th>
                <th className="w-[16%]">Remarks</th>
                <th className="w-[10%] text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-10 text-slate-400 font-semibold">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-sky-700" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Loading records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredDocuments.length > 0 ? (
                filteredDocuments.map((doc) => {
                  const isLongDuration = doc.calcnetworkdays > 5 || doc.calcnetworkdays <= 0;

                  return (
                    <tr key={doc.documentid}>
                      <td className="text-center font-medium text-slate-500 text-xs">
                        {formatDate(doc.dateSent)}
                      </td>
                      <td className="text-center font-medium text-slate-500 text-xs">
                        {doc.dateReceive}
                      </td>
                      <td className="text-center font-extrabold text-slate-800 text-xs">
                        {doc.dtsNo}
                      </td>
                      <td className="text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-pink-50 text-pink-700 border-pink-200/50">
                          Outgoing
                        </span>
                      </td>
                      <td className="font-semibold text-slate-700 text-xs max-w-[150px] truncate" title={doc.documentType}>
                        {doc.documentType}
                      </td>
                      <td className="text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase border ${
                          isLongDuration 
                            ? 'bg-rose-50 text-rose-700 border-rose-200/50' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                        }`}>
                          {doc.calcnetworkdays !== null && !isNaN(doc.calcnetworkdays)
                            ? `${doc.calcnetworkdays} days`
                            : '-'}
                        </span>
                      </td>
                      <td className="text-slate-500 font-medium text-xs max-w-[150px] truncate" title={doc.networkdaysremarks}>
                        {doc.networkdaysremarks !== '-' ? doc.networkdaysremarks : '-'}
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={!isIncomingAdmin ? () => handleEdit(doc) : undefined}
                            className={`p-2 rounded-lg transition-colors cursor-pointer border ${
                              isIncomingAdmin
                                ? 'opacity-40 cursor-not-allowed text-slate-400 border-slate-100'
                                : 'text-sky-600 hover:bg-sky-50 border-sky-100'
                            }`}
                            title={isIncomingAdmin ? "View only - actions disabled" : "Adjust deducted days"}
                            disabled={isIncomingAdmin}
                          >
                            <FiEdit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={!isIncomingAdmin ? () => handleClear(doc.documentid) : undefined}
                            className={`p-2 rounded-lg transition-colors cursor-pointer border ${
                              isIncomingAdmin
                                ? 'opacity-40 cursor-not-allowed text-slate-400 border-slate-100'
                                : 'text-pink-600 hover:bg-pink-50 border-pink-100'
                            }`}
                            title={isIncomingAdmin ? "View only - actions disabled" : "Clear Deducted Days"}
                            disabled={isIncomingAdmin}
                          >
                            <FiSlash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="8" className="text-center py-16 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FiSearch className="w-8 h-8 opacity-30" />
                      <p className="text-sm font-semibold">No records found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showNetworkModal && (
        <OverlayProcessingDays 
          isOpen={showNetworkModal}
          onClose={(shouldRefresh) => {
            setShowNetworkModal(false);
            setSelectedDocument(null);
            setIsViewMode(false);
            setIsEditMode(false);
            if (shouldRefresh) {
              fetchDocuments();
            }
          }}
          editingDoc={selectedDocument}
          viewMode={isViewMode}
          editMode={isEditMode}
          calculateNetworkDays={calculateNetworkDays}
        />
      )}
    </div>
  );
}

export default NetworkDays;