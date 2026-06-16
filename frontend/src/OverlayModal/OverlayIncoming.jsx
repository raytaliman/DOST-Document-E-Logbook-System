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
  const [showCustomDocType, setShowCustomDocType] = useState(false);
  const [customDocType, setCustomDocType] = useState('');
  const [selectedDocType, setSelectedDocType] = useState('');
  const [formData, setFormData] = useState({ dtsNo: '', seriesNo: '', particulars: '', queueNo: '', processedBy: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [auditTrail, setAuditTrail] = useState([]);
  const [showAudit, setShowAudit] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL;

  // Initialize form data when editing/prefill
  useEffect(() => {
    if (editingDoc) {
      setFormData({
        dtsNo: editingDoc.dtsno || editingDoc.dtsNo || '',
        seriesNo: editingDoc.seriesNo || editingDoc.seriesno || '',
        particulars: editingDoc.particulars || '',
        queueNo: editingDoc.queueNo || editingDoc.queueno || '',
        processedBy: editingDoc.processedby || editingDoc.processedBy || '-',
      });
      // Apply case-insensitive lookup if documentTypes is already loaded
      const matched = documentTypes.find(
        (t) => t.documenttype.toLowerCase() === (editingDoc.documenttype || '').toLowerCase()
      );
      setSelectedDocType(matched ? matched.documenttype : (editingDoc.documenttype || ''));
      setShowCustomDocType(false);
    } else {
      setFormData({ dtsNo: '', seriesNo: '', particulars: '', queueNo: '', processedBy: '' });
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
    return String(val);
  };

  // Removed payees fetcher

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
    if (!selectedDocType) newErrors.documentType = 'Document type is required.';

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
      const admin = JSON.parse(localStorage.getItem('admin') || '{}');
      const documentData = {
        dtsno: formData.dtsNo.trim().toUpperCase(),
        seriesno: formData.seriesNo?.trim() || null,
        particulars: formData.particulars?.trim() || null,
        queueno: formData.queueNo?.trim() || null,
        documenttype: selectedDocType.trim(),
        documentdirection: 'incoming',
        processedby: admin.adminname || null,
        payee: null,
        amount: null,
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

      onClose(true);
      if (onSuccess) onSuccess();
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
        <div className="modal-header-bar green px-6 py-5 flex items-start justify-between flex-shrink-0">
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

              {/* Document Type Dropdown */}
              <div className="modal-field">
                <label className="modal-label">
                  Document Type <span className="req">*</span>
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

              {/* Custom Document Type Input (col-span-2 if active) */}
              {showCustomDocType && !viewMode && (
                <div className="md:col-span-2 p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
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
                  <span className="text-[10px] font-extrabold bg-emerald-600 text-white px-2 py-0.5 rounded-full">{auditTrail.length}</span>
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
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                boxShadow: '0 4px 12px rgba(5,150,105,0.25)',
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
