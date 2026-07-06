import { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import '../index.css';

function OverlayIncoming({
  isOpen,
  onClose,
  editingDoc,
  viewMode,
  editMode,
  onSuccess,
}) {
  const popupRef = useRef(null);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [payees, setPayees] = useState([]);
  const [payeeSearch, setPayeeSearch] = useState('');
  const [isPayeeDropdownOpen, setIsPayeeDropdownOpen] = useState(false);
  const [customPayee, setCustomPayee] = useState('');
  const [showCustomPayee, setShowCustomPayee] = useState(false);
  const payeeDropdownRef = useRef(null);

  const [showCustomDocType, setShowCustomDocType] = useState(false);
  const [customDocType, setCustomDocType] = useState('');
  const [selectedDocType, setSelectedDocType] = useState('');
  const [formData, setFormData] = useState({
    dtsNo: '',
    seriesNo: '',
    particulars: '',
    queueNo: '',
    processedBy: '',
    time: '',
    route: '',
    payee: '',
    amount: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [auditTrail, setAuditTrail] = useState([]);
  const [showAudit, setShowAudit] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);

  const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3600';
  const API_URL = rawApiUrl.endsWith('/api') ? rawApiUrl.slice(0, -4) : rawApiUrl;

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

  // Initialize form data when editing/prefill
  useEffect(() => {
    if (editingDoc) {
      setFormData({
        dtsNo: editingDoc.dtsno || editingDoc.dtsNo || '',
        seriesNo: editingDoc.seriesNo || editingDoc.seriesno || '',
        particulars: editingDoc.particulars || '',
        queueNo: editingDoc.queueNo || editingDoc.queueno || '',
        processedBy: editingDoc.processedby || editingDoc.processedBy || '-',
        time: editingDoc.time && editingDoc.time !== '-' ? editingDoc.time : '',
        route: editingDoc.route && editingDoc.route !== '-' ? editingDoc.route : '',
        amount: editingDoc.amount || '',
        payee: editingDoc.payee && editingDoc.payee !== '-' ? editingDoc.payee : '',
      });
      setPayeeSearch(editingDoc.payee && editingDoc.payee !== '-' ? editingDoc.payee : '');
      setShowCustomPayee(false);
      setCustomPayee('');
      // Apply case-insensitive lookup if documentTypes is already loaded
      const matched = documentTypes.find(
        (t) => t.documenttype.toLowerCase() === (editingDoc.documenttype || '').toLowerCase()
      );
      setSelectedDocType(matched ? matched.documenttype : (editingDoc.documenttype || ''));
      setShowCustomDocType(false);
    } else {
      setFormData({
        dtsNo: '',
        seriesNo: '',
        particulars: '',
        queueNo: '',
        processedBy: '',
        time: '',
        route: '',
        payee: '',
        amount: '',
      });
      setPayeeSearch('');
      setShowCustomPayee(false);
      setCustomPayee('');
      setSelectedDocType('');
      setShowCustomDocType(false);
      setErrors({});
    }
  }, [editingDoc, isOpen, documentTypes]);

  // Fetch document types when overlay opens
  useEffect(() => {
    const fetchDocumentTypes = async () => {
      try {
        const response = await fetch(`${API_URL}/api/document-types`);
        const data = await response.json();
        setDocumentTypes(data);
        // Re-apply selectedDocType after options load to fix the race condition
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
  }, [isOpen, API_URL, editingDoc]);

  // Fetch routes when overlay opens
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
    if (isOpen) fetchRoutes();
  }, [isOpen, API_URL]);

  // Fetch payees when overlay opens
  useEffect(() => {
    const fetchPayees = async () => {
      try {
        const response = await fetch(`${API_URL}/api/payees`);
        const data = await response.json();
        setPayees(data);
      } catch (error) {
        console.error('Error fetching payees:', error);
      }
    };
    if (isOpen) fetchPayees();
  }, [isOpen, API_URL]);

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
    CREATE:          { label: 'Created',         color: 'bg-emerald-100 text-emerald-700' },
    UPDATE:          { label: 'Updated',         color: 'bg-blue-100 text-blue-700' },
    ARCHIVE:         { label: 'Archived',        color: 'bg-amber-100 text-amber-700' },
    RESTORE:         { label: 'Restored',        color: 'bg-teal-100 text-teal-700' },
    PROCESSING_DAYS: { label: 'Processing Days', color: 'bg-purple-100 text-purple-700' },
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

  const handleInputChange = (e) => {
    if (viewMode) return;
    const { name, value } = e.target;
    let newValue = value;
    if (name === 'dtsNo') {
      newValue = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    }
    setFormData((prev) => ({ ...prev, [name]: newValue }));
  };

  const handleDtsNoChange = (e) => {
    if (viewMode) return;
    const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    setFormData({ ...formData, dtsNo: value });
    if (errors.dtsNo) setErrors((prev) => ({ ...prev, dtsNo: '' }));
  };

  const handleSeriesNoChange = (e) => {
    if (viewMode) return;
    setFormData({ ...formData, seriesNo: e.target.value });
    if (errors.seriesNo) setErrors((prev) => ({ ...prev, seriesNo: '' }));
  };

  const handleParticularsChange = (e) => {
    if (viewMode) return;
    setFormData({ ...formData, particulars: e.target.value });
  };

  const handleQueueNoChange = (e) => {
    if (viewMode) return;
    setFormData({ ...formData, queueNo: e.target.value });
  };

  const handleTimeChange = (e) => {
    if (viewMode) return;
    setFormData({ ...formData, time: e.target.value });
  };

  const handleRouteChange = (e) => {
    if (viewMode) return;
    setFormData({ ...formData, route: e.target.value });
  };

  const handleDocTypeChange = (e) => {
    if (viewMode) return;
    const value = e.target.value;
    setSelectedDocType(value);
    setShowCustomDocType(value === 'Others');
    if (errors.documentType)
      setErrors((prev) => ({ ...prev, documentType: '' }));
  };

  const handleAddOrRemoveDocType = async (action) => {
    if (!customDocType.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Input required',
        text: 'Please enter a document type.',
        timer: 1800,
        showConfirmButton: false,
        customClass: { popup: 'swal2-minimalist' },
      });
      return;
    }
    const typeName = customDocType.trim();

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
          setShowCustomDocType(false);
          setCustomDocType('');
          Swal.fire({
            icon: 'success',
            title: 'Added!',
            text: 'Document type added.',
            timer: 1500,
            showConfirmButton: false,
            customClass: { popup: 'swal2-minimalist' },
          });
        } else {
          throw new Error('Failed to add document type');
        }
      } else if (action === 'remove') {
        const match = documentTypes.find((dt) => dt.documenttype === typeName);
        if (!match) {
          Swal.fire({
            icon: 'info',
            title: 'Not found',
            text: 'Document type not found.',
            timer: 1800,
            showConfirmButton: false,
            customClass: { popup: 'swal2-minimalist' },
          });
          return;
        }

        const response = await fetch(
          `${API_URL}/api/document-types/${match.documentid}`,
          { method: 'DELETE' },
        );

        if (response.ok) {
          setDocumentTypes(
            documentTypes.filter((dt) => dt.documentid !== match.documentid),
          );
          if (selectedDocType === match.documenttype) setSelectedDocType('');
          setShowCustomDocType(false);
          setCustomDocType('');
          Swal.fire({
            icon: 'success',
            title: 'Removed!',
            text: 'Document type removed.',
            timer: 1500,
            showConfirmButton: false,
            customClass: { popup: 'swal2-minimalist' },
          });
        } else {
          throw new Error('Failed to delete document type');
        }
      }
    } catch (error) {
      console.error('Document type operation failed:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message,
        timer: 2500,
        showConfirmButton: false,
        customClass: { popup: 'swal2-minimalist' },
      });
    }
  };

  const handleSubmit = async () => {
    const newErrors = {};
    if (!formData.dtsNo) newErrors.dtsNo = 'DTS No. is required.';
    if (formData.payee === 'Other' && !customPayee.trim()) {
      newErrors.customPayee = 'Please enter new payee name.';
    }

    if (
      !newErrors.dtsNo &&
      (!editingDoc || formData.dtsNo !== editingDoc.dtsno)
    ) {
      try {
        const dtsNoToCheck = formData.dtsNo.trim().toUpperCase();
        const response = await fetch(`${API_URL}/api/incoming`);
        if (response.ok) {
          const docs = await response.json();
          const exists = docs.some(
            (doc) =>
              doc.dtsno?.toUpperCase() === dtsNoToCheck &&
              doc.documenttype === selectedDocType &&
              doc.documentid !== (editingDoc?.documentid || 0) &&
              doc.isarchive === false,
          );
          if (exists) {
            newErrors.dtsNo =
              'A document with this DTS No. and document type already exists.';
          }
        }
      } catch (err) {
        console.error('Error checking DTS No:', err);
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
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
        documentdirection: 'incoming',
        processedbyid: admin.adminid || null,
        payee: finalPayee,
        amount: formData.amount ? parseFloat(formData.amount) : null,
        time: formData.time || null,
        route: formData.route || null,
        ...(editingDoc
          ? {}
          : (() => {
              const now = new Date();
              const pad = (n) => n.toString().padStart(2, '0');
              return {
                datesent: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:00`,
              };
            })()),
      };

      const url = editingDoc
        ? `${API_URL}/api/incoming/${editingDoc.documentid}`
        : `${API_URL}/api/incoming`;
      const method = editingDoc ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(documentData),
      });

      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || 'Failed to save record');

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
        customClass: { popup: 'swal2-minimalist' },
      });
    } catch (err) {
      console.error('Submission error:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message,
        timer: 2500,
        showConfirmButton: false,
        customClass: { popup: 'swal2-minimalist' },
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
        onClose();
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
        className={`modal-panel w-full ${editingDoc?.documentid ? 'max-w-[1150px]' : 'max-w-[800px]'} flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="modal-header-bar blue px-6 py-5 flex items-start justify-between flex-shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-0.5">
              Incoming Document
            </p>
            <h2 className="text-lg font-extrabold text-white tracking-tight">
              {editMode && editingDoc
                ? 'View / Edit Document'
                : 'New Incoming Record'}
            </h2>
          </div>
          <button
            onClick={onClose}
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
              {/* DTS No */}
              <div className="modal-field">
                <label className="modal-label">
                  DTS No. <span className="req">*</span>
                </label>
                <input
                  type="text"
                  name="dtsNo"
                  placeholder="e.g. ORD1070"
                  className={`modal-input uppercase ${errors.dtsNo ? 'error' : ''}`}
                  value={formData.dtsNo}
                  onChange={handleDtsNoChange}
                  onKeyPress={(e) => {
                    if (!/[a-zA-Z0-9]/.test(e.key)) e.preventDefault();
                  }}
                  readOnly={viewMode}
                />
                {errors.dtsNo && <p className="modal-error-msg">{errors.dtsNo}</p>}
              </div>

              {/* Series No */}
              <div className="modal-field">
                <label className="modal-label">Series No.</label>
                <input
                  type="text"
                  name="seriesNo"
                  placeholder="e.g. 2026-0001"
                  className="modal-input"
                  value={formData.seriesNo}
                  onChange={handleSeriesNoChange}
                  readOnly={viewMode}
                />
                {errors.seriesNo && <p className="modal-error-msg">{errors.seriesNo}</p>}
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
                  readOnly={viewMode}
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

              {/* Payee Selection (col-span-2) */}
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

              {/* Particulars (col-span-2) */}
              <div className="modal-field md:col-span-2">
                <label className="modal-label">Particulars</label>
                <textarea
                  name="particulars"
                  placeholder="Enter document particulars..."
                  className="modal-textarea min-h-[5rem]"
                  value={formData.particulars}
                  onChange={handleParticularsChange}
                  readOnly={viewMode}
                />
              </div>

              {/* Remarks (View Mode Only) (col-span-2) */}
              {viewMode && editingDoc?.remarks && (
                <div className="modal-field md:col-span-2">
                  <label className="modal-label">Remarks</label>
                  <div className="modal-textarea !h-auto min-h-[5.5rem] bg-slate-50 border-slate-200">
                    {editingDoc.remarks}
                  </div>
                </div>
              )}

              {/* For Budget Personnel Only Section (col-span-2) */}
              <div className="md:col-span-2 mt-2 p-4 bg-sky-50/50 border border-sky-100/80 rounded-2xl">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#0b4c95] mb-3 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-[#0b4c95]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  For Budget Personnel Only
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Queue No */}
                  <div className="modal-field">
                    <label className="modal-label">Queue No.</label>
                    <input
                      type="text"
                      name="queueNo"
                      placeholder="e.g. Q-001"
                      className="modal-input"
                      value={formData.queueNo}
                      onChange={handleQueueNoChange}
                      readOnly={viewMode}
                    />
                  </div>

                  {/* Document Type Dropdown */}
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

                  {/* Time Received */}
                  <div className="modal-field">
                    <label className="modal-label">Time Received</label>
                    <select
                      name="time"
                      value={formData.time}
                      onChange={handleTimeChange}
                      className="modal-input modal-select"
                      disabled={viewMode}
                    >
                      <option value="">-</option>
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                      <option value="PM_Late">PM Late</option>
                    </select>
                  </div>

                  {/* Routed To */}
                  <div className="modal-field">
                    <label className="modal-label">Routed To</label>
                    <select
                      name="route"
                      value={formData.route}
                      onChange={handleRouteChange}
                      className="modal-input modal-select"
                      disabled={viewMode}
                    >
                      <option value="">Select Route</option>
                      {routes.map((r) => (
                        <option key={r.routeid} value={r.routename}>
                          {r.routename}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Custom Document Type Input (col-span-2 if active) */}
                  {showCustomDocType && !viewMode && (
                    <div className="md:col-span-2 p-3 bg-white border border-slate-100 rounded-xl space-y-2">
                      <label className="modal-label">Custom Document Type</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Enter new type"
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
                </div>
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
                                const label = FIELD_LABELS[field] || field;
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
          <button className="modal-cancel-btn" onClick={onClose}>
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

export default OverlayIncoming;
