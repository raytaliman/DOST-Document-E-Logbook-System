import { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import '../index.css';

function OverlayOutgoing({
  isOpen,
  onClose,
  editingDoc,
  viewMode,
  editMode,
  onSuccess,
}) {
  const popupRef = useRef(null);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [payees, setPayees] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [showCustomDocType, setShowCustomDocType] = useState(false);
  const [customDocType, setCustomDocType] = useState('');
  const [selectedDocType, setSelectedDocType] = useState('');
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    route: '',
    dtsNo: '',
    remarks: '',
    date: new Date().toISOString().split('T')[0],
    datereleasedinput: '',
    payee: '',
    amount: '',
    seriesNo: '',
    particulars: '',
    queueNo: '',
    includeFriday: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialDate, setInitialDate] = useState(null);
  const [auditTrail, setAuditTrail] = useState([]);
  const [showAudit, setShowAudit] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  
  const [payeeSearch, setPayeeSearch] = useState('');
  const [isPayeeDropdownOpen, setIsPayeeDropdownOpen] = useState(false);
  const [customPayee, setCustomPayee] = useState('');
  const [showCustomPayee, setShowCustomPayee] = useState(false);
  const payeeDropdownRef = useRef(null);

  const API_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    function handleClickOutside(event) {
      if (payeeDropdownRef.current && !payeeDropdownRef.current.contains(event.target)) {
        setIsPayeeDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Fetch audit trail whenever the editing document changes
  useEffect(() => {
    if (!editingDoc?.documentid) {
      setAuditTrail([]);
      setShowAudit(false);
      return;
    }
    setAuditLoading(true);
    fetch(`${API_URL}/api/documents/${editingDoc.documentid}/audit`)
      .then(r => r.json())
      .then(data => { setAuditTrail(Array.isArray(data) ? data : []); })
      .catch(() => setAuditTrail([]))
      .finally(() => setAuditLoading(false));
  }, [editingDoc?.documentid]);

  const formatAuditDate = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const ACTION_META = {
    CREATE:          { label: 'Created',            color: 'bg-emerald-100 text-emerald-700' },
    UPDATE:          { label: 'Updated',            color: 'bg-blue-100 text-blue-700' },
    ARCHIVE:         { label: 'Archived',           color: 'bg-amber-100 text-amber-700' },
    RESTORE:         { label: 'Restored',           color: 'bg-teal-100 text-teal-700' },
    PROCESSING_DAYS: { label: 'Processing Days',    color: 'bg-purple-100 text-purple-700' },
  };

  const FIELD_LABELS = {
    dtsno: 'DTS No.', documenttype: 'Document Type', route: 'Route',
    remarks: 'Remarks', time: 'Time', datereleased: 'Date Released',
    datesent: 'Date Sent', processedby: 'Processed By', payee: 'Payee',
    amount: 'Amount', seriesno: 'Series No.', particulars: 'Particulars',
    queueno: 'Queue No.', isarchive: 'Archived', archivedate: 'Archive Date',
    deducteddays: 'Deducted Days', calcnetworkdays: 'Calc. Days', networkdaysremarks: 'Days Remarks',
    include_friday: 'Include Friday',
  };

  const formatAuditVal = (field, val) => {
    if (val === null || val === undefined || val === '') return '-';
    if (field === 'include_friday') {
      return val === true || String(val) === 'true' ? 'Yes' : 'No';
    }
    if (field === 'networkdaysremarks') {
      if (typeof val === 'string' && val.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) {
            return parsed.map(item => `${item.remarks} (${item.days} ${item.days === 1 ? 'day' : 'days'})`).join(', ');
          }
        } catch (e) {
          // Fallback
        }
      }
    }
    return String(val);
  };

  // Format date for input field
  const formatDateForInput = (dateString) => {
    if (!dateString || dateString === '-') return '';
    // If already in display format, return as-is
    if (dateString.match(/^[A-Za-z]+ \d{1,2}, \d{4} at \d{1,2}:\d{2} [AP]M$/)) {
      return dateString;
    }
    // Handle database format (YYYY-MM-DD HH:mm:ss)
    const dbFormat = dateString.match(
      /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
    );
    if (dbFormat) {
      const [, year, month, day, hour, minute] = dbFormat;
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const monthName = monthNames[parseInt(month, 10) - 1];
      let hours = parseInt(hour, 10);
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${monthName} ${parseInt(day, 10)}, ${year} at ${hours}:${minute} ${ampm}`;
    }
    // Handle ISO format
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      const month = date.toLocaleString('default', { month: 'long' });
      const day = date.getDate();
      const year = date.getFullYear();
      let hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${month} ${day}, ${year} at ${hours}:${minutes} ${ampm}`;
    } catch (e) {
      console.error('Error formatting date:', e);
      return '';
    }
  };

  // Format date for html datetime-local input field
  const formatDateForDatetimeLocal = (dateString) => {
    if (!dateString || dateString === '-') return '';
    
    // If already in display format (e.g. "June 12, 2025 at 10:30 AM")
    const displayFormat = dateString.match(
      /^\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s+(AM|PM)\s*$/i,
    );
    if (displayFormat) {
      const monthMap = {
        january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
        july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
      };
      const month = monthMap[displayFormat[1].toLowerCase()];
      const day = parseInt(displayFormat[2]);
      const year = parseInt(displayFormat[3]);
      let hours = parseInt(displayFormat[4]);
      const minutes = parseInt(displayFormat[5]);
      const period = displayFormat[6].toUpperCase();
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      const dateObj = new Date(year, month, day, hours, minutes);
      const pad = (n) => n.toString().padStart(2, '0');
      return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}T${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
    }

    // Handle database format (YYYY-MM-DD HH:mm:ss)
    const dbFormat = dateString.match(
      /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
    );
    if (dbFormat) {
      const [, year, month, day, hour, minute] = dbFormat;
      return `${year}-${month}-${day}T${hour}:${minute}`;
    }

    // Handle standard ISO or parseable dates
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      const pad = (n) => n.toString().padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    } catch (e) {
      console.error('Error parsing for datetimepicker:', e);
      return '';
    }
  };

  const validateReceivedDate = (input) => {
    if (!input) {
      return { isValid: false, error: 'Date Received is required.' };
    }
    const d = new Date(input);
    if (isNaN(d.getTime())) {
      return { isValid: false, error: 'Invalid date/time selected.' };
    }
    return { isValid: true, normalized: input };
  };

  const formatDateToMMDDYYYY = (dateString) => {
    if (!dateString || dateString === '-') return '';
    try {
      // If already matches MM/DD/YYYY
      if (dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        return dateString;
      }
      
      // If display format: "June 7, 2025 at 10:30 AM"
      const displayFormat = dateString.match(
        /^\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s+(AM|PM)\s*$/i,
      );
      if (displayFormat) {
        const monthMap = {
          january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
          july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
        };
        const month = monthMap[displayFormat[1].toLowerCase()];
        const day = parseInt(displayFormat[2]);
        const year = parseInt(displayFormat[3]);
        const pad = (n) => n.toString().padStart(2, '0');
        return `${pad(month)}/${pad(day)}/${year}`;
      }

      // If YYYY-MM-DD HH:mm:ss or YYYY-MM-DD
      const ymdMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (ymdMatch) {
        return `${ymdMatch[2]}/${ymdMatch[3]}/${ymdMatch[1]}`;
      }

      // ISO or standard Date string
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      const pad = (n) => n.toString().padStart(2, '0');
      return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()}`;
    } catch (e) {
      console.error('Error formatting to MM/DD/YYYY:', e);
      return dateString;
    }
  };

  useEffect(() => {
    if (editingDoc) {
      let formattedDate = '';
      let formattedDateSent = '';

      // Handle Date Released (datereleased)
      if (editingDoc.datereleased && editingDoc.datereleased !== '-') {
        try {
          formattedDate = formatDateForDatetimeLocal(editingDoc.datereleased);
          setInitialDate(formattedDate);
        } catch (e) {
          console.error('Error parsing date:', e);
        }
      } else {
        const now = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        formattedDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
        setInitialDate(null);
      }

      // Handle Date Sent (datesent)
      if (editingDoc.datesent && editingDoc.datesent !== '-') {
        try {
          formattedDateSent = formatDateForDatetimeLocal(editingDoc.datesent);
        } catch (e) {
          console.error('Error formatting datesent:', e);
        }
      }
      setFormData({
        route: editingDoc.route || '',
        dtsNo: editingDoc.dtsno || editingDoc.dtsNo || '',
        remarks: editingDoc.remarks || '',
        date: formattedDate,
        datereleasedinput: formattedDateSent || '',
        payee: editingDoc.payee || '',
        amount: editingDoc.amount !== null && editingDoc.amount !== undefined ? String(editingDoc.amount) : '',
        seriesNo: editingDoc.seriesNo || editingDoc.seriesno || '',
        particulars: editingDoc.particulars || '',
        queueNo: editingDoc.queueNo || editingDoc.queueno || '',
        includeFriday: editingDoc.include_friday !== false,
        processedBy: editingDoc.processedby || editingDoc.processedBy || '-',
      });
      setPayeeSearch(editingDoc.payee || '');
      setCustomPayee('');
      setShowCustomPayee(false);
      // Apply case-insensitive lookup if documentTypes is already loaded
      const matched = documentTypes.find(
        (t) => t.documenttype.toLowerCase() === (editingDoc.documenttype || '').toLowerCase()
      );
      setSelectedDocType(matched ? matched.documenttype : (editingDoc.documenttype || ''));
    } else {
      const now = new Date();
      const pad = (n) => n.toString().padStart(2, '0');
      const localDatetime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

      setFormData({
        route: '',
        dtsNo: '',
        remarks: '',
        date: now.toISOString().split('T')[0],
        datereleasedinput: localDatetime,
        payee: '',
        amount: '',
        seriesNo: '',
        particulars: '',
        queueNo: '',
        includeFriday: false,
      });
      setPayeeSearch('');
      setCustomPayee('');
      setShowCustomPayee(false);
      setSelectedDocType('');
    }
  }, [editingDoc, documentTypes]);

  useEffect(() => {
    const fetchDocumentTypes = async () => {
      try {
        const response = await fetch(`${API_URL}/api/document-types`);
        const data = await response.json();
        setDocumentTypes(data);
        if (editingDoc?.documenttype) {
          const matched = data.find(
            (t) => t.documenttype.toLowerCase() === editingDoc.documenttype.toLowerCase()
          );
          setSelectedDocType(matched ? matched.documenttype : editingDoc.documenttype);
        }
      } catch (error) {
        console.error('Error fetching document types:', error);
      }
    };

    if (isOpen) fetchDocumentTypes();
  }, [isOpen, editingDoc]);

  // Fetch payees when overlay opens
  useEffect(() => {
    const fetchPayees = async () => {
      try {
        const response = await fetch(`${API_URL}/api/payees`);
        if (response.ok) {
          const data = await response.json();
          setPayees(data);
        }
      } catch (err) {
        console.error('Error fetching payees:', err);
      }
    };
    if (isOpen) fetchPayees();
  }, [isOpen, API_URL]);

  // Fetch routes when overlay opens
  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const response = await fetch(`${API_URL}/api/routes`);
        if (response.ok) {
          const data = await response.json();
          setRoutes(data);
        }
      } catch (err) {
        console.error('Error fetching routes:', err);
      }
    };
    if (isOpen) fetchRoutes();
  }, [isOpen, API_URL]);

  const handleInputChange = (e) => {
    if (viewMode) return;
    const { name, value } = e.target;
    let newValue = value;
    if (name === 'dtsNo') {
      newValue = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    }
    setFormData((prev) => ({ ...prev, [name]: newValue }));
  };

  const handleDocTypeChange = (e) => {
    const value = e.target.value;
    setSelectedDocType(value);
    setShowCustomDocType(value === 'Others');
  };

  const handleAddOrRemoveDocType = async (action) => {
    let newErrors = { ...errors };

    if (!customDocType.trim()) {
      newErrors.customDocType = 'Please enter a document type.';
      setErrors(newErrors);
      return;
    }

    const typeName = customDocType.trim();

    if (action === 'add') {
      const exists = documentTypes.some(
        (dt) => dt.documenttype.toLowerCase() === typeName.toLowerCase(),
      );
      if (exists) {
        newErrors.customDocType = 'Document type already exists.';
        setErrors(newErrors);
        return;
      }
    }

    if (action === 'remove') {
      const match = documentTypes.find(
        (dt) => dt.documenttype.toLowerCase() === typeName.toLowerCase(),
      );
      if (!match) {
        newErrors.customDocType = 'Document type not found.';
        setErrors(newErrors);
        return;
      }
    }

    newErrors.customDocType = '';
    setErrors(newErrors);

    try {
      if (action === 'add') {
        const response = await fetch(`${API_URL}/api/document-types`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documenttype: typeName }),
        });

        if (response.ok) {
          const newDocType = await response.json();
          setDocumentTypes([...documentTypes, newDocType]);
          setSelectedDocType(newDocType.documenttype);
          setCustomDocType('');
        } else {
          throw new Error('Failed to add document type');
        }
      } else if (action === 'remove') {
        const match = documentTypes.find(
          (dt) => dt.documenttype.toLowerCase() === typeName.toLowerCase(),
        );
        const response = await fetch(
          `${API_URL}/api/document-types/${match.documentid}`,
          {
            method: 'DELETE',
          },
        );

        if (response.ok) {
          setDocumentTypes(
            documentTypes.filter((dt) => dt.documentid !== match.documentid),
          );
          if (selectedDocType === match.documenttype) setSelectedDocType('');
          setCustomDocType('');
        } else {
          throw new Error('Failed to delete document type');
        }
      }
    } catch (error) {
      newErrors.customDocType = error.message || 'An error occurred.';
      setErrors(newErrors);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const newErrors = {};

    // Validate required fields
    if (!formData.route || formData.route === '' || formData.route === '-') {
      newErrors.route = 'This field is required.';
    }
    if (!formData.dtsNo || formData.dtsNo === '') {
      newErrors.dtsNo = 'This field is required.';
    }
    // Validate date received only when required
    if (
      !viewMode &&
      (!editingDoc ||
        editingDoc?.datereleased === null ||
        editingDoc?.datereleased === 'null' ||
        editingDoc?.datereleased === '-')
    ) {
      if (!formData.date) {
        newErrors.date = 'This field is required.';
      }
    }

    // Check for duplicate DTS No if new or changed
    if (
      !newErrors.dtsNo &&
      (!editingDoc || formData.dtsNo !== editingDoc.dtsno)
    ) {
      try {
        const dtsNoToCheck = formData.dtsNo.trim().toUpperCase();
        const response = await fetch(
          `${API_URL}/api/documents?dtsno=${dtsNoToCheck}`,
        );
        if (response.ok) {
          const docs = await response.json();
          const exists = docs.some(
            (doc) =>
              doc.dtsno?.toUpperCase() === dtsNoToCheck &&
              (doc.route === 'Accounting Unit' || doc.route === 'ORD') &&
              doc.isarchive === false,
          );
          const existTwo = docs.some(
            (doc) =>
              doc.dtsno?.toUpperCase() === dtsNoToCheck &&
              doc.documentdirection === 'incoming' &&
              doc.isarchive === false,
          );

          if (exists) {
            newErrors.dtsNo =
              'Cannot add record because this document/DTS No is already processed.';
          } else if (existTwo) {
            newErrors.dtsNo =
              'This Document/DTS No is already recorded as an incoming document.';
          }
        }
      } catch (err) {
        console.error('Error checking DTS No:', err);
      }
    }

    if (!viewMode && formData.datereleasedinput) {
      const validationResult = validateReceivedDate(formData.datereleasedinput);

      if (!validationResult.isValid) {
        newErrors.datereleasedinput = validationResult.error;
      } else {
        setFormData((prev) => ({
          ...prev,
          datereleasedinput: validationResult.normalized,
        }));
      }
    }

    if (formData.payee === 'Other' && (!customPayee || !customPayee.trim())) {
      newErrors.customPayee = 'Payee name is required when Other is selected.';
    }

    // Show errors if any
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstError = Object.keys(newErrors)[0];
      const element = document.querySelector(`[name="${firstError}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    setErrors({});

    try {
      setIsSubmitting(true);

      let finalPayee = formData.payee?.trim() || null;
      if (formData.payee === 'Other' && customPayee.trim()) {
        const payeeResponse = await fetch(`${API_URL}/api/payees`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payeename: customPayee.trim() }),
        });
        if (payeeResponse.ok) {
          const savedPayee = await payeeResponse.json();
          finalPayee = savedPayee.payeename;
        } else {
          const pErr = await payeeResponse.json();
          if (pErr.error === 'Payee already exists') {
            finalPayee = customPayee.trim();
          } else {
            throw new Error(pErr.error || 'Failed to save new payee');
          }
        }
      }

      const admin = JSON.parse(localStorage.getItem('admin') || '{}');
      const documentData = {
        dtsno: formData.dtsNo.trim().toUpperCase(),
        seriesno: formData.seriesNo?.trim() || null,
        particulars: formData.particulars?.trim() || null,
        queueno: formData.queueNo?.trim() || null,
        documenttype: selectedDocType ? selectedDocType.trim() : null,
        route: formData.route.trim(),
        remarks: formData.remarks?.trim() || null,
        documentdirection: 'outgoing',
        processedbyid: admin.adminid || null,
        payee: finalPayee,
        amount: formData.amount ? parseFloat(formData.amount) : null,
        include_friday: formData.includeFriday,
      };

      if (!viewMode && formData.date) {
        const dateObj = new Date(formData.date);
        if (!isNaN(dateObj.getTime())) {
          const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
          ];
          const monthName = monthNames[dateObj.getMonth()];
          let displayHours = dateObj.getHours();
          const ampm = displayHours >= 12 ? 'PM' : 'AM';
          displayHours = displayHours % 12 || 12;
          const displayMinutes = dateObj.getMinutes().toString().padStart(2, '0');
          documentData.datereleased = `${monthName} ${dateObj.getDate()}, ${dateObj.getFullYear()} at ${displayHours}:${displayMinutes} ${ampm}`;
        } else {
          documentData.datereleased = null;
        }
      } else {
        documentData.datereleased = editingDoc?.datereleased || null;
      }

      if (!viewMode && formData.datereleasedinput) {
        const dateObj = new Date(formData.datereleasedinput);
        if (!isNaN(dateObj.getTime())) {
          const pad = (n) => n.toString().padStart(2, '0');
          const year = dateObj.getFullYear();
          const month = dateObj.getMonth() + 1;
          const day = dateObj.getDate();
          const hours = dateObj.getHours();
          const minutes = dateObj.getMinutes();
          documentData.datesent = `${year}-${pad(month)}-${pad(day)} ${pad(hours)}:${pad(minutes)}:00`;
        }
      }

      const url = editingDoc
        ? `${API_URL}/api/documents/${editingDoc.documentid}`
        : `${API_URL}/api/documents`;

      const response = await fetch(url, {
        method: editingDoc ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(documentData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save document');
      }

      const result = await response.json();
      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
      Swal.fire({
        icon: 'success',
        title: editingDoc ? 'Updated!' : 'Added!',
        text: editingDoc
          ? 'Document updated successfully.'
          : 'Document added successfully.',
        timer: 1500,
        showConfirmButton: false,
        customClass: {
          popup: 'swal2-minimalist',
        },
      });
    } catch (error) {
      console.error('Submission failed:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text:
          error.message || 'Failed to save document. Please check your inputs.',
        timer: 2500,
        showConfirmButton: false,
        customClass: {
          popup: 'swal2-minimalist',
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isOpen) return;

      if (event.key === 'Enter' && !viewMode && !isSubmitting) {
        event.preventDefault();
        handleSubmit();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onClose(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, viewMode, isSubmitting, onClose, handleSubmit]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-slate-900/50 backdrop-blur-sm p-4 modal-backdrop">
      <div
        ref={popupRef}
        className={`modal-panel w-full ${editingDoc?.documentid ? 'max-w-[1250px]' : 'max-w-[900px]'} flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="modal-header-bar blue px-6 py-5 flex items-start justify-between flex-shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-0.5">
              Outgoing Document
            </p>
            <h2 className="text-lg font-extrabold text-white tracking-tight">
              {editMode && editingDoc
                ? 'View / Edit Document'
                : 'New Outgoing Record'}
            </h2>
          </div>
          <button
            onClick={() => onClose(false)}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer mt-0.5 flex-shrink-0"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Main Content Area (Split if editingDoc exists) */}
        <div className="flex flex-col md:flex-row overflow-hidden max-h-[70vh] flex-1">
          {/* Left panel: Form */}
          <div className="flex-1 px-6 py-5 overflow-y-auto scrollbar-hide">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              {/* Route */}
              <div className="modal-field">
                <label className="modal-label">
                  Routed To <span className="req">*</span>
                </label>
                <select
                  name="route"
                  value={formData.route}
                  onChange={handleInputChange}
                  className={`modal-input modal-select ${errors.route ? 'error' : ''}`}
                  disabled={viewMode}
                  required
                >
                  <option value="">Select Route</option>
                  {routes.map((r) => (
                    <option key={r.routeid} value={r.routename}>
                      {r.routename}
                    </option>
                  ))}
                </select>
                {errors.route && <p className="modal-error-msg">{errors.route}</p>}
              </div>

              {/* DTS No */}
              <div className="modal-field">
                <label className="modal-label">
                  DTS No. <span className="req">*</span>
                </label>
                <input
                  type="text"
                  name="dtsNo"
                  value={formData.dtsNo}
                  onChange={handleInputChange}
                  placeholder="e.g. ORD1070"
                  className={`modal-input uppercase ${errors.dtsNo ? 'error' : ''}`}
                  onKeyPress={(e) => {
                    if (!/[a-zA-Z0-9]/.test(e.key)) e.preventDefault();
                  }}
                  disabled={viewMode}
                />
                {errors.dtsNo && <p className="modal-error-msg">{errors.dtsNo}</p>}
              </div>

              {/* Series No */}
              <div className="modal-field">
                <label className="modal-label">Series No.</label>
                <input
                  type="text"
                  name="seriesNo"
                  value={formData.seriesNo}
                  onChange={handleInputChange}
                  placeholder="e.g. 2026-0001"
                  className="modal-input"
                  disabled={viewMode}
                />
              </div>

              {/* Queue No */}
              <div className="modal-field">
                <label className="modal-label">Queue No.</label>
                <input
                  type="text"
                  name="queueNo"
                  value={formData.queueNo}
                  onChange={handleInputChange}
                  placeholder="e.g. Q-001"
                  className="modal-input"
                  disabled={viewMode}
                />
              </div>

              {/* Document Type */}
              <div className="modal-field">
                <label className="modal-label">
                  Document Type
                </label>
                <select
                  className={`modal-input modal-select ${errors.documentType ? 'error' : ''}`}
                  value={selectedDocType}
                  onChange={handleDocTypeChange}
                  disabled={viewMode}
                >
                  <option value="">Select Document Type</option>
                  {selectedDocType &&
                    selectedDocType !== 'Others' &&
                    !documentTypes.some(
                      (type) => type.documenttype.toLowerCase() === selectedDocType.toLowerCase()
                    ) && (
                      <option value={selectedDocType}>{selectedDocType}</option>
                    )}
                  {documentTypes.map((type) => (
                    <option key={type.documentid} value={type.documenttype}>
                      {type.documenttype}
                    </option>
                  ))}
                  <option value="Others">Others...</option>
                </select>
                {errors.documentType && (
                  <p className="modal-error-msg">{errors.documentType}</p>
                )}
              </div>

              {/* Gross Amount Field */}
              <div className="modal-field">
                <label className="modal-label">Gross Amount</label>
                <input
                  type={viewMode ? "text" : "number"}
                  name="amount"
                  step="0.01"
                  placeholder="e.g. 1500.00"
                  className="modal-input"
                  value={formData.amount}
                  onChange={handleInputChange}
                  disabled={viewMode}
                />
              </div>

              {/* Processed By Field */}
              {editingDoc && (
                <div className="modal-field">
                  <label className="modal-label">Processed By</label>
                  <input
                    type="text"
                    className="modal-input bg-slate-50 border-slate-200"
                    value={formData.processedBy || '-'}
                    disabled
                  />
                </div>
              )}

              {/* Custom Type (col-span-2) */}
              {showCustomDocType && !viewMode && (
                <div className="md:col-span-2 p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                  <label className="modal-label">Custom Document Type</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Enter document type"
                      className={`modal-input flex-1 !h-10 ${errors.customDocType ? 'error' : ''}`}
                      value={customDocType}
                      onChange={(e) => {
                        setCustomDocType(e.target.value);
                        setErrors((prev) => ({ ...prev, customDocType: '' }));
                      }}
                    />
                    <button
                      className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center"
                      onClick={() => handleAddOrRemoveDocType('add')}
                    >
                      Add
                    </button>
                    <button
                      className="h-10 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center"
                      onClick={() => handleAddOrRemoveDocType('remove')}
                    >
                      Remove
                    </button>
                  </div>
                  {errors.customDocType && (
                    <p className="modal-error-msg">{errors.customDocType}</p>
                  )}
                </div>
              )}

              {/* Payee Selection (col-span-2 or col-span-1 depending on mode, let's keep it clean as 1-col but wide or col-span-2 to show search list clearly) */}
              <div className="modal-field relative font-sans md:col-span-2" ref={payeeDropdownRef}>
                <label className="modal-label">Payee</label>
                {viewMode ? (
                  <input
                    type="text"
                    className="modal-input"
                    value={formData.payee}
                    disabled
                  />
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type to search or select payee..."
                      className="modal-input w-full pr-10"
                      value={payeeSearch}
                      onChange={(e) => {
                        setPayeeSearch(e.target.value);
                        setIsPayeeDropdownOpen(true);
                        if (!e.target.value) {
                          setFormData({ ...formData, payee: '' });
                          setShowCustomPayee(false);
                        }
                      }}
                      onFocus={() => setIsPayeeDropdownOpen(true)}
                    />
                    <button
                      type="button"
                      onClick={() => setIsPayeeDropdownOpen(!isPayeeDropdownOpen)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      <svg className={`w-4 h-4 transition-transform duration-200 ${isPayeeDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isPayeeDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-slate-100">
                        {/* Other option at the top */}
                        <div
                          className="px-4 py-2.5 text-xs font-bold text-sky-700 hover:bg-sky-50 cursor-pointer transition-colors flex items-center gap-1.5"
                          onClick={() => {
                            setFormData({ ...formData, payee: 'Other' });
                            setPayeeSearch('Other');
                            setIsPayeeDropdownOpen(false);
                            setShowCustomPayee(true);
                          }}
                        >
                          <span>+ Other (Type a new payee...)</span>
                        </div>

                        {/* Filtered list of payees */}
                        {payees
                          .filter((p) => {
                            if (payeeSearch === formData.payee) return true;
                            return p.payeename.toLowerCase().includes(payeeSearch.toLowerCase());
                          })
                          .map((p) => (
                            <div
                              key={p.payeeid}
                              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer transition-colors"
                              onClick={() => {
                                setFormData({ ...formData, payee: p.payeename });
                                setPayeeSearch(p.payeename);
                                setIsPayeeDropdownOpen(false);
                                setShowCustomPayee(false);
                              }}
                            >
                              {p.payeename}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
                {errors.payee && (
                  <p className="modal-error-msg">{errors.payee}</p>
                )}
              </div>

              {/* Custom Payee input (col-span-2) */}
              {showCustomPayee && !viewMode && (
                <div className="modal-field animate-fadeIn md:col-span-2">
                  <label className="modal-label text-sky-700">New Payee Name</label>
                  <input
                    type="text"
                    placeholder="Enter new payee name..."
                    className="modal-input"
                    value={customPayee}
                    onChange={(e) => {
                      setCustomPayee(e.target.value);
                      if (errors.customPayee) setErrors((prev) => ({ ...prev, customPayee: '' }));
                    }}
                  />
                  {errors.customPayee && (
                    <p className="modal-error-msg">{errors.customPayee}</p>
                  )}
                </div>
              )}

              {/* Date & Time Section (col-span-2) */}
              <div className="md:col-span-2 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Date Received */}
                  <div className="modal-field">
                    <label className="modal-label">
                      Date Received <span className="req">*</span>
                    </label>
                    <input
                      type={viewMode ? "text" : "datetime-local"}
                      name="datereleasedinput"
                      value={viewMode ? (editingDoc?.datesent ? formatDateForInput(editingDoc.datesent) : '') : (formData.datereleasedinput || '')}
                      onChange={handleInputChange}
                      className={`modal-input ${errors.datereleasedinput ? 'error' : ''}`}
                      disabled={viewMode}
                      required
                    />
                    {errors.datereleasedinput && (
                      <p className="modal-error-msg">{errors.datereleasedinput}</p>
                    )}
                  </div>
                  {/* Date Released */}
                  <div className="modal-field">
                    <label className="modal-label">
                      Date Released <span className="req">*</span>
                    </label>
                    <input
                      type={viewMode ? "text" : "datetime-local"}
                      name="date"
                      value={viewMode ? formatDateToMMDDYYYY(editingDoc?.datereleased || formData.date) : (formData.date || '')}
                      onChange={handleInputChange}
                      className={`modal-input ${errors.date ? 'error' : ''}`}
                      disabled={viewMode}
                      required
                    />
                    {errors.date && (
                      <p className="modal-error-msg">{errors.date}</p>
                    )}
                  </div>
                </div>
                {/* Include Friday Option */}
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="includeFriday"
                    name="includeFriday"
                    checked={formData.includeFriday}
                    onChange={(e) => setFormData(prev => ({ ...prev, includeFriday: e.target.checked }))}
                    disabled={viewMode}
                    className="w-4 h-4 text-[#0b4c95] border-slate-300 rounded focus:ring-[#0b4c95] cursor-pointer"
                  />
                  <label htmlFor="includeFriday" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                    Include Friday in turnaround time calculation (uncheck to exclude Fridays)
                  </label>
                </div>
              </div>

              {/* Particulars (col-span-2) */}
              <div className="modal-field md:col-span-2">
                <label className="modal-label">Particulars</label>
                <textarea
                  name="particulars"
                  placeholder="Enter document particulars..."
                  className="modal-textarea min-h-[5rem]"
                  value={formData.particulars}
                  onChange={handleInputChange}
                  disabled={viewMode}
                />
              </div>

              {/* Remarks (col-span-2) */}
              <div className="modal-field md:col-span-2">
                <label className="modal-label">Remarks</label>
                {viewMode ? (
                  <div className="modal-textarea !h-auto min-h-[5.5rem] bg-slate-50 border-slate-200">
                    {formData.remarks || '-'}
                  </div>
                ) : (
                  <textarea
                    name="remarks"
                    value={formData.remarks}
                    onChange={handleInputChange}
                    placeholder="Enter Remarks"
                    className="modal-textarea"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right panel: Audit Trail (if editingDoc exists) */}
          {editingDoc?.documentid && (
            <div className="w-full md:w-[380px] bg-slate-50/50 p-5 flex flex-col border-t md:border-t-0 md:border-l border-slate-200 overflow-hidden">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 mb-4 flex-shrink-0">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Audit Trail
                {auditTrail.length > 0 && (
                  <span className="text-[10px] font-extrabold bg-[#0b4c95] text-white px-2 py-0.5 rounded-full">{auditTrail.length}</span>
                )}
              </h3>

              <div className="overflow-y-auto flex-1 space-y-2 pr-1 scrollbar-hide">
                {auditLoading ? (
                  <div className="flex items-center justify-center py-12 text-slate-400">
                    <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    <span className="text-xs font-medium">Loading history...</span>
                  </div>
                ) : auditTrail.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-6">No audit history found.</p>
                ) : (
                  auditTrail.map((entry) => {
                    const meta = ACTION_META[entry.action] || { label: entry.action, color: 'bg-slate-100 text-slate-600' };
                    const changes = entry.changes || {};
                    const changeKeys = Object.keys(changes);
                    return (
                      <div key={entry.auditid} className="flex gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-white hover:shadow-sm transition-all">
                        <div className="flex-shrink-0 w-1.5 rounded-full self-stretch" style={{ background: meta.color.includes('emerald') ? '#10b981' : meta.color.includes('blue') ? '#3b82f6' : meta.color.includes('amber') ? '#f59e0b' : meta.color.includes('teal') ? '#14b8a6' : '#a855f7' }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wide ${meta.color}`}>{meta.label}</span>
                            {entry.changedby && entry.changedby !== 'System' && (
                              <span className="text-[10px] font-bold text-slate-500">by {entry.changedby}</span>
                            )}
                            <span className="text-[10px] text-slate-400 ml-auto">{formatAuditDate(entry.changedat)}</span>
                          </div>
                          {changeKeys.length > 0 && (
                            <div className="mt-1.5 space-y-0.5">
                              {changeKeys.filter(k => {
                                const c = changes[k];
                                return entry.action !== 'CREATE' || (c.new !== null && c.new !== '' && c.new !== undefined);
                              }).map(field => {
                                const c = changes[field];
                                const label = { ...FIELD_LABELS, include_friday: 'Include Friday' }[field] || field;
                                if (entry.action === 'CREATE') {
                                  return (
                                    <p key={field} className="text-[10px] text-slate-500">
                                      <span className="font-bold text-slate-700">{label}:</span> {formatAuditVal(field, c.new)}
                                    </p>
                                  );
                                }
                                return (
                                  <p key={field} className="text-[10px] text-slate-500">
                                    <span className="font-bold text-slate-700">{label}:</span>{' '}
                                    <span className="line-through text-rose-400">{formatAuditVal(field, c.old)}</span>
                                    {' → '}
                                    <span className="text-emerald-600 font-semibold">{formatAuditVal(field, c.new)}</span>
                                  </p>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex items-center justify-end gap-3 flex-shrink-0">
          <button className="modal-cancel-btn" onClick={() => onClose(false)}>
            {viewMode ? 'Close' : 'Cancel'}
          </button>
          {!viewMode && (
            <button
              className="modal-submit-btn text-white"
              style={{
                background: 'linear-gradient(135deg, #0b4c95 0%, #1460A2 100%)',
                boxShadow: '0 4px 12px rgba(11,76,149,0.25)',
              }}
              onClick={handleSubmit}
              disabled={isSubmitting}
              type="button"
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin h-3.5 w-3.5"
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
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8z"
                    />
                  </svg>
                  Saving...
                </>
              ) : editMode ? (
                'Update'
              ) : (
                'Submit Record'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default OverlayOutgoing;
