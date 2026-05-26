import { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import '../index.css';

function OverlayIncoming({ isOpen, onClose, editingDoc, viewMode, editMode, onSuccess }) {
  const popupRef = useRef(null);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [showCustomDocType, setShowCustomDocType] = useState(false);
  const [customDocType, setCustomDocType] = useState('');
  const [selectedDocType, setSelectedDocType] = useState('');
  const [formData, setFormData] = useState({ dtsNo: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const API_URL = import.meta.env.VITE_API_URL;

  // Initialize form data when editing/prefill
  useEffect(() => {
    if (editingDoc) {
      setFormData({ dtsNo: editingDoc.dtsno || '' });
      setSelectedDocType(editingDoc.documenttype || '');
      setShowCustomDocType(false);
    } else {
      setFormData({ dtsNo: '' });
      setSelectedDocType('');
      setShowCustomDocType(false);
      setErrors({});
    }
  }, [editingDoc, isOpen]);

  // Fetch document types when overlay opens
  useEffect(() => {
    const fetchDocumentTypes = async () => {
      try {
        const response = await fetch(`${API_URL}/api/document-types`);
        const data = await response.json();
        setDocumentTypes(data);
      } catch (error) {
        console.error('Error fetching document types:', error);
      }
    };
    if (isOpen) fetchDocumentTypes();
  }, [isOpen, API_URL]);

  const handleDtsNoChange = (e) => {
    if (viewMode) return;
    const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    setFormData({ ...formData, dtsNo: value });
    if (errors.dtsNo) setErrors((prev) => ({ ...prev, dtsNo: '' }));
  };

  const handleDocTypeChange = (e) => {
    if (viewMode) return;
    const value = e.target.value;
    setSelectedDocType(value);
    setShowCustomDocType(value === 'Others');
    if (errors.documentType) setErrors((prev) => ({ ...prev, documentType: '' }));
  };

  const handleAddOrRemoveDocType = async (action) => {
    if (!customDocType.trim()) {
      Swal.fire({ icon: 'warning', title: 'Input required', text: 'Please enter a document type.', timer: 1800, showConfirmButton: false, customClass: { popup: 'swal2-minimalist' } });
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
          Swal.fire({ icon: 'success', title: 'Added!', text: 'Document type added.', timer: 1500, showConfirmButton: false, customClass: { popup: 'swal2-minimalist' } });
        } else {
          throw new Error('Failed to add document type');
        }
      } else if (action === 'remove') {
        const match = documentTypes.find(dt => dt.documenttype === typeName);
        if (!match) {
          Swal.fire({ icon: 'info', title: 'Not found', text: 'Document type not found.', timer: 1800, showConfirmButton: false, customClass: { popup: 'swal2-minimalist' } });
          return;
        }

        const response = await fetch(`${API_URL}/api/document-types/${match.documentid}`, { method: 'DELETE' });

        if (response.ok) {
          setDocumentTypes(documentTypes.filter(dt => dt.documentid !== match.documentid));
          if (selectedDocType === match.documenttype) setSelectedDocType('');
          setShowCustomDocType(false);
          setCustomDocType('');
          Swal.fire({ icon: 'success', title: 'Removed!', text: 'Document type removed.', timer: 1500, showConfirmButton: false, customClass: { popup: 'swal2-minimalist' } });
        } else {
          throw new Error('Failed to delete document type');
        }
      }
    } catch (error) {
      console.error('Document type operation failed:', error);
      Swal.fire({ icon: 'error', title: 'Error', text: error.message, timer: 2500, showConfirmButton: false, customClass: { popup: 'swal2-minimalist' } });
    }
  };

  const handleSubmit = async () => {
    const newErrors = {};
    if (!formData.dtsNo) newErrors.dtsNo = 'DTS No. is required.';
    if (!selectedDocType) newErrors.documentType = 'Document type is required.';

    if (!newErrors.dtsNo && (!editingDoc || formData.dtsNo !== editingDoc.dtsno)) {
      try {
        const dtsNoToCheck = formData.dtsNo.trim().toUpperCase();
        const response = await fetch(`${API_URL}/api/incoming`);
        if (response.ok) {
          const docs = await response.json();
          const exists = docs.some(
            doc => (doc.dtsno?.toUpperCase() === dtsNoToCheck && doc.documenttype === selectedDocType && doc.documentid !== (editingDoc?.documentid || 0) && doc.isarchive === false)
          );
          if (exists) {
            newErrors.dtsNo = 'A document with this DTS No. and document type already exists.';
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
      const documentData = {
        dtsno: formData.dtsNo.trim().toUpperCase(),
        documenttype: selectedDocType.trim(),
        documentdirection: 'incoming',
        ...(editingDoc ? {} : (() => {
          const now = new Date();
          const pad = (n) => n.toString().padStart(2, '0');
          return { datesent: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:00` };
        })())
      };

      const url = editingDoc ? `${API_URL}/api/incoming/${editingDoc.documentid}` : `${API_URL}/api/incoming`;
      const method = editingDoc ? "PUT" : "POST";
      const response = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(documentData),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to save record");

      onClose(true); 
      if (onSuccess) onSuccess();
      Swal.fire({ icon: 'success', title: editingDoc ? 'Updated!' : 'Added!', text: editingDoc ? 'Document updated successfully.' : 'Document added successfully.', timer: 1500, showConfirmButton: false, customClass: { popup: 'swal2-minimalist' } });
    } catch (err) {
      console.error("Submission error:", err);
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, timer: 2500, showConfirmButton: false, customClass: { popup: 'swal2-minimalist' } });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isOpen) return;
      if (event.key === 'Enter' && !viewMode && !isSubmitting) { event.preventDefault(); handleSubmit(); }
      else if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, viewMode, isSubmitting, onClose, handleSubmit]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-slate-900/50 backdrop-blur-sm p-4 modal-backdrop">
      <div
        ref={popupRef}
        className="modal-panel w-full max-w-[460px] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="modal-header-bar px-6 py-5 flex items-start justify-between flex-shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-0.5">Incoming Document</p>
            <h2 className="text-lg font-extrabold text-white tracking-tight">
              {viewMode ? 'View Document' : editMode ? 'Edit Document' : 'New Incoming Record'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer mt-0.5 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[70vh] scrollbar-hide">
          
          {/* DTS No */}
          <div className="modal-field">
            <label className="modal-label">DTS No. <span className="req">*</span></label>
            <input
              type="text"
              name="dtsNo"
              placeholder="e.g. ORD1070"
              className={`modal-input uppercase ${errors.dtsNo ? 'error' : ''}`}
              value={formData.dtsNo}
              onChange={handleDtsNoChange}
              onKeyPress={(e) => { if (!/[a-zA-Z0-9]/.test(e.key)) e.preventDefault(); }}
              readOnly={viewMode}
            />
            {errors.dtsNo && <p className="modal-error-msg">{errors.dtsNo}</p>}
          </div>

          {/* Document Type Dropdown */}
          <div className="modal-field">
            <label className="modal-label">Document Type <span className="req">*</span></label>
            <select
              className={`modal-input modal-select ${errors.documentType ? 'error' : ''}`}
              value={selectedDocType}
              onChange={handleDocTypeChange}
              disabled={viewMode}
            >
              <option value="">Select Document Type</option>
              {documentTypes.map((type) => (
                <option key={type.documentid} value={type.documenttype}>
                  {type.documenttype}
                </option>
              ))}
              <option value="Others">Others...</option>
            </select>
            {errors.documentType && <p className="modal-error-msg">{errors.documentType}</p>}
          </div>

          {/* Custom Document Type Input */}
          {showCustomDocType && !viewMode && (
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
              <label className="modal-label">Custom Document Type</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Enter new type"
                  className={`modal-input flex-1 !h-10 ${errors.customDocType ? 'error' : ''}`}
                  value={customDocType}
                  onChange={(e) => { setCustomDocType(e.target.value); setErrors((prev) => ({ ...prev, customDocType: '' })); }}
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
              {errors.customDocType && <p className="modal-error-msg">{errors.customDocType}</p>}
            </div>
          )}

          {/* Remarks (View Mode Only) */}
          {viewMode && editingDoc?.remarks && (
            <div className="modal-field">
              <label className="modal-label">Remarks</label>
              <div className="modal-textarea !h-auto min-h-[5.5rem] bg-slate-50 border-slate-200">
                {editingDoc.remarks}
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
              className="modal-submit-btn"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Saving...
                </>
              ) : editMode ? 'Save Changes' : 'Submit Record'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default OverlayIncoming;