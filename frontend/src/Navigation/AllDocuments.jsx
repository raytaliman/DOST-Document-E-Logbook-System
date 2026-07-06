import React, { useState, useEffect, useCallback, useRef } from 'react';
import OverlayIncoming from '../OverlayModal/OverlayIncoming';
import OverlayOutgoing from '../OverlayModal/OverlayOutgoing';
import NetworkDays from './ProcessingDays';
import ArchiveDocuments from './ArchiveDocuments';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import Swal from 'sweetalert2';
import { io } from 'socket.io-client';
import moment from 'moment';
import {
  FiSearch,
  FiChevronDown,
  FiPlus,
  FiDownload,
  FiEye,
  FiLayers,
  FiSettings,
  FiArchive,
  FiTrash2,
  FiChevronLeft,
  FiChevronRight,
  FiArrowUp,
  FiArrowDown,
} from 'react-icons/fi';
import '../index.css';

function MultiSelectDropdown({ label, options, selected, onChange, widthClass = 'w-48' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (option) => {
    if (selected.includes(option)) {
      onChange(selected.filter(item => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const handleSelectAll = () => {
    if (selected.length === options.length) {
      onChange([]);
    } else {
      onChange(options);
    }
  };

  const filteredOptions = options.filter(opt => 
    String(opt).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayText = selected.length === 0 
    ? 'All' 
    : selected.length === options.length 
      ? 'All Selected' 
      : `${selected.length} Selected`;

  return (
    <div className={`flex flex-col gap-1 ${widthClass}`} ref={dropdownRef}>
      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full h-8 px-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg text-[10px] font-bold text-slate-700 flex items-center justify-between outline-none transition-all duration-200 cursor-pointer"
        >
          <span className="truncate pr-1">{displayText}</span>
          <FiChevronDown className={`w-3.5 h-3.5 text-slate-500 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute left-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-2 flex flex-col gap-1.5 max-h-[300px]">
            {options.length > 5 && (
              <input
                type="text"
                placeholder="Search..."
                className="w-full h-7 px-2 border border-slate-100 rounded-md text-[10px] outline-none focus:border-sky-500 font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            )}
            
            <div className="overflow-y-auto max-h-[200px] flex flex-col gap-1 scrollbar-thin">
              <label className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-slate-50 cursor-pointer select-none text-[10px] font-extrabold text-slate-600 border-b border-slate-50 pb-1.5 mb-0.5">
                <input
                  type="checkbox"
                  checked={selected.length === options.length}
                  onChange={handleSelectAll}
                  className="rounded border-slate-300 text-sky-600 focus:ring-sky-500/10 cursor-pointer w-3.5 h-3.5"
                />
                <span>Select All</span>
              </label>

              {filteredOptions.map((opt, idx) => (
                <label key={idx} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-slate-50 cursor-pointer select-none text-[10px] text-slate-600 font-semibold">
                  <input
                    type="checkbox"
                    checked={selected.includes(opt)}
                    onChange={() => handleToggle(opt)}
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500/10 cursor-pointer w-3.5 h-3.5"
                  />
                  <span className="truncate">{opt}</span>
                </label>
              ))}
              {filteredOptions.length === 0 && (
                <span className="text-[10px] text-slate-400 font-semibold text-center py-2">No options found</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const formatRemarks = (remarksStr) => {
  if (!remarksStr || remarksStr === '-') return '-';
  if (remarksStr.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(remarksStr);
      if (Array.isArray(parsed)) {
        return parsed.map(item => `${item.remarks} (${item.days} ${item.days === 1 ? 'day' : 'days'})`).join(', ');
      }
    } catch (e) {
      // Fallback
    }
  }
  return remarksStr;
};

const formatDate = (dateString) => {
  if (!dateString || dateString === '-') return '-';
  if (moment.isMoment(dateString))
    return dateString.format('MMMM D, YYYY [at] h:mm A');
  try {
    // Detect if string is already formatted to prevent moment warnings
    if (
      typeof dateString === 'string' &&
      (dateString.includes(' at ') ||
        dateString.match(/^[A-Z][a-z]+ \d{1,2}, \d{4}/))
    ) {
      return dateString;
    }
    // Convert UTC timestamp → local (Asia/Manila) time before formatting
    const m = moment.utc(dateString).local();
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
    // Convert UTC timestamp → local (Asia/Manila) time before formatting
    const m = moment.utc(dateString).local();
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
    // Convert UTC timestamp → local (Asia/Manila) time before formatting
    const m = moment.utc(dateString).local();
    return m.isValid() ? m.format('h:mm A') : '-';
  } catch (e) {
    return '-';
  }
};

const parseToDate = (dateStr) => {
  if (!dateStr || dateStr === '-') return new Date(0);
  try {
    if (typeof dateStr === 'string' && dateStr.includes(' at ')) {
      const cleaned = dateStr.replace(' at ', ' ');
      const parsed = new Date(cleaned);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return parsed;
    const m = moment(dateStr, ['MMMM D, YYYY [at] h:mm A', 'YYYY-MM-DD HH:mm:ss', moment.ISO_8601]);
    if (m.isValid()) return m.toDate();
  } catch (e) {
    // Ignore
  }
  return new Date(0);
};

function AllDocs() {
  const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3600';
  const API_URL = rawApiUrl.endsWith('/api') ? rawApiUrl.slice(0, -4) : rawApiUrl;
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toLocaleString('en-US', { month: 'long' })
  );
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showIncomingModal, setShowIncomingModal] = useState(false);
  const [showOutgoingModal, setShowOutgoingModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [columnFilters, setColumnFilters] = useState({
    dateSent: [],
    dtsNo: '',
    direction: [],
    docType: [],
    timeReceived: [],
    dateReleased: [],
    daysProcessed: '',
    route: [],
    remarks: '',
    processedBy: [],
    payee: [],
    seriesNo: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: 'dateSent', direction: 'desc' });
  const [activeTab, setActiveTab] = useState('All');

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const [routes, setRoutes] = useState([]);
  const [updatingRouteId, setUpdatingRouteId] = useState(null);

  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const response = await fetch(`${API_URL}/api/routes`);
        const data = await response.json();
        setRoutes(data);
      } catch (err) {
        console.error('Error fetching routes:', err);
      }
    };
    fetchRoutes();
  }, [API_URL]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedMonth, selectedYear, columnFilters, activeTab, sortConfig]);

  const months = [
    'All',
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const currentYear = new Date().getFullYear();
  const years = ['All', ...Array.from({ length: 6 }, (_, i) => currentYear - i)];
  const adminData = localStorage.getItem('admin');
  const admin = adminData ? JSON.parse(adminData) : null;
  const adminDirection = (
    admin?.documentdirection || // Check for documentdirection
    admin?.documentDirection || // Check for documentDirection (camelCase)
    admin?.document_direction || // Check for document_direction (snake_case)
    ''
  ) // Default to empty string if none found
    ?.toLowerCase();
  const adminUserType = (
    admin?.usertype || // Check for usertype
    admin?.userType || // Check for userType (camelCase)
    admin?.user_type || // Check for user_type (snake_case)
    ''
  ).toLowerCase();

  // Robust reactive authorization check
  const isUserAuthorized = React.useMemo(() => {
    return !!(
      ['admin', 'superadmin'].includes(adminUserType) ||
      adminUserType.includes('admin') ||
      adminDirection === 'all'
    );
  }, [adminUserType, adminDirection]);


  const [updatingTimeId, setUpdatingTimeId] = useState(null);
  const [updatingDateReleasedId, setUpdatingDateReleasedId] = useState(null);
  const [archivingId, setArchivingId] = useState(null);

  const handleDateReleasedChange = async (docId, rawValue) => {
    if (!rawValue) return;
    setUpdatingDateReleasedId(docId);
    try {
      const dateObj = new Date(rawValue);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthName = months[dateObj.getMonth()];
      let hours = dateObj.getHours();
      const minutes = dateObj.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const displayHours = hours.toString().padStart(2, '0');
      const displayMinutes = minutes.toString().padStart(2, '0');
      
      const formattedDateReleased = `${monthName} ${dateObj.getDate()}, ${dateObj.getFullYear()} at ${displayHours}:${displayMinutes} ${ampm}`;
      
      const response = await fetch(`${API_URL}/api/documents/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          datereleased: formattedDateReleased,
          processedbyid: admin?.adminid || null
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update Date Released');
      }

      setDocuments((prevDocs) =>
        prevDocs.map((doc) =>
          doc.id === docId ? { ...doc, dateReceive: formattedDateReleased } : doc,
        ),
      );

      Swal.fire({
        icon: 'success',
        title: 'Date Released Updated',
        text: 'The document has been marked as released.',
        timer: 1200,
        showConfirmButton: false,
        customClass: { popup: 'swal2-minimalist' },
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Failed to Update',
        text: error.message || 'Failed to update Date Released.',
        timer: 2000,
        showConfirmButton: false,
        customClass: { popup: 'swal2-minimalist' },
      });
    } finally {
      setUpdatingDateReleasedId(null);
    }
  };

  // Fetch documents
  const fetchDocuments = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const response = await fetch(`${API_URL}/api/documents`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const transformedDocuments = data.map((doc) => ({
        id: doc.documentid,
        dtsNo: doc.dtsno,
        dateSent: doc.datesent,
        documentDirection: doc.documentdirection,
        documentType: doc.documenttype,
        dateReceive: doc.datereleased || '-',
        time: doc.time || '-',
        route: doc.route || '-',
        remarks: doc.remarks || '-',
        archiveStatus: doc.isarchive,
        daysProcessed: doc.daysprocessed !== null && doc.daysprocessed !== undefined ? Number(doc.daysprocessed) : null,
        processedBy: doc.processedby || '-',
        payee: doc.payee || '-',
        amount: doc.amount !== null && doc.amount !== undefined ? Number(doc.amount) : null,
        seriesNo: doc.seriesno || '-',
        particulars: doc.particulars || '-',
        queueNo: doc.queueno || '-',
        include_friday: doc.include_friday,
        calcnetworkdays: doc.calcnetworkdays !== null && doc.calcnetworkdays !== undefined ? Number(doc.calcnetworkdays) : null,
        networkdaysremarks: doc.networkdaysremarks || '-',
        deducteddays: doc.deducteddays !== null ? Number(doc.deducteddays) : 0,
      }));
      const filtered = transformedDocuments
        .filter((doc) => !doc.archiveStatus)
        .sort((a, b) => parseToDate(b.dateSent) - parseToDate(a.dateSent));
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
          popup: 'swal2-minimalist',
        },
      });
    }
  }, [API_URL]);

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

  // Handle View action — opens modal in edit mode (combined view+edit)
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
      datesent: doc.dateSent,
      time: doc.time,
      payee: doc.payee === '-' ? '' : doc.payee,
      amount: doc.amount,
      seriesno: doc.seriesNo === '-' ? '' : doc.seriesNo,
      particulars: doc.particulars === '-' ? '' : doc.particulars,
      queueNo: doc.queueNo === '-' ? '' : doc.queueNo,
      include_friday: doc.include_friday,
    });

    setIsViewMode(false);
    setIsEditMode(true);

    if (
      doc.documentDirection === 'incoming' ||
      (adminDirection === 'incoming' &&
        (doc.dateReceive === '-' || !doc.dateReceive))
    ) {
      setShowIncomingModal(true);
      setShowOutgoingModal(false);
    } else {
      setShowOutgoingModal(true);
      setShowIncomingModal(false);
    }
  };

  const handleArchive = async (docId) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;

    let archiveBy;
    const adminData = localStorage.getItem('admin');
    if (adminData) {
      const admin = JSON.parse(adminData);
      const userType = (admin.usertype || '').toLowerCase();

      if (userType.includes('itsm')) {
        archiveBy = 'ITSM';
      } else if (userType.includes('admin')) {
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
        popup: 'swal2-minimalist',
      },
    });
    if (!result.isConfirmed) return;

    setArchivingId(docId);
    try {
      const archiveDateStr = formatArchiveDate();
      const response = await fetch(
        `${API_URL}/api/documents/${docId}/archive`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            isarchive: true,
            archivedate: archiveDateStr,
            archivedby: archiveBy,
          }),
        },
      );

      if (response.ok) {
        setDocuments((prev) => prev.filter((doc) => doc.id !== docId));
        Swal.fire({
          icon: 'success',
          title: 'Archived!',
          text: 'Document has been archived.',
          timer: 1800,
          showConfirmButton: false,
          customClass: {
            popup: 'swal2-minimalist',
          },
        });
      } else {
        const error = await response.json();
        Swal.fire({
          icon: 'error',
          title: 'Failed to Archive',
          text:
            error.message || 'Failed to archive document. Please try again.',
          timer: 2500,
          showConfirmButton: false,
          customClass: {
            popup: 'swal2-minimalist',
          },
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
          popup: 'swal2-minimalist',
        },
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
        body: JSON.stringify({ time: newTime }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update time');
      }

      setDocuments((prevDocs) =>
        prevDocs.map((doc) =>
          doc.id === docId ? { ...doc, time: newTime || '-' } : doc,
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

  const handleRouteUpdate = async (docId, newRoute) => {
    setUpdatingRouteId(docId);
    try {
      const response = await fetch(`${API_URL}/api/documents/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route: newRoute }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update route');
      }

      setDocuments((prevDocs) =>
        prevDocs.map((doc) =>
          doc.id === docId ? { ...doc, route: newRoute || '-' } : doc,
        ),
      );

      Swal.fire({
        icon: 'success',
        title: 'Route Updated',
        text: 'Routed To has been updated.',
        timer: 1200,
        showConfirmButton: false,
        customClass: { popup: 'swal2-minimalist' },
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Failed to Update',
        text: error.message || 'Failed to update route.',
        timer: 2000,
        showConfirmButton: false,
        customClass: { popup: 'swal2-minimalist' },
      });
    } finally {
      setUpdatingRouteId(null);
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    const docDate = new Date(doc.dateSent);
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
      (doc.amount !== null && doc.amount !== undefined ? String(doc.amount) : '').includes(search) ||
      (formatRemarks(doc.networkdaysremarks)?.toLowerCase() || '').includes(search);

    const matchesMonth =
      selectedMonth === 'All' ||
      (!isNaN(docDate.getTime()) && months[docDate.getMonth() + 1] === selectedMonth);
    const matchesYear =
      selectedYear === 'All' || docDate.getFullYear() === selectedYear;

    const matchesColumnFilters =
      (columnFilters.dateSent.length === 0 ||
        (doc.dateSent && columnFilters.dateSent.includes(formatDateOnly(doc.dateSent)))) &&
      (columnFilters.dtsNo === '' ||
        (doc.dtsNo || '')
          .toLowerCase()
          .includes(columnFilters.dtsNo.toLowerCase())) &&
      (columnFilters.seriesNo === '' ||
        (doc.seriesNo || '')
          .toLowerCase()
          .includes(columnFilters.seriesNo.toLowerCase())) &&
      (columnFilters.direction.length === 0 ||
        columnFilters.direction.includes(doc.documentDirection)) &&
      (columnFilters.docType.length === 0 ||
        columnFilters.docType.includes(doc.documentType)) &&
      (columnFilters.timeReceived.length === 0 ||
        columnFilters.timeReceived.includes(doc.time)) &&
      (columnFilters.dateReleased.length === 0 ||
        (doc.dateReceive && columnFilters.dateReleased.includes(formatDateOnly(doc.dateReceive))) ||
        (doc.dateReceive === '-' && columnFilters.dateReleased.includes('-'))) &&
      (columnFilters.daysProcessed === '' ||
        (doc.daysProcessed !== null && doc.daysProcessed !== undefined
          ? String(doc.daysProcessed) === columnFilters.daysProcessed
          : (doc.calcnetworkdays !== null && doc.calcnetworkdays !== undefined
             ? String(doc.calcnetworkdays) === columnFilters.daysProcessed
             : false)) ||
        (doc.daysProcessed === null && doc.calcnetworkdays === null && columnFilters.daysProcessed === '-')) &&
      (columnFilters.route.length === 0 ||
        columnFilters.route.includes(doc.route)) &&
      (columnFilters.remarks === '' ||
        (doc.remarks || '')
          .toLowerCase()
          .includes(columnFilters.remarks.toLowerCase()) ||
        (formatRemarks(doc.networkdaysremarks) || '')
          .toLowerCase()
          .includes(columnFilters.remarks.toLowerCase())) &&
      (columnFilters.processedBy.length === 0 ||
        columnFilters.processedBy.includes(doc.processedBy)) &&
      (columnFilters.payee.length === 0 ||
        columnFilters.payee.includes(doc.payee));

    const matchesTab =
      activeTab === 'All' ||
      doc.documentDirection?.toLowerCase() === activeTab.toLowerCase();

    return matchesSearch && matchesMonth && matchesYear && matchesColumnFilters && matchesTab;
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

  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = filteredDocuments.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(filteredDocuments.length / rowsPerPage);



  function formatArchiveDate(dateObj = new Date()) {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
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
    const exportDocuments = documents.filter((doc) => {
      const docDate = new Date(doc.dateSent);
      const matchesMonth =
        selectedMonth === 'All' ||
        (!isNaN(docDate.getTime()) && months[docDate.getMonth() + 1] === selectedMonth);
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
        const rowValues = [
          formatDate(doc.dateSent),
          doc.dateReceive || '-',
          doc.daysProcessed !== null && doc.daysProcessed !== undefined
            ? Number(doc.daysProcessed)
            : (doc.calcnetworkdays !== null && doc.calcnetworkdays !== undefined
               ? Number(doc.calcnetworkdays)
               : '-'),
          doc.time?.replace('_', ' ').toUpperCase() || '-',
          doc.dtsNo,
          doc.seriesNo || '-',
          doc.queueNo || '-',
          doc.documentDirection.charAt(0).toUpperCase() +
            doc.documentDirection.slice(1),
          doc.documentType?.trim() || '-',
          doc.payee || '-',
          doc.amount !== null && doc.amount !== undefined ? Number(doc.amount) : '-',
          doc.particulars || '-',
          doc.route?.replace(/_/g, ' ') || '-',
          doc.remarks && doc.remarks !== '-' ? doc.remarks : (doc.networkdaysremarks && doc.networkdaysremarks !== '-' ? formatRemarks(doc.networkdaysremarks) : '-'),
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
            if (cell.value === 'Incoming') {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: '4B698B' },
              };
            } else if (cell.value === 'Outgoing') {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: '123052' },
              };
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
        <FiChevronDown
          className={`w-3.5 h-3.5 ml-2 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-slate-600' : ''}`}
        />
      </button>
    </div>
  );

  const DropdownMenu = ({ items, onSelect, isOpen, className }) =>
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
    );

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <span className="opacity-30 ml-1 text-[10px] select-none">⇅</span>;
    }
    return sortConfig.direction === 'asc' 
      ? <FiArrowUp className="inline w-3 h-3 ml-1 text-[#0b4c95]" />
      : <FiArrowDown className="inline w-3 h-3 ml-1 text-[#0b4c95]" />;
  };

  const uniqueValues = {
    dateSent: [...new Set(documents.map((d) => formatDateOnly(d.dateSent)))].filter((v) => v !== '-').sort((a, b) => new Date(a) - new Date(b)),
    direction: [...new Set(documents.map((d) => d.documentDirection))].filter(Boolean).sort(),
    payee: [...new Set(documents.map((d) => d.payee))].filter((v) => v && v !== '-').sort(),
    docType: [...new Set(documents.map((d) => d.documentType))].filter(Boolean).sort(),
    timeReceived: [...new Set(documents.map((d) => d.time))].filter((v) => v && v !== '-').sort(),
    dateReleased: [...new Set(documents.map((d) => formatDateOnly(d.dateReceive)))].filter((v) => v !== '-').sort(),
    route: [...new Set(documents.map((d) => d.route))].filter((v) => v && v !== '-').sort(),
    processedBy: [...new Set(documents.map((d) => d.processedBy))].filter((v) => v && v !== '-').sort(),
  };

  const selectFilterClass =
    'text-[11px] p-2 border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-semibold focus:outline-none focus:border-sky-500 cursor-pointer w-full';

  const validProcessingDays = filteredDocuments
    .map(doc => doc.daysProcessed)
    .filter(days => days !== null && !isNaN(days) && days > 0);
  const averageTurnaround = validProcessingDays.length > 0
    ? (validProcessingDays.reduce((sum, days) => sum + days, 0) / validProcessingDays.length).toFixed(2)
    : '0.00';

  return (
    <div className="p-2 space-y-6">
      {/* Header Panel with Title and Controls */}
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-extrabold text-slate-800 tracking-tight font-display">
            Document Records
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Monitor, log, and route physical documents in real-time
          </p>
        </div>

        <div className="flex gap-2">
          {(adminDirection === 'incoming' ||
            adminDirection === 'all' ||
            !adminDirection ||
            isUserAuthorized) && (
            <button
              onClick={() => setShowIncomingModal(true)}
              className="h-10 px-4 btn-dost-blue font-bold text-xs rounded-xl shadow-md shadow-sky-900/10 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex items-center gap-1.5"
            >
              <FiPlus className="w-4 h-4" />
              <span>Add Incoming</span>
            </button>
          )}
          {(adminDirection === 'outgoing' ||
            adminDirection === 'all' ||
            !adminDirection ||
            isUserAuthorized) && (
            <button
              onClick={() => setShowOutgoingModal(true)}
              className="h-10 px-4 btn-dost-blue font-bold text-xs rounded-xl shadow-md shadow-sky-900/10 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex items-center gap-1.5"
            >
              <FiPlus className="w-4 h-4" />
              <span>Add Outgoing</span>
            </button>
          )}
        </div>
      </div>
 
      <div className="flex border-b border-slate-200">
        {['All Records', 'Incoming', 'Processed Documents', 'Archived Documents'].map((tab) => {
          const tabValue = tab === 'All Records' ? 'All' : tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tabValue)}
              className={`px-6 py-2.5 text-xs font-bold transition-all duration-200 border-b-2 cursor-pointer flex items-center gap-1.5 ${
                activeTab === tabValue
                  ? 'border-[#0b4c95] text-[#0b4c95] bg-sky-500/5'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <span>{tab}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'Processed Documents' ? (
        <NetworkDays />
      ) : activeTab === 'Archived Documents' ? (
        <ArchiveDocuments />
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">
                  {activeTab === 'Incoming'
                    ? 'Incoming Records'
                    : activeTab === 'Outgoing'
                    ? 'Outgoing Records'
                    : 'All Records'}
                </h1>
                <p className="text-xs text-slate-400 mt-0.5 font-medium font-sans">
                  {activeTab === 'Incoming'
                    ? 'Track incoming business turnaround times, calculate network days, and manage exceptions'
                    : activeTab === 'Outgoing'
                    ? 'Track outgoing business turnaround times, calculate network days, and manage exceptions'
                    : 'Track all business turnaround times, calculate network days, and manage exceptions'}
                </p>
              </div>
              {activeTab === 'Incoming' && (
                <div className="bg-sky-50 border border-sky-100 rounded-xl px-4 py-2 flex flex-col justify-center items-center shadow-3xs">
                  <span className="text-[9px] font-bold text-sky-600 uppercase tracking-wider">Incoming</span>
                  <span className="text-sm font-extrabold text-sky-800 mt-0.5">
                    {filteredDocuments.length} Documents
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Search bar */}
              <div className="relative w-72 h-10 bg-white border border-slate-200/80 rounded-xl shadow-2xs flex items-center px-3.5 focus-within:border-[#0b4c95] focus-within:ring-4 focus-within:ring-sky-500/10 transition-all duration-200">
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
                    setSelectedYear(year === 'All' ? 'All' : Number(year));
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
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-wrap items-center gap-4 shadow-3xs mt-4">
            <div className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mr-1">Filters:</div>

            {/* Date Sent/Received */}
            <MultiSelectDropdown
              label={adminDirection === 'incoming' ? 'Date Sent' : 'Date Received'}
              options={uniqueValues.dateSent}
              selected={columnFilters.dateSent}
              onChange={(val) => setColumnFilters({ ...columnFilters, dateSent: val })}
              widthClass="w-36"
            />

            {/* Direction */}
            {activeTab === 'All' && (
              <MultiSelectDropdown
                label="Direction"
                options={uniqueValues.direction}
                selected={columnFilters.direction}
                onChange={(val) => setColumnFilters({ ...columnFilters, direction: val })}
                widthClass="w-28"
              />
            )}

            {/* Payee */}
            <MultiSelectDropdown
              label="Payee"
              options={uniqueValues.payee}
              selected={columnFilters.payee}
              onChange={(val) => setColumnFilters({ ...columnFilters, payee: val })}
              widthClass="w-36"
            />

            {/* Document Type */}
            <MultiSelectDropdown
              label="Document Type"
              options={uniqueValues.docType}
              selected={columnFilters.docType}
              onChange={(val) => setColumnFilters({ ...columnFilters, docType: val })}
              widthClass="w-40"
            />

            {/* Time Received */}
            <MultiSelectDropdown
              label="Time Received"
              options={uniqueValues.timeReceived}
              selected={columnFilters.timeReceived}
              onChange={(val) => setColumnFilters({ ...columnFilters, timeReceived: val })}
              widthClass="w-28"
            />

            {/* Date Released */}
            <MultiSelectDropdown
              label="Date Released"
              options={uniqueValues.dateReleased}
              selected={columnFilters.dateReleased}
              onChange={(val) => setColumnFilters({ ...columnFilters, dateReleased: val })}
              widthClass="w-36"
            />

            {/* Routed To */}
            <MultiSelectDropdown
              label="Routed To"
              options={uniqueValues.route}
              selected={columnFilters.route}
              onChange={(val) => setColumnFilters({ ...columnFilters, route: val })}
              widthClass="w-36"
            />

            {/* Processed By */}
            <MultiSelectDropdown
              label="Processed By"
              options={uniqueValues.processedBy}
              selected={columnFilters.processedBy}
              onChange={(val) => setColumnFilters({ ...columnFilters, processedBy: val })}
              widthClass="w-40"
            />

            {/* Reset Button */}
            {Object.keys(columnFilters).some((key) => 
              Array.isArray(columnFilters[key]) ? columnFilters[key].length > 0 : columnFilters[key] !== ''
            ) && (
              <button
                onClick={() =>
                  setColumnFilters({
                    dateSent: [],
                    dtsNo: '',
                    direction: [],
                    docType: [],
                    timeReceived: [],
                    dateReleased: [],
                    daysProcessed: '',
                    route: [],
                    processedBy: [],
                    payee: [],
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

          {/* Main Table Container */}
          <div className="table-container-premium shadow-2xs">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-thin">
              <table className="table-premium w-full text-left border-collapse relative">
                <thead>
                  <tr>
                    <th
                      className="w-[11%] text-center py-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                      onClick={() => requestSort('dateSent')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>{adminDirection === 'incoming' ? 'Date Received' : 'Date Sent'}</span>
                        {renderSortIcon('dateSent')}
                      </div>
                    </th>
                    <th className="w-[10%] text-center py-3 select-none">
                      <span>DTS No.</span>
                    </th>
                    <th className="w-[10%] text-center py-3 select-none">
                      <span>Series No.</span>
                    </th>
                    <th className="w-[10%] text-center py-3 select-none">
                      <span>Queue No.</span>
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
                      className="w-[11%] py-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                      onClick={() => requestSort('payee')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Payee</span>
                        {renderSortIcon('payee')}
                      </div>
                    </th>
                    <th
                      className="w-[14%] py-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                      onClick={() => requestSort('documentType')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Document Type</span>
                        {renderSortIcon('documentType')}
                      </div>
                    </th>
                    <th
                      className="w-[10%] text-center py-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                      onClick={() => requestSort('time')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Time Received</span>
                        {renderSortIcon('time')}
                      </div>
                    </th>
                    <th
                      className="w-[11%] text-center py-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                      onClick={() => requestSort('dateReceive')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Date Released</span>
                        {renderSortIcon('dateReceive')}
                      </div>
                    </th>
                    <th
                      className="w-[11%] text-center py-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                      onClick={() => requestSort('daysProcessed')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Days Processed</span>
                        {renderSortIcon('daysProcessed')}
                      </div>
                    </th>
                    <th
                      className="w-[11%] py-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
                      onClick={() => requestSort('route')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Routed To</span>
                        {renderSortIcon('route')}
                      </div>
                    </th>
                    <th
                      className="w-[11%] py-3 cursor-pointer select-none hover:bg-slate-50 transition-colors"
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
                    <td
                      colSpan="13"
                      className="text-center py-10 text-slate-400 font-semibold"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <svg
                          className="animate-spin h-5 w-5 text-[#0b4c95]"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        <span>Loading documents...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredDocuments.length > 0 ? (
                  currentRows.map((doc) => {
                    const direction = doc.documentDirection.toLowerCase();
                    let directionBadgeClass =
                      'bg-slate-50 text-slate-600 border-slate-200';
                    if (direction === 'incoming') {
                      directionBadgeClass =
                        'bg-emerald-50 text-emerald-700 border-emerald-200/50';
                    } else if (direction === 'outgoing') {
                      directionBadgeClass =
                        'bg-blue-50 text-blue-700 border-blue-200/50';
                    }

                    const isArchiveDisabled =
                      (adminDirection === 'incoming' &&
                        direction !== 'incoming') ||
                      (adminDirection === 'outgoing' &&
                        direction !== 'outgoing');

                    const isTimeSelectDisabled =
                      archivingId === doc.id ||
                      updatingTimeId === doc.id ||
                      doc.archiveStatus ||
                      !(
                        adminDirection === 'all' ||
                        (adminDirection === 'incoming' &&
                          (doc.documentDirection?.toLowerCase() === 'incoming' ||
                            doc.dateReceive === '-' ||
                            !doc.dateReceive)) ||
                        (doc.documentDirection?.toLowerCase() === 'outgoing' &&
                          adminDirection === 'outgoing') ||
                        adminUserType === 'superadmin'
                      );

                    const isDateReleasedEditable =
                      !doc.archiveStatus &&
                      (doc.dateReceive === '-' || !doc.dateReceive) &&
                      (adminDirection === 'all' ||
                        adminDirection === 'outgoing' ||
                        adminUserType === 'superadmin');

                    return (
                      <tr key={doc.id}>
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
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${directionBadgeClass}`}
                          >
                            {doc.documentDirection}
                          </span>
                        </td>
                        <td className="text-left text-xs">
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
                        </td>
                        <td
                          className="font-semibold text-slate-700 text-xs max-w-[150px] truncate"
                          title={doc.documentType}
                        >
                          {doc.documentType}
                        </td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <select
                              value={doc.time === '-' ? '' : doc.time}
                              onChange={(e) =>
                                handleTimeChange(doc.id, e.target.value)
                              }
                              disabled={isTimeSelectDisabled}
                              className={`h-8 w-24 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 px-2 outline-none transition-all duration-200 focus:border-[#0b4c95] focus:ring-2 focus:ring-sky-500/10 ${
                                isTimeSelectDisabled
                                  ? 'bg-slate-50/50 text-slate-400 cursor-not-allowed border-slate-100'
                                  : 'cursor-pointer hover:border-slate-300'
                              }`}
                            >
                              <option value="">-</option>
                              <option value="AM">AM</option>
                              <option value="PM">PM</option>
                              <option value="PM_Late">PM Late</option>
                            </select>
                            {updatingTimeId === doc.id && (
                              <svg
                                className="animate-spin h-3.5 w-3.5 text-sky-700"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8v8z"
                                ></path>
                              </svg>
                            )}
                          </div>
                        </td>
                        <td className="text-left text-xs">
                          {doc.dateReceive !== '-' && doc.dateReceive ? (
                            <div className="flex flex-col items-start">
                              <span className="font-bold text-slate-800">{formatDateOnly(doc.dateReceive)}</span>
                              <span className="text-[10px] text-slate-400 font-semibold mt-0.5">{formatTimeOnly(doc.dateReceive)}</span>
                            </div>
                          ) : isDateReleasedEditable ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="datetime-local"
                                onChange={(e) => handleDateReleasedChange(doc.id, e.target.value)}
                                disabled={updatingDateReleasedId === doc.id}
                                className="h-8 w-[140px] bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 px-1.5 outline-none transition-all duration-200 focus:border-[#0b4c95] focus:ring-2 focus:ring-sky-500/10 cursor-pointer hover:border-slate-300"
                              />
                              {updatingDateReleasedId === doc.id && (
                                <svg
                                  className="animate-spin h-3.5 w-3.5 text-sky-700"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  ></circle>
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8v8z"
                                  ></path>
                                </svg>
                              )}
                            </div>
                          ) : '-'}
                        </td>
                        <td className="text-center font-semibold text-slate-600 text-xs">
                          {doc.daysProcessed !== null && doc.daysProcessed !== undefined
                            ? Number(doc.daysProcessed).toFixed(1)
                            : (doc.calcnetworkdays !== null && doc.calcnetworkdays !== undefined
                               ? Number(doc.calcnetworkdays).toFixed(1)
                               : '-')}
                        </td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <select
                              value={doc.route === '-' ? '' : doc.route}
                              onChange={(e) =>
                                handleRouteUpdate(doc.id, e.target.value)
                              }
                              disabled={isTimeSelectDisabled || updatingRouteId === doc.id}
                              className={`h-8 w-32 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 px-2 outline-none transition-all duration-200 focus:border-[#0b4c95] focus:ring-2 focus:ring-sky-500/10 ${
                                isTimeSelectDisabled || updatingRouteId === doc.id
                                  ? 'bg-slate-50/50 text-slate-400 cursor-not-allowed border-slate-100'
                                  : 'cursor-pointer hover:border-slate-300'
                              }`}
                            >
                              <option value="">-</option>
                              {routes.map((r) => (
                                <option key={r.routeid} value={r.routename}>
                                  {r.routename}
                                </option>
                              ))}
                            </select>
                            {updatingRouteId === doc.id && (
                              <svg
                                className="animate-spin h-3.5 w-3.5 text-sky-700"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8v8z"
                                ></path>
                              </svg>
                            )}
                          </div>
                        </td>
                        <td className="font-semibold text-slate-700 text-xs max-w-[120px] truncate">
                          {doc.processedBy || '-'}
                        </td>
                        <td>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleView(doc)}
                              className="p-1.5 rounded-lg border border-slate-100 text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                              title="View / Edit Details"
                            >
                              <FiEye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleArchive(doc.id)}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                isArchiveDisabled
                                  ? 'opacity-40 cursor-not-allowed text-slate-400 border-slate-100'
                                  : 'text-amber-600 hover:bg-amber-50 border-amber-100'
                              }`}
                              title={
                                isArchiveDisabled
                                  ? 'Action restricted'
                                  : 'Archive Document'
                              }
                              disabled={
                                isArchiveDisabled || archivingId === doc.id
                              }
                            >
                              {archivingId === doc.id ? (
                                <svg
                                  className="animate-spin h-3.5 w-3.5 text-amber-600"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  ></circle>
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8v8z"
                                  ></path>
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
                    <td
                      colSpan="13"
                      className="text-center py-16 text-slate-400"
                    >
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FiSearch className="w-8 h-8 opacity-30" />
                        <p className="text-sm font-semibold">
                          No matching records found
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Premium Pagination Controls */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-5 px-6 py-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="text-xs font-semibold text-slate-500">
            Showing <span className="text-slate-800">{filteredDocuments.length === 0 ? 0 : indexOfFirstRow + 1}</span> to{' '}
            <span className="text-slate-800">
              {Math.min(indexOfLastRow, filteredDocuments.length)}
            </span>{' '}
            of <span className="text-slate-800">{filteredDocuments.length}</span> entries
          </div>

          <div className="flex items-center gap-6">
            {/* Rows Per Page Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Show</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
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
        </>
      )}

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
          onSuccess={() => {
            setShowIncomingModal(false);
            setSelectedDocument(null);
            setIsViewMode(false);
            setIsEditMode(false);
            fetchDocuments();
          }}
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
          onSuccess={() => {
            setShowOutgoingModal(false);
            setSelectedDocument(null);
            setIsViewMode(false);
            setIsEditMode(false);
            fetchDocuments();
          }}
        />
      )}
    </div>
  );
}

export default AllDocs;
