import React, { useState, useEffect, useCallback } from 'react';
import OverlayIncoming from '../OverlayModal/OverlayIncoming';
import OverlayOutgoing from '../OverlayModal/OverlayOutgoing';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import Swal from 'sweetalert2';
import { io } from 'socket.io-client';
import moment from 'moment';
import { FiSearch, FiChevronDown, FiPlus, FiDownload, FiEye, FiEdit2, FiArchive } from 'react-icons/fi';
import '../index.css';

function AllDocs() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('en-US', { month: 'long' }));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showIncomingModal, setShowIncomingModal] = useState(false);
  const [showOutgoingModal, setShowOutgoingModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [columnFilters, setColumnFilters] = useState({
    dateSent: '',
    dtsNo: '',
    direction: '',
    docType: '',
    timeReceived: '',
    dateReleased: '',
    route: '',
    remarks: ''
  });
  const API_URL = import.meta.env.VITE_API_URL;
  const months = ['All', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);
  const adminData = localStorage.getItem('admin');
  const admin = adminData ? JSON.parse(adminData) : null;
  const adminDirection = admin?.documentdirection;
  const adminUserType = admin?.usertype;
  const [updatingTimeId, setUpdatingTimeId] = useState(null);
  const [archivingId, setArchivingId] = useState(null);

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/documents`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const transformedDocuments = data.map(doc => ({
        id: doc.documentid,
        dtsNo: doc.dtsno,
        dateSent: doc.datesent,
        documentDirection: doc.documentdirection,
        documentType: doc.documenttype,
        dateReceive: doc.datereleased || '-',
        time: doc.time || '-',
        route: doc.route || '-',
        remarks: doc.remarks || '-',
        archiveStatus: doc.isarchive
      }));
      const filtered = transformedDocuments
        .filter(doc => !doc.archiveStatus)
        .sort((a, b) => new Date(b.dateSent) - new Date(a.dateSent));
      setDocuments(filtered);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setLoading(false);
      Swal.fire({
        icon: 'error',
        title: 'Failed to Load Documents',
        text: 'Please try again.',
        timer: 2500,
        showConfirmButton: false,
        customClass: {
          popup: 'swal2-minimalist'
        }
      });
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

  // Handle View action
  const handleView = (doc) => {
    setSelectedDocument({
        ...doc,
        documentid: doc.id,
        dtsno: doc.dtsNo,
        documenttype: doc.documentType,
        documentdirection: doc.documentDirection, 
        route: doc.route,
        remarks: doc.remarks,
        datereleased: doc.dateReceive,
        time: doc.time
    });
    
    setIsViewMode(true);
    setIsEditMode(false);
    
    if (doc.documentDirection === 'incoming') {
        setShowIncomingModal(true);
        setShowOutgoingModal(false);
    } else {
        setShowOutgoingModal(true);
        setShowIncomingModal(false);
    }
  };

  // Handle Edit action
  const handleEdit = (doc) => {
    const adminData = localStorage.getItem('admin');
    let adminDirection = null;
    
    if (adminData) {
      const admin = JSON.parse(adminData);
      adminDirection = admin.documentdirection;
    }

    setSelectedDocument({
      ...doc,
      documentid: doc.id,
      dtsno: doc.dtsNo,
      documenttype: doc.documentType,
      documentdirection: adminDirection || 'outgoing', 
      route: doc.route,
      remarks: doc.remarks,
      datereleased: doc.dateReceive,
      time: doc.time
    });
    
    setIsViewMode(false);
    setIsEditMode(true);
    
    if (adminDirection === 'incoming') {
      setShowIncomingModal(true);
      setShowOutgoingModal(false);
    } else {
      setShowOutgoingModal(true);
      setShowIncomingModal(false);
    }
  };

  const handleArchive = async (docId) => {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;

    let archiveBy;
    const adminData = localStorage.getItem('admin');
    if (adminData) {
      const admin = JSON.parse(adminData);
      const userType = (admin.usertype || '').toLowerCase();

      if (userType.includes('itsm')) {
        archiveBy = 'ITSM';
      }
      else if (userType.includes('admin')) {
        const adminDir = (admin.documentdirection || '').toLowerCase();
        if (adminDir === 'incoming') {
          archiveBy = 'ORD';
        } else if (adminDir === 'outgoing') {
          archiveBy = 'Budget and Finance Unit';
        }
      }
    }

    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to archive this document?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, archive it!',
      cancelButtonText: 'Cancel',
      customClass: {
        popup: 'swal2-minimalist'
      }
    });
    if (!result.isConfirmed) return;

    setArchivingId(docId);
    try {
      const archiveDateStr = formatArchiveDate();
      const response = await fetch(`${API_URL}/api/documents/${docId}/archive`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isarchive: true,
          archivedate: archiveDateStr,
          archivedby: archiveBy
        })
      });

      if (response.ok) {
        setDocuments(prev => prev.filter(doc => doc.id !== docId));
        Swal.fire({
          icon: 'success',
          title: 'Archived!',
          text: 'Document has been archived.',
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
          title: 'Failed to Archive',
          text: error.message || 'Failed to archive document. Please try again.',
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
        text: 'An error occurred while archiving. Please try again.',
        timer: 2500,
        showConfirmButton: false,
        customClass: {
          popup: 'swal2-minimalist'
        }
      });
    } finally {
      setArchivingId(null);
    }
  };

  const handleTimeChange = async (docId, newTime) => {
    setUpdatingTimeId(docId);
    try {
      const response = await fetch(`${API_URL}/api/documents/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time: newTime })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update time');
      }
      
      setDocuments(prevDocs =>
        prevDocs.map(doc =>
          doc.id === docId ? { ...doc, time: newTime || '-' } : doc
        )
      );
      
      Swal.fire({
        icon: 'success',
        title: 'Time Updated',
        text: 'Time Received has been updated.',
        timer: 1200,
        showConfirmButton: false,
        customClass: { popup: 'swal2-minimalist' }
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Failed to Update',
        text: error.message || 'Failed to update time.',
        timer: 2000,
        showConfirmButton: false,
        customClass: { popup: 'swal2-minimalist' }
      });
    } finally {
      setUpdatingTimeId(null);
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const docDate = new Date(doc.dateSent);
    const search = searchTerm.toLowerCase();
    const docType = doc.documentType?.toLowerCase().replace(/_/g, ' ');
    const route = doc.route?.toLowerCase().replace(/_/g, ' ');
    const time = doc.time?.toLowerCase().replace(/_/g, ' ');
    const direction = doc.documentDirection?.toLowerCase();
    const matchesSearch =
      doc.dtsNo?.toLowerCase().includes(search) ||
      docType?.includes(search) ||
      route?.includes(search) ||
      time?.includes(search) ||
      direction?.includes(search);
    const matchesMonth =
      selectedMonth === 'All' ||
      docDate.toLocaleString('en-US', { month: 'long' }) === selectedMonth;
    const matchesYear = selectedYear === 'All' || docDate.getFullYear() === selectedYear;

    const matchesColumnFilters = 
      (columnFilters.dateSent === '' || (doc.dateSent ? moment(doc.dateSent).format('MMMM D, YYYY [at] h:mm A').toLowerCase().includes(columnFilters.dateSent.toLowerCase()) : false)) &&
      (columnFilters.dtsNo === '' || (doc.dtsNo || '').toLowerCase().includes(columnFilters.dtsNo.toLowerCase())) &&
      (columnFilters.direction === '' || (doc.documentDirection || '').toLowerCase().includes(columnFilters.direction.toLowerCase())) &&
      (columnFilters.docType === '' || (docType || '').includes(columnFilters.docType.toLowerCase())) &&
      (columnFilters.timeReceived === '' || (time || '').includes(columnFilters.timeReceived.toLowerCase())) &&
      (columnFilters.dateReleased === '' || (doc.dateReceive ? moment(doc.dateReceive).format('MMMM D, YYYY [at] h:mm A').toLowerCase().includes(columnFilters.dateReleased.toLowerCase()) : false) || (doc.dateReceive === '-' && columnFilters.dateReleased === '-')) &&
      (columnFilters.route === '' || (route || '').includes(columnFilters.route.toLowerCase())) &&
      (columnFilters.remarks === '' || (doc.remarks || '').toLowerCase().includes(columnFilters.remarks.toLowerCase()));

    return matchesSearch && matchesMonth && matchesYear && matchesColumnFilters;
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

  function formatArchiveDate(dateObj = new Date()) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const month = months[dateObj.getMonth()];
    const day = dateObj.getDate();
    const year = dateObj.getFullYear();
    let hours = dateObj.getHours();
    const minutes = dateObj.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${month} ${day}, ${year} at ${hours}:${minutes} ${ampm}`;
  }

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
      'Date Sent', 'Date Released', 'Time Received', 'DTS No.', 'Document Status',
      'Document Type', 'Routed To', 'Remarks'
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
        doc.dateReceive || '-',
        doc.time?.replace('_', ' ').toUpperCase() || '-',
        doc.dtsNo,
        doc.documentDirection.charAt(0).toUpperCase() + doc.documentDirection.slice(1),
        doc.documentType?.trim() || '-',
        doc.route?.replace('_', ' ') || '-',
        doc.remarks || '-'
      ];
      const row = worksheet.addRow(rowValues);

      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 11, color: { argb: '000000' } };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber === 8 ? 'left' : 'center',
          wrapText: true
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'D3D3D3' } },
          left: { style: 'thin', color: { argb: 'D3D3D3' } },
          bottom: { style: 'thin', color: { argb: 'D3D3D3' } },
          right: { style: 'thin', color: { argb: 'D3D3D3' } }
        };
        
        if (colNumber === 4) {
          cell.font = {
            name: 'Arial',
            bold: true,
            size: 11,
            color: { argb: '000000' }
          };
        }

        if (colNumber === 3) {
          cell.font = {
            name: 'Arial',
            size: 11,
            color: { argb: '000000' }
          };
        }

        if (colNumber === 5) {
          cell.font = {
            name: 'Arial',
            bold: true,
            size: 11,
            color: { argb: 'FFFFFFFF' }
          };
          if (cell.value === 'Incoming') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4B698B' } };
          } else if (cell.value === 'Outgoing') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '123052' } };
          }
        }

        if (colNumber === 7) {
          const route = cell.value.toString();
          if (route === 'For Compliance') {
            cell.font = { name: 'Arial', size: 11, color: { argb: 'DC3545' } };
          } else {
            cell.font = { name: 'Arial', size: 11, color: { argb: '000000' } };
          }
        }
      });

      row.height = 25;
    });

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
      const spacingRow = worksheet.addRow(['', '', '', '', '', '', '', '']);
      spacingRow.height = 15;
    }
    
    const noteRow = worksheet.addRow(['', '', '', '', '', '', '', '']);
    noteRow.height = 20;
    
    worksheet.mergeCells(`A${noteRow.number}:H${noteRow.number}`);
    
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
      { width: 33 }, { width: 33 }, { width: 25 }, { width: 28 }, { width: 30 },
      { width: 35 }, { width: 30 }, { width: 40 }
    ];

    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Document_E-Logbook_${selectedMonth !== 'All' ? selectedMonth : ''}_${selectedYear !== 'All' ? selectedYear : ''}.xlsx`;
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
        {items.map((item, index) => (
          <button
            key={index}
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
      {/* Header Panel with Title and Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 tracking-tight font-display">All Documents</h1>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">Monitor, log, and route physical documents in real-time</p>
        </div>

        {/* Controls Layout */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Search bar */}
          <div className="relative w-64 h-10 bg-white border border-slate-200/80 rounded-xl shadow-2xs flex items-center px-3.5 focus-within:border-[#0b4c95] focus-within:ring-4 focus-within:ring-sky-500/10 transition-all duration-200">
            <FiSearch className="text-slate-400 w-4 h-4 mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search documents..."
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

          {/* Dynamic Add Buttons */}
          <div className="flex gap-2">
            {(adminDirection === 'incoming' || !adminDirection || adminUserType === 'admin' || adminUserType === 'superadmin') && (
              <button
                onClick={() => setShowIncomingModal(true)}
                className="h-10 px-4 btn-dost-blue font-bold text-xs rounded-xl shadow-md shadow-sky-900/10 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex items-center gap-1.5"
              >
                <FiPlus className="w-4 h-4" />
                <span>Add Incoming</span>
              </button>
            )}
            {(adminDirection === 'outgoing' || !adminDirection) && (
              <button
                onClick={() => setShowOutgoingModal(true)}
                className="h-10 px-4 bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs rounded-xl shadow-md shadow-pink-900/10 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex items-center gap-1.5"
              >
                <FiPlus className="w-4 h-4" />
                <span>Add Outgoing</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Main Table Container */}
      <div className="table-container-premium shadow-2xs">
        <div className="overflow-x-auto">
          <table className="table-premium w-full text-left border-collapse">
            <thead>
              {(() => {
                const uniqueValues = {
                  dateSent: [...new Set(documents.map(d => formatDate(d.dateSent)))].filter(v => v !== '-').sort(),
                  dtsNo: [...new Set(documents.map(d => d.dtsNo))].filter(Boolean).sort(),
                  direction: [...new Set(documents.map(d => d.documentDirection))].filter(Boolean).sort(),
                  docType: [...new Set(documents.map(d => d.documentType))].filter(Boolean).sort(),
                  timeReceived: [...new Set(documents.map(d => d.time))].filter(v => v && v !== '-').sort(),
                  dateReleased: [...new Set(documents.map(d => formatDate(d.dateReceive)))].filter(v => v !== '-').sort(),
                  route: [...new Set(documents.map(d => d.route))].filter(v => v && v !== '-').sort(),
                  remarks: [...new Set(documents.map(d => d.remarks))].filter(v => v && v !== '-').sort()
                };

                const selectClass = "text-[10px] w-full p-1.5 border border-slate-200/80 rounded shadow-2xs font-normal text-slate-600 focus:outline-none focus:border-sky-500 bg-white cursor-pointer";

                return (
                  <tr>
                    <th className="w-[12%] text-center align-top pt-3">
                      <div className="flex flex-col gap-2">
                        <span>{adminDirection === 'incoming' ? 'Date Sent' : 'Date Received'}</span>
                        <select className={selectClass} value={columnFilters.dateSent} onChange={(e) => setColumnFilters({...columnFilters, dateSent: e.target.value})}>
                          <option value="">All</option>
                          {uniqueValues.dateSent.map((val, i) => <option key={i} value={val}>{val}</option>)}
                        </select>
                      </div>
                    </th>
                    <th className="w-[10%] text-center align-top pt-3">
                      <div className="flex flex-col gap-2">
                        <span>DTS No.</span>
                        <select className={selectClass} value={columnFilters.dtsNo} onChange={(e) => setColumnFilters({...columnFilters, dtsNo: e.target.value})}>
                          <option value="">All</option>
                          {uniqueValues.dtsNo.map((val, i) => <option key={i} value={val}>{val}</option>)}
                        </select>
                      </div>
                    </th>
                    <th className="w-[12%] text-center align-top pt-3">
                      <div className="flex flex-col gap-2">
                        <span>Direction</span>
                        <select className={selectClass} value={columnFilters.direction} onChange={(e) => setColumnFilters({...columnFilters, direction: e.target.value})}>
                          <option value="">All</option>
                          {uniqueValues.direction.map((val, i) => <option key={i} value={val}>{val}</option>)}
                        </select>
                      </div>
                    </th>
                    <th className="w-[16%] align-top pt-3">
                      <div className="flex flex-col gap-2">
                        <span>Document Type</span>
                        <select className={selectClass} value={columnFilters.docType} onChange={(e) => setColumnFilters({...columnFilters, docType: e.target.value})}>
                          <option value="">All</option>
                          {uniqueValues.docType.map((val, i) => <option key={i} value={val}>{val}</option>)}
                        </select>
                      </div>
                    </th>
                    <th className="w-[12%] text-center align-top pt-3">
                      <div className="flex flex-col gap-2">
                        <span>Time Received</span>
                        <select className={selectClass} value={columnFilters.timeReceived} onChange={(e) => setColumnFilters({...columnFilters, timeReceived: e.target.value})}>
                          <option value="">All</option>
                          {uniqueValues.timeReceived.map((val, i) => <option key={i} value={val}>{val}</option>)}
                        </select>
                      </div>
                    </th>
                    <th className="w-[12%] text-center align-top pt-3">
                      <div className="flex flex-col gap-2">
                        <span>Date Released</span>
                        <select className={selectClass} value={columnFilters.dateReleased} onChange={(e) => setColumnFilters({...columnFilters, dateReleased: e.target.value})}>
                          <option value="">All</option>
                          {uniqueValues.dateReleased.map((val, i) => <option key={i} value={val}>{val}</option>)}
                        </select>
                      </div>
                    </th>
                    <th className="w-[12%] align-top pt-3">
                      <div className="flex flex-col gap-2">
                        <span>Routed To</span>
                        <select className={selectClass} value={columnFilters.route} onChange={(e) => setColumnFilters({...columnFilters, route: e.target.value})}>
                          <option value="">All</option>
                          {uniqueValues.route.map((val, i) => <option key={i} value={val}>{val}</option>)}
                        </select>
                      </div>
                    </th>
                    <th className="w-[12%] align-top pt-3">
                      <div className="flex flex-col gap-2">
                        <span>Remarks</span>
                        <div className="h-[26px]"></div>
                      </div>
                    </th>
                    <th className="w-[10%] text-center align-top pt-3">
                      <div className="flex flex-col gap-2">
                        <span>Actions</span>
                        <div className="h-[26px]"></div>
                      </div>
                    </th>
                  </tr>
                );
              })()}
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="text-center py-10 text-slate-400 font-semibold">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-[#0b4c95]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Loading documents...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredDocuments.length > 0 ? (
                filteredDocuments.map((doc) => {
                  const direction = doc.documentDirection.toLowerCase();
                  let directionBadgeClass = "bg-slate-50 text-slate-600 border-slate-200";
                  if (direction === 'incoming') {
                    directionBadgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200/50";
                  } else if (direction === 'outgoing') {
                    directionBadgeClass = "bg-pink-50 text-pink-700 border-pink-200/50";
                  }

                  const isArchiveDisabled = 
                    (adminDirection === 'incoming' && direction !== 'incoming') ||
                    (adminDirection === 'outgoing' && direction !== 'outgoing');

                  const isTimeSelectDisabled =
                    archivingId === doc.id ||
                    updatingTimeId === doc.id ||
                    doc.archiveStatus ||
                    !(
                      (adminDirection === 'outgoing') ||
                      (adminUserType === 'superadmin')
                    );

                  return (
                    <tr key={doc.id}>
                      <td className="text-center font-medium text-slate-500 text-xs">
                        {formatDate(doc.dateSent)}
                      </td>
                      <td className="text-center font-extrabold text-slate-800 text-xs">
                        {doc.dtsNo}
                      </td>
                      <td className="text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${directionBadgeClass}`}>
                          {doc.documentDirection}
                        </span>
                      </td>
                      <td className="font-semibold text-slate-700 text-xs max-w-[150px] truncate" title={doc.documentType}>
                        {doc.documentType}
                      </td>
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <select
                            value={doc.time === '-' ? '' : doc.time}
                            onChange={e => handleTimeChange(doc.id, e.target.value)}
                            disabled={isTimeSelectDisabled}
                            className={`h-8 w-24 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 px-2 outline-none transition-all duration-200 focus:border-[#0b4c95] focus:ring-2 focus:ring-sky-500/10 ${
                              isTimeSelectDisabled ? 'bg-slate-50/50 text-slate-400 cursor-not-allowed border-slate-100' : 'cursor-pointer hover:border-slate-300'
                            }`}
                          >
                            <option value="">-</option>
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                            <option value="PM_Late">PM Late</option>
                          </select>
                          {updatingTimeId === doc.id && (
                            <svg className="animate-spin h-3.5 w-3.5 text-sky-700" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                            </svg>
                          )}
                        </div>
                      </td>
                      <td className="text-center font-medium text-slate-500 text-xs">
                        {doc.dateReceive !== '-' ? formatDate(doc.dateReceive) : '-'}
                      </td>
                      <td className="font-semibold text-slate-700 text-xs max-w-[120px] truncate">
                        {doc.route?.replace('_', ' ') || '-'}
                      </td>
                      <td className="text-slate-500 font-medium text-xs max-w-[120px] truncate" title={doc.remarks}>
                        {doc.remarks || '-'}
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleView(doc)}
                            className="p-1.5 rounded-lg border border-slate-100 text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                            title="View Details"
                          >
                            <FiEye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleEdit(doc)}
                            className="p-1.5 rounded-lg border border-slate-100 text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                            title="Edit Record"
                          >
                            <FiEdit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleArchive(doc.id)}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              isArchiveDisabled
                                ? 'opacity-40 cursor-not-allowed text-slate-400 border-slate-100'
                                : 'text-amber-600 hover:bg-amber-50 border-amber-100'
                            }`}
                            title={isArchiveDisabled ? "Action restricted" : "Archive Document"}
                            disabled={isArchiveDisabled || archivingId === doc.id}
                          >
                            {archivingId === doc.id ? (
                              <svg className="animate-spin h-3.5 w-3.5 text-amber-600" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                              </svg>
                            ) : (
                              <FiArchive className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" className="text-center py-16 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FiSearch className="w-8 h-8 opacity-30" />
                      <p className="text-sm font-semibold">No matching records found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal overlays */}
      {showIncomingModal && (
        <OverlayIncoming 
          isOpen={showIncomingModal}
          onClose={() => {
            setShowIncomingModal(false);
            setSelectedDocument(null);
            setIsViewMode(false);
            setIsEditMode(false);
          }}
          editingDoc={selectedDocument}
          viewMode={isViewMode}
          editMode={isEditMode}
          onSuccess={fetchDocuments} 
        />
      )}

      {showOutgoingModal && (
        <OverlayOutgoing 
          isOpen={showOutgoingModal}
          onClose={() => {
            setShowOutgoingModal(false);
            setSelectedDocument(null);
            setIsViewMode(false);
            setIsEditMode(false);
          }}
          editingDoc={selectedDocument}
          viewMode={isViewMode}
          editMode={isEditMode}
          onSuccess={fetchDocuments} 
        />
      )}
    </div>
  );
}

export default AllDocs;