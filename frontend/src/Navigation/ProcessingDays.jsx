import React, { useState, useEffect, useCallback } from 'react';
import OverlayProcessingDays from '../OverlayModal/OverlayProcessingDays';
import Swal from 'sweetalert2'; 
import { io } from 'socket.io-client';
import moment from 'moment';
import { FiEdit2, FiSlash, FiSearch, FiChevronDown, FiDownload, FiChevronLeft, FiChevronRight, FiArrowUp, FiArrowDown } from 'react-icons/fi';
import '../index.css';

function calculateNetworkDays(startDate, endDate, holidaysList = [], includeFriday = true) {
  if (!startDate || !endDate || endDate === '-') return 0;
  
  try {
    const start = parseDateReleased(startDate) || new Date(startDate);
    const end = parseDateReleased(endDate) || new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    if (start > end) return 0;

    let count = 0;
    const current = new Date(start);
    const holidaySet = new Set(holidaysList.map(h => typeof h === 'string' ? h : h.holidaydate));
    
    while (current <= end) {
      const day = current.getDay();
      let isWorkDay = true;
      
      if (day === 0 || day === 6) {
        isWorkDay = false;
      } else if (day === 5 && !includeFriday) {
        isWorkDay = false;
      } else {
        const dateStr = current.getFullYear() + '-' + 
                        String(current.getMonth() + 1).padStart(2, '0') + '-' + 
                        String(current.getDate()).padStart(2, '0');
        if (holidaySet.has(dateStr)) {
          isWorkDay = false;
        }
      }
      
      if (isWorkDay) {
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

const formatDate = (dateString) => {
  if (!dateString || dateString === '-') return '-';
  if (moment.isMoment(dateString))
    return dateString.format('MMMM D, YYYY [at] h:mm A');
  try {
    if (
      typeof dateString === 'string' &&
      (dateString.includes(' at ') ||
        dateString.match(/^[A-Z][a-z]+ \d{1,2}, \d{4}/))
    ) {
      return dateString;
    }
    const m = moment.utc(dateString);
    return m.isValid() ? m.format('MMMM D, YYYY [at] h:mm A') : '-';
  } catch (e) {
    return '-';
  }
};

const formatDateOnly = (dateString) => {
  if (!dateString || dateString === '-') return '-';
  if (moment.isMoment(dateString))
    return dateString.format('MMMM D, YYYY');
  try {
    if (typeof dateString === 'string') {
      const atIndex = dateString.indexOf(' at ');
      if (atIndex !== -1) {
        return dateString.substring(0, atIndex).trim();
      }
      const match = dateString.match(/^([A-Za-z]+ \d{1,2}, \d{4})/);
      if (match) {
        return match[1];
      }
    }
    const m = moment.utc(dateString);
    return m.isValid() ? m.format('MMMM D, YYYY') : '-';
  } catch (e) {
    return '-';
  }
};

const formatTimeOnly = (dateString) => {
  if (!dateString || dateString === '-') return '-';
  if (moment.isMoment(dateString))
    return dateString.format('h:mm A');
  try {
    if (typeof dateString === 'string') {
      const atIndex = dateString.indexOf(' at ');
      if (atIndex !== -1) {
        return dateString.substring(atIndex + 4).trim();
      }
    }
    const m = moment.utc(dateString);
    return m.isValid() ? m.format('h:mm A') : '-';
  } catch (e) {
    return '-';
  }
};

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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: 'dateSent', direction: 'desc' });
  const [updatingTimeId, setUpdatingTimeId] = useState(null);
  const [holidays, setHolidays] = useState([]);
  
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const [columnFilters, setColumnFilters] = useState({
    dateSent: '',
    dtsNo: '',
    direction: '',
    docType: '',
    timeReceived: '',
    dateReleased: '',
    daysProcessed: '',
    route: '',
    processedBy: '',
    payee: '',
    seriesNo: '',
    remarks: '',
  });
  const adminData = localStorage.getItem('admin');
  const admin = adminData ? JSON.parse(adminData) : null;
  const isIncomingAdmin = admin?.documentdirection === 'incoming';

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedMonth, selectedYear, columnFilters, sortConfig]);

  const API_URL = import.meta.env.VITE_API_URL;
  const months = ['All', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const res = await fetch(`${API_URL}/api/holidays`);
        if (res.ok) {
          const data = await res.json();
          setHolidays(data);
        }
      } catch (err) {
        console.error('Error fetching holidays:', err);
      }
    };
    fetchHolidays();
  }, [API_URL]);

  const fetchDocuments = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const response = await fetch(`${API_URL}/api/documents`);
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      const holidayDates = holidays.map(h => h.holidaydate);
      const filteredDocuments = data
        .filter(doc => {
          if (doc.documentdirection !== 'outgoing') return false;
          const normalizedRoute = (doc.route || '').replace(/_/g, ' ').toLowerCase();
          return normalizedRoute === 'accounting unit' || normalizedRoute === 'ord';
        })
        .map(doc => {
          const businessDays = doc.datereleased && doc.datereleased !== '-' 
            ? calculateNetworkDays(doc.datesent, doc.datereleased, holidayDates, doc.include_friday !== false)
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
            daysProcessed: doc.daysprocessed !== null && doc.daysprocessed !== undefined && Number(doc.daysprocessed) > 0
              ? Number(doc.daysprocessed)
              : null,
            networkdaysremarks: doc.networkdaysremarks || '-',
            documentType: doc.documenttype,
            route: doc.route,
            isarchive: doc.isarchive,
            time: doc.time || '-',
            seriesNo: doc.seriesno || '-',
            queueNo: doc.queueno || '-',
            payee: doc.payee || '-',
            amount: doc.amount !== null && doc.amount !== undefined ? Number(doc.amount) : null,
            processedBy: doc.processedby || '-',
            particulars: doc.particulars || '-',
            documentDirection: doc.documentdirection,
            include_friday: doc.include_friday
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
  }, [API_URL, holidays]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    const socket = io(API_URL);
    const handleUpdate = () => {
      fetchDocuments(true);
    };
    socket.on('documents_updated', handleUpdate);

    return () => {
      socket.off('documents_updated', handleUpdate);
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
      calcnetworkdays: doc.calcnetworkdays,
      include_friday: doc.include_friday,
      daysProcessed: doc.daysProcessed
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
  
  const handleTimeChange = async (docId, newTime) => {
    setUpdatingTimeId(docId);
    try {
      const response = await fetch(`${API_URL}/api/documents/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time: newTime }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update time');
      }

      setDocuments((prevDocs) =>
        prevDocs.map((doc) =>
          doc.documentid === docId ? { ...doc, time: newTime || '-' } : doc,
        ),
      );

      Swal.fire({
        icon: 'success',
        title: 'Time Updated',
        text: 'Time Received has been updated.',
        timer: 1200,
        showConfirmButton: false,
        customClass: { popup: 'swal2-minimalist' },
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Failed to Update',
        text: error.message || 'Failed to update time.',
        timer: 2000,
        showConfirmButton: false,
        customClass: { popup: 'swal2-minimalist' },
      });
    } finally {
      setUpdatingTimeId(null);
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const docDate = moment(doc.dateSent).toDate();
    const search = searchTerm.toLowerCase();
    const docType = doc.documentType?.toLowerCase().replace(/_/g, ' ');
    const route = doc.route?.toLowerCase().replace(/_/g, ' ');
    const time = doc.time?.toLowerCase().replace(/_/g, ' ');
    const direction = doc.documentDirection?.toLowerCase();
    const processedByVal = doc.processedBy?.toLowerCase();
    const matchesSearch =
      (doc.dtsNo?.toLowerCase() || '').includes(search) ||
      (doc.seriesNo?.toLowerCase() || '').includes(search) ||
      (doc.queueNo?.toLowerCase() || '').includes(search) ||
      (doc.particulars?.toLowerCase() || '').includes(search) ||
      (docType || '').includes(search) ||
      (route || '').includes(search) ||
      (time || '').includes(search) ||
      (direction || '').includes(search) ||
      (processedByVal || '').includes(search) ||
      (doc.payee?.toLowerCase() || '').includes(search) ||
      (doc.amount !== null && doc.amount !== undefined ? String(doc.amount) : '').includes(search);

    let matchesMonth = true;
    let matchesYear = true;
    if (selectedMonth !== 'All' || selectedYear !== 'All') {
      const dateReleased = parseDateReleased(doc.dateReceive) || moment(doc.dateSent).toDate();
      if (dateReleased && !isNaN(dateReleased.getTime())) {
        matchesMonth = selectedMonth === 'All' || dateReleased.toLocaleString('en-US', { month: 'long' }) === selectedMonth;
        matchesYear = selectedYear === 'All' || dateReleased.getFullYear() === selectedYear;
      } else {
        matchesMonth = false;
        matchesYear = false;
      }
    }

    const matchesColumnFilters =
      (columnFilters.dateSent === '' ||
        (doc.dateSent
          ? String(formatDateOnly(doc.dateSent))
              .toLowerCase()
              .includes(columnFilters.dateSent.toLowerCase())
          : false)) &&
      (columnFilters.dtsNo === '' ||
        (doc.dtsNo || '')
          .toLowerCase()
          .includes(columnFilters.dtsNo.toLowerCase())) &&
      (columnFilters.seriesNo === '' ||
        (doc.seriesNo || '')
          .toLowerCase()
          .includes(columnFilters.seriesNo.toLowerCase())) &&
      (columnFilters.direction === '' ||
        (doc.documentDirection || '')
          .toLowerCase()
          .includes(columnFilters.direction.toLowerCase())) &&
      (columnFilters.docType === '' ||
        (docType || '').includes(columnFilters.docType.toLowerCase())) &&
      (columnFilters.timeReceived === '' ||
        (time || '').includes(columnFilters.timeReceived.toLowerCase())) &&
      (columnFilters.dateReleased === '' ||
        (doc.dateReceive
          ? String(formatDateOnly(doc.dateReceive))
              .toLowerCase()
              .includes(columnFilters.dateReleased.toLowerCase())
          : false) ||
        (doc.dateReceive === '-' && columnFilters.dateReleased === '-')) &&
      (columnFilters.daysProcessed === '' ||
        (doc.daysProcessed !== null && doc.daysProcessed !== undefined
          ? String(doc.daysProcessed) === columnFilters.daysProcessed
          : false) ||
        (doc.daysProcessed === null && columnFilters.daysProcessed === '-')) &&
      (columnFilters.route === '' ||
        (route || '').includes(columnFilters.route.toLowerCase())) &&
      (columnFilters.remarks === '' ||
        (doc.networkdaysremarks || '')
          .toLowerCase()
          .includes(columnFilters.remarks.toLowerCase())) &&
      (columnFilters.processedBy === '' ||
        (doc.processedBy || '')
          .toLowerCase()
          .includes(columnFilters.processedBy.toLowerCase())) &&
      (columnFilters.payee === '' ||
        (doc.payee || '')
          .toLowerCase()
          .includes(columnFilters.payee.toLowerCase()));

    return matchesSearch && matchesMonth && matchesYear && matchesColumnFilters;
  });

  // Sorting calculation
  if (sortConfig.key !== null) {
    filteredDocuments.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      // Custom comparisons
      if (sortConfig.key === 'daysProcessed') {
        aVal = a.daysProcessed !== null && a.daysProcessed !== undefined ? a.daysProcessed : a.calcnetworkdays;
        bVal = b.daysProcessed !== null && b.daysProcessed !== undefined ? b.daysProcessed : b.calcnetworkdays;
      }

      if (aVal === null || aVal === undefined || aVal === '-') return 1;
      if (bVal === null || bVal === undefined || bVal === '-') return -1;

      if (typeof aVal === 'string') {
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else {
        return sortConfig.direction === 'asc'
          ? aVal - bVal
          : bVal - aVal;
      }
    });
  }

  // Pagination calculation
  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentDocuments = filteredDocuments.slice(indexOfFirstItem, indexOfLastItem);

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
    const exportDocuments = documents.filter((doc) => {
      const docDate = moment(doc.dateSent).toDate();
      const matchesMonth =
        selectedMonth === 'All' ||
        docDate.toLocaleString('en-US', { month: 'long' }) === selectedMonth;
      const matchesYear =
        selectedYear === 'All' || docDate.getFullYear() === selectedYear;
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
          popup: 'swal2-minimalist',
        },
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
    const worksheet = workbook.addWorksheet(sheetName || 'Documents');

    const headers = [
      'Date Sent',
      'Date Released',
      'Days Processed',
      'Time Received',
      'DTS No.',
      'Series No.',
      'Queue No.',
      'Document Status',
      'Document Type',
      'Payee',
      'Gross Amount',
      'Particulars',
      'Routed To',
      'Remarks',
    ];
    worksheet.addRow(headers);

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
        size: 13,
        name: 'Arial',
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '1460A2' },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
    headerRow.height = 30;

    exportDocuments
      .slice()
      .reverse()
      .forEach((doc) => {
        const daysVal = doc.daysProcessed !== null && doc.daysProcessed !== undefined
          ? doc.daysProcessed
          : doc.calcnetworkdays;

        const rowValues = [
          formatDate(doc.dateSent),
          doc.dateReceive || '-',
          daysVal !== null && !isNaN(daysVal) ? Number(daysVal) : '-',
          doc.time?.replace('_', ' ').toUpperCase() || '-',
          doc.dtsNo,
          doc.seriesNo || '-',
          doc.queueNo || '-',
          'Outgoing',
          doc.documentType?.trim() || '-',
          doc.payee || '-',
          doc.amount !== null && doc.amount !== undefined ? Number(doc.amount) : '-',
          doc.particulars || '-',
          doc.route?.replace(/_/g, ' ') || '-',
          doc.networkdaysremarks && doc.networkdaysremarks !== '-' ? doc.networkdaysremarks : '-',
        ];
        const row = worksheet.addRow(rowValues);

        row.eachCell((cell, colNumber) => {
          cell.font = { name: 'Arial', size: 11, color: { argb: '000000' } };
          
          let horizontalAlign = 'center';
          if (colNumber === 10 || colNumber === 12 || colNumber === 14) { // Payee, Particulars, and Remarks
            horizontalAlign = 'left';
          } else if (colNumber === 11) { // Gross Amount
            horizontalAlign = 'right';
          }

          cell.alignment = {
            vertical: 'middle',
            horizontal: horizontalAlign,
            wrapText: true,
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'D3D3D3' } },
            left: { style: 'thin', color: { argb: 'D3D3D3' } },
            bottom: { style: 'thin', color: { argb: 'D3D3D3' } },
            right: { style: 'thin', color: { argb: 'D3D3D3' } },
          };

          if (colNumber === 5 || colNumber === 6 || colNumber === 7) {
            cell.font = {
              name: 'Arial',
              bold: true,
              size: 11,
              color: { argb: '000000' },
            };
          }

          if (colNumber === 8) {
            cell.font = {
              name: 'Arial',
              bold: true,
              size: 11,
              color: { argb: 'FFFFFFFF' },
            };
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: '123052' },
            };
          }

          if (colNumber === 3) {
            cell.numFmt = '0.0';
            if (daysVal !== null && !isNaN(daysVal)) {
              if (daysVal > 5 || daysVal <= 0) {
                cell.font = { name: 'Arial', color: { argb: 'FF0000' }, size: 11 };
              } else {
                cell.font = { name: 'Arial', color: { argb: '28A745' }, size: 11 };
              }
            }
          }

          if (colNumber === 11 && typeof cell.value === 'number') {
            cell.numFmt = '₱#,##0.00';
          }

          if (colNumber === 13) {
            const route = cell.value?.toString() || '';
            if (route === 'For Compliance') {
              cell.font = {
                name: 'Arial',
                size: 11,
                color: { argb: 'DC3545' },
              };
            } else {
              cell.font = {
                name: 'Arial',
                size: 11,
                color: { argb: '000000' },
              };
            }
          }
        });

        row.height = 25;
      });

    const validProcessingDays = exportDocuments
      .map(doc => doc.daysProcessed !== null && doc.daysProcessed !== undefined ? doc.daysProcessed : doc.calcnetworkdays)
      .filter(days => days !== null && !isNaN(days) && days > 0);
    
    if (validProcessingDays.length > 0) {
      const averageDays = (validProcessingDays.reduce((sum, days) => sum + days, 0) / validProcessingDays.length).toFixed(2);
      
      const emptyRow = worksheet.addRow(['', '', '', '', '', '', '', '', '', '', '', '', '', '']);
      emptyRow.height = 20;
      
      const averageRow = worksheet.addRow(['', '', `Average: ${averageDays}`, '', '', '', '', '', '', '', '', '', '', '']);
      averageRow.height = 25;
      
      averageRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 11, bold: true };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber === 3 ? 'center' : 'left',
          wrapText: true
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'D3D3D3' } },
          left: { style: 'thin', color: { argb: 'D3D3D3' } },
          bottom: { style: 'thin', color: { argb: 'D3D3D3' } },
          right: { style: 'thin', color: { argb: 'D3D3D3' } }
        };
        
        if (colNumber === 3) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F0F0F0' } };
          cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: '000000' } };
        }
      });
    }

    const currentDate = new Date();
    const dateStr = currentDate.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    const timeStr = currentDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    for (let i = 0; i < 3; i++) {
      const spacingRow = worksheet.addRow(['', '', '', '', '', '', '', '', '', '', '', '', '', '']);
      spacingRow.height = 15;
    }

    const noteRow = worksheet.addRow(['', '', '', '', '', '', '', '', '', '', '', '', '', '']);
    noteRow.height = 20;

    worksheet.mergeCells(`A${noteRow.number}:N${noteRow.number}`);

    const noteCell = worksheet.getCell(`A${noteRow.number}`);
    noteCell.value = `Note: This is a system-generated file. Generated on: ${dateStr} ${timeStr}`;
    noteCell.font = {
      name: 'Arial',
      size: 11,
      bold: true,
      italic: true,
      color: { argb: '000000' },
    };
    noteCell.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
    noteCell.border = {
      top: { style: 'thin', color: { argb: 'D3D3D3' } },
      left: { style: 'thin', color: { argb: 'D3D3D3' } },
      bottom: { style: 'thin', color: { argb: 'D3D3D3' } },
      right: { style: 'thin', color: { argb: 'D3D3D3' } },
    };

    worksheet.columns = [
      { width: 33 }, // Date Sent
      { width: 33 }, // Date Released
      { width: 20 }, // Days Processed
      { width: 25 }, // Time Received
      { width: 28 }, // DTS No.
      { width: 25 }, // Series No.
      { width: 25 }, // Queue No.
      { width: 30 }, // Document Status
      { width: 35 }, // Document Type
      { width: 30 }, // Payee
      { width: 20 }, // Gross Amount
      { width: 40 }, // Particulars
      { width: 30 }, // Routed To
      { width: 40 }, // Remarks
    ];

    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Processed_Documents_${selectedMonth !== 'All' ? selectedMonth : ''}_${selectedYear !== 'All' ? selectedYear : ''}.xlsx`;
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

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <span className="opacity-30 ml-1 text-[10px] select-none">⇅</span>;
    }
    return sortConfig.direction === 'asc' 
      ? <FiArrowUp className="inline w-3 h-3 ml-1 text-[#0b4c95]" />
      : <FiArrowDown className="inline w-3 h-3 ml-1 text-[#0b4c95]" />;
  };

  const validShowedProcessingDays = filteredDocuments
    .map(doc => doc.daysProcessed !== null && doc.daysProcessed !== undefined ? doc.daysProcessed : doc.calcnetworkdays)
    .filter(days => days !== null && !isNaN(days) && days > 0);
  const showedAverageDays = validShowedProcessingDays.length > 0
    ? (validShowedProcessingDays.reduce((sum, days) => sum + days, 0) / validShowedProcessingDays.length).toFixed(2)
    : '0.00';

  const uniqueValues = {
    dateSent: [...new Set(documents.map((d) => formatDateOnly(d.dateSent)))].filter((v) => v !== '-').sort((a, b) => new Date(a) - new Date(b)),
    direction: [...new Set(documents.map((d) => d.documentDirection))].filter(Boolean).sort(),
    payee: [...new Set(documents.map((d) => d.payee))].filter((v) => v && v !== '-').sort(),
    docType: [...new Set(documents.map((d) => d.documentType))].filter(Boolean).sort(),
    dateReleased: [...new Set(documents.map((d) => formatDateOnly(d.dateReceive)))].filter((v) => v !== '-').sort(),
    daysProcessed: [...new Set(documents.map((d) => d.daysProcessed !== null && d.daysProcessed !== undefined ? String(d.daysProcessed) : (d.calcnetworkdays !== null && d.calcnetworkdays !== undefined ? String(d.calcnetworkdays) : '-')))].filter((v) => v !== '-').sort((a, b) => Number(a) - Number(b)),
    route: [...new Set(documents.map((d) => d.route))].filter((v) => v && v !== '-').sort(),
    processedBy: [...new Set(documents.map((d) => d.processedBy))].filter((v) => v && v !== '-').sort(),
  };

  const selectFilterClass =
    'text-[11px] p-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:border-sky-500 cursor-pointer w-full';

  return (
    <div className="space-y-6">
      {/* Header Panel with Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Processed Documents</h1>
            <p className="text-xs text-slate-400 mt-0.5 font-medium font-sans">Track business turnaround times, calculate network days, and manage exceptions</p>
          </div>
          <div className="bg-sky-50 border border-sky-100 rounded-xl px-4 py-2 flex flex-col justify-center items-center shadow-3xs">
            <span className="text-[9px] font-bold text-sky-600 uppercase tracking-wider">Average Turnaround</span>
            <span className="text-sm font-extrabold text-sky-800 mt-0.5">{showedAverageDays} Days</span>
          </div>
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

      {/* Horizontal Column Filters Panel */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-wrap items-center gap-4 shadow-3xs">
        <div className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mr-1">Filters:</div>

        {/* Date Sent/Received */}
        <div className="flex flex-col gap-1 w-32">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            {admin?.documentdirection === 'incoming' ? 'Date Received' : 'Date Sent'}
          </span>
          <select
            className={selectFilterClass}
            value={columnFilters.dateSent}
            onChange={(e) => setColumnFilters({ ...columnFilters, dateSent: e.target.value })}
          >
            <option value="">All</option>
            {uniqueValues.dateSent.map((val, i) => (
              <option key={i} value={val}>{val}</option>
            ))}
          </select>
        </div>

        {/* Direction */}
        <div className="flex flex-col gap-1 w-28">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Direction</span>
          <select
            className={selectFilterClass}
            value={columnFilters.direction}
            onChange={(e) => setColumnFilters({ ...columnFilters, direction: e.target.value })}
          >
            <option value="">All</option>
            {uniqueValues.direction.map((val, i) => (
              <option key={i} value={val}>{val}</option>
            ))}
          </select>
        </div>

        {/* Payee */}
        <div className="flex flex-col gap-1 w-36">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Payee</span>
          <select
            className={selectFilterClass}
            value={columnFilters.payee}
            onChange={(e) => setColumnFilters({ ...columnFilters, payee: e.target.value })}
          >
            <option value="">All</option>
            {uniqueValues.payee.map((val, i) => (
              <option key={i} value={val}>{val}</option>
            ))}
          </select>
        </div>

        {/* Document Type */}
        <div className="flex flex-col gap-1 w-40">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Document Type</span>
          <select
            className={selectFilterClass}
            value={columnFilters.docType}
            onChange={(e) => setColumnFilters({ ...columnFilters, docType: e.target.value })}
          >
            <option value="">All</option>
            {uniqueValues.docType.map((val, i) => (
              <option key={i} value={val}>{val}</option>
            ))}
          </select>
        </div>

        {/* Date Released */}
        <div className="flex flex-col gap-1 w-32">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Date Released</span>
          <select
            className={selectFilterClass}
            value={columnFilters.dateReleased}
            onChange={(e) => setColumnFilters({ ...columnFilters, dateReleased: e.target.value })}
          >
            <option value="">All</option>
            {uniqueValues.dateReleased.map((val, i) => (
              <option key={i} value={val}>{val}</option>
            ))}
          </select>
        </div>

        {/* Routed To */}
        <div className="flex flex-col gap-1 w-32">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Routed To</span>
          <select
            className={selectFilterClass}
            value={columnFilters.route}
            onChange={(e) => setColumnFilters({ ...columnFilters, route: e.target.value })}
          >
            <option value="">All</option>
            {uniqueValues.route.map((val, i) => (
              <option key={i} value={val}>{val}</option>
            ))}
          </select>
        </div>

        {/* Processed By */}
        <div className="flex flex-col gap-1 w-36">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Processed By</span>
          <select
            className={selectFilterClass}
            value={columnFilters.processedBy}
            onChange={(e) => setColumnFilters({ ...columnFilters, processedBy: e.target.value })}
          >
            <option value="">All</option>
            {uniqueValues.processedBy.map((val, i) => (
              <option key={i} value={val}>{val}</option>
            ))}
          </select>
        </div>

        {/* Reset Button */}
        {Object.keys(columnFilters).some((key) => columnFilters[key] !== '') && (
          <button
            onClick={() =>
              setColumnFilters({
                dateSent: '',
                dtsNo: '',
                direction: '',
                docType: '',
                timeReceived: '',
                dateReleased: '',
                daysProcessed: '',
                route: '',
                processedBy: '',
                payee: '',
                seriesNo: '',
                remarks: '',
              })
            }
            className="ml-auto text-xs font-bold text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Processing Days Table Container */}
      <div className="table-container-premium shadow-2xs">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-thin">
          <table className="table-premium w-full text-left border-collapse relative">
            <thead>
              <tr>
                <th
                  className="w-[12%] text-center py-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                  onClick={() => requestSort('dateSent')}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{admin?.documentdirection === 'incoming' ? 'Date Received' : 'Date Sent'}</span>
                    {renderSortIcon('dateSent')}
                  </div>
                </th>
                <th
                  className="w-[10%] text-center py-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                  onClick={() => requestSort('dtsNo')}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>DTS No.</span>
                    {renderSortIcon('dtsNo')}
                  </div>
                </th>
                <th
                  className="w-[10%] text-center py-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                  onClick={() => requestSort('seriesNo')}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Series No.</span>
                    {renderSortIcon('seriesNo')}
                  </div>
                </th>
                <th
                  className="w-[10%] text-center py-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                  onClick={() => requestSort('queueNo')}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Queue No.</span>
                    {renderSortIcon('queueNo')}
                  </div>
                </th>
                <th
                  className="w-[9%] text-center py-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                  onClick={() => requestSort('documentDirection')}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Direction</span>
                    {renderSortIcon('documentDirection')}
                  </div>
                </th>
                <th
                  className="w-[12%] py-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                  onClick={() => requestSort('payee')}
                >
                  <div className="flex items-center gap-1">
                    <span>Payee</span>
                    {renderSortIcon('payee')}
                  </div>
                </th>
                <th
                  className="w-[15%] py-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                  onClick={() => requestSort('documentType')}
                >
                  <div className="flex items-center gap-1">
                    <span>Document Type</span>
                    {renderSortIcon('documentType')}
                  </div>
                </th>
                <th
                  className="w-[12%] text-center py-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                  onClick={() => requestSort('dateReceive')}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Date Released</span>
                    {renderSortIcon('dateReceive')}
                  </div>
                </th>
                <th
                  className="w-[12%] text-center py-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                  onClick={() => requestSort('daysProcessed')}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Processing Days</span>
                    {renderSortIcon('daysProcessed')}
                  </div>
                </th>
                <th
                  className="w-[12%] py-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                  onClick={() => requestSort('route')}
                >
                  <div className="flex items-center gap-1">
                    <span>Routed To</span>
                    {renderSortIcon('route')}
                  </div>
                </th>
                <th
                  className="w-[12%] py-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                  onClick={() => requestSort('processedBy')}
                >
                  <div className="flex items-center gap-1">
                    <span>Processed By</span>
                    {renderSortIcon('processedBy')}
                  </div>
                </th>
                <th className="w-[10%] text-center py-3 select-none">
                  <span>Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="12" className="text-center py-10 text-slate-400 font-semibold">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-sky-700" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Loading records...</span>
                    </div>
                  </td>
                </tr>
              ) : currentDocuments.length > 0 ? (
                currentDocuments.map((doc) => {
                  const direction = doc.documentDirection?.toLowerCase() || 'outgoing';
                  let directionBadgeClass = 'bg-slate-50 text-slate-600 border-slate-200';
                  if (direction === 'incoming') {
                    directionBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200/50';
                  } else if (direction === 'outgoing') {
                    directionBadgeClass = 'bg-blue-50 text-blue-700 border-blue-200/50';
                  }

                  return (
                    <tr key={doc.documentid}>
                      <td className="text-left text-xs">
                        {doc.dateSent !== '-' ? (
                          <div className="flex flex-col items-start">
                            <span className="font-bold text-slate-800">{formatDateOnly(doc.dateSent)}</span>
                            <span className="text-[10px] text-slate-400 font-semibold mt-0.5">{formatTimeOnly(doc.dateSent)}</span>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="text-center font-extrabold text-slate-800 text-xs">
                        {doc.dtsNo}
                      </td>
                      <td className="text-center font-bold text-slate-700 text-xs">
                        {doc.seriesNo || '-'}
                      </td>
                      <td className="text-center font-bold text-slate-700 text-xs">
                        {doc.queueNo || '-'}
                      </td>
                      <td className="text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${directionBadgeClass}`}>
                          {doc.documentDirection}
                        </span>
                      </td>
                      <td className="text-left text-xs">
                        {direction === 'incoming' ? (
                          <span className="font-semibold text-slate-400">-</span>
                        ) : (
                          <div className="flex flex-col items-start">
                            <span className="font-bold text-slate-800 max-w-[120px] truncate" title={doc.payee}>
                              {doc.payee || '-'}
                            </span>
                            {doc.amount !== null && doc.amount !== undefined ? (
                              <span className="text-[10px] text-[#0b4c95] font-bold mt-0.5">
                                {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(doc.amount)}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="font-semibold text-slate-700 text-xs max-w-[150px] truncate" title={doc.documentType}>
                        {doc.documentType}
                      </td>
                      <td className="text-left text-xs">
                        {doc.dateReceive !== '-' ? (
                          <div className="flex flex-col items-start">
                            <span className="font-bold text-slate-800">{formatDateOnly(doc.dateReceive)}</span>
                            <span className="text-[10px] text-slate-400 font-semibold mt-0.5">{formatTimeOnly(doc.dateReceive)}</span>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="text-center font-semibold text-slate-600 text-xs">
                        {(() => {
                          const display = doc.daysProcessed !== null && doc.daysProcessed !== undefined
                            ? doc.daysProcessed
                            : (doc.calcnetworkdays !== null ? doc.calcnetworkdays : null);
                          return display !== null && !isNaN(display)
                            ? Number(display).toFixed(1)
                            : '-';
                        })()}
                      </td>
                      <td className="font-semibold text-slate-700 text-xs max-w-[120px] truncate" title={doc.route?.replace(/_/g, ' ')}>
                        {doc.route?.replace(/_/g, ' ') || '-'}
                      </td>
                      <td className="font-semibold text-slate-700 text-xs max-w-[120px] truncate" title={doc.processedBy}>
                        {doc.processedBy || '-'}
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
                  <td colSpan="12" className="text-center py-16 text-slate-400">
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

      {/* Premium Pagination Controls */}
      {filteredDocuments.length > 0 && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-5 px-6 py-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="text-xs font-semibold text-slate-500">
            Showing <span className="text-slate-800">{filteredDocuments.length === 0 ? 0 : indexOfFirstItem + 1}</span> to{' '}
            <span className="text-slate-800">
              {Math.min(indexOfLastItem, filteredDocuments.length)}
            </span>{' '}
            of <span className="text-slate-800">{filteredDocuments.length}</span> entries
          </div>

          <div className="flex items-center gap-6">
            {/* Rows Per Page Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Show</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 w-16 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 px-2 outline-none focus:border-[#0b4c95] focus:ring-2 focus:ring-sky-500/10 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-xs font-semibold text-slate-500">entries</span>
            </div>

            {/* Page Buttons */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={`p-2 rounded-lg border border-slate-200 text-slate-600 transition-colors flex items-center justify-center ${
                    currentPage === 1
                      ? 'opacity-40 cursor-not-allowed bg-slate-50'
                      : 'hover:bg-slate-50 hover:text-slate-800 cursor-pointer'
                  }`}
                  title="Previous Page"
                >
                  <FiChevronLeft className="w-4 h-4" />
                </button>

                {(() => {
                  const pages = [];
                  const maxVisiblePages = 5;
                  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                  let endPage = startPage + maxVisiblePages - 1;

                  if (endPage > totalPages) {
                    endPage = totalPages;
                    startPage = Math.max(1, endPage - maxVisiblePages + 1);
                  }

                  if (startPage > 1) {
                    pages.push(
                      <button
                        key={1}
                        onClick={() => setCurrentPage(1)}
                        className={`h-8 w-8 rounded-lg text-xs font-bold transition-all duration-200 ${
                          currentPage === 1
                            ? 'bg-[#0b4c95] text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-50 cursor-pointer'
                        }`}
                      >
                        1
                      </button>
                    );
                    if (startPage > 2) {
                      pages.push(
                        <span key="dots-start" className="px-1 text-slate-400 text-xs font-bold">
                          ...
                        </span>
                      );
                    }
                  }

                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i)}
                        className={`h-8 w-8 rounded-lg text-xs font-bold transition-all duration-200 ${
                          currentPage === i
                            ? 'bg-[#0b4c95] text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-50 cursor-pointer'
                        }`}
                      >
                        {i}
                      </button>
                    );
                  }

                  if (endPage < totalPages) {
                    if (endPage < totalPages - 1) {
                      pages.push(
                        <span key="dots-end" className="px-1 text-slate-400 text-xs font-bold">
                          ...
                        </span>
                      );
                    }
                    pages.push(
                      <button
                        key={totalPages}
                        onClick={() => setCurrentPage(totalPages)}
                        className={`h-8 w-8 rounded-lg text-xs font-bold transition-all duration-200 ${
                          currentPage === totalPages
                            ? 'bg-[#0b4c95] text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-50 cursor-pointer'
                        }`}
                      >
                        {totalPages}
                      </button>
                    );
                  }

                  return pages;
                })()}

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={`p-2 rounded-lg border border-slate-200 text-slate-600 transition-colors flex items-center justify-center ${
                    currentPage === totalPages
                      ? 'opacity-40 cursor-not-allowed bg-slate-50'
                      : 'hover:bg-slate-50 hover:text-slate-800 cursor-pointer'
                  }`}
                  title="Next Page"
                >
                  <FiChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
          holidaysList={holidays}
        />
      )}
    </div>
  );
}

export default NetworkDays;