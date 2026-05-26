import { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import '../index.css';

function OverlayAdmin({ isOpen, onClose, editingDoc, viewMode, editMode }) {
  const popupRef = useRef(null);
  const [formData, setFormData] = useState({
    adminname: '',
    adminemail: '',
    documentdirection: '',
    usertype: 'admin',
    adminpass: '',
    confirmPass: ''
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL;
  const adminData = localStorage.getItem('admin');
  const currentUser = adminData ? JSON.parse(adminData) : null;
  const isSuperAdmin = currentUser?.usertype === 'superadmin';

  useEffect(() => {
    if (editingDoc) {
      setFormData({
        adminname: editingDoc.adminname || '',
        adminemail: editingDoc.adminemail || '',
        documentdirection: editingDoc.documentdirection || '',
        usertype: editingDoc.usertype || 'admin',
        adminpass: '',
        confirmPass: ''
      });
      setShowPassword(false);
    } else {
      setFormData({
        adminname: '',
        adminemail: '',
        documentdirection: '',
        usertype: 'admin',
        adminpass: 'd0stregi0n1',
        confirmPass: 'd0stregi0n1'
      });
      setShowPassword(true);
    }
  }, [editingDoc]);

  useEffect(() => {
    if (isSuperAdmin) {
      if (formData.usertype === 'superadmin') {
        setFormData(prev => ({ ...prev, documentdirection: 'all' }));
      } else if (formData.usertype === 'admin' && formData.documentdirection === 'all') {
        setFormData(prev => ({ ...prev, documentdirection: '' }));
      }
    }
  }, [formData.usertype, isSuperAdmin]);

  const handleChange = (e) => {
    if (viewMode) return;
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDirectionChange = (e) => {
    setFormData(prev => ({ ...prev, documentdirection: e.target.value }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.adminname.trim()) newErrors.adminname = 'Name is required.';
    if (!formData.adminemail.trim()) newErrors.adminemail = 'Email is required.';
    if (!/^([a-zA-Z0-9._-]+)@region1\.dost\.gov\.ph$/i.test(formData.adminemail.trim().toLowerCase())) {
      newErrors.adminemail = 'Incorrect domain. Use @region1.dost.gov.ph';
    }
    if (editingDoc && !formData.documentdirection && formData.usertype === 'admin') newErrors.documentdirection = 'Direction is required.';
    if (isSuperAdmin && !formData.usertype) newErrors.usertype = 'User type is required.';
    if (!editingDoc) {
      if (!formData.adminpass) newErrors.adminpass = 'Password is required.';
      if (!formData.confirmPass) newErrors.confirmPass = 'Confirm password is required.';
      if (formData.adminpass && formData.confirmPass && formData.adminpass !== formData.confirmPass) {
        newErrors.confirmPass = 'Passwords do not match.';
      }
    } else {
      if ((formData.adminpass || formData.confirmPass) && formData.adminpass !== formData.confirmPass) {
        newErrors.confirmPass = 'Passwords do not match.';
      }
    }
    return newErrors;
  };

  const handleSubmit = async () => {
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);

    try {
      const payload = {
        adminname: formData.adminname.trim(),
        adminemail: formData.adminemail.trim(),
        documentdirection: formData.documentdirection,
        ...(!viewMode && { adminpass: formData.adminpass }),
        ...(isSuperAdmin && { usertype: formData.usertype })
      };

      const checkRes = await fetch(`${API_URL}/api/admins`);
      const admins = await checkRes.json();
      const isDuplicate = admins.some(
        (a) => a.adminemail.toLowerCase() === payload.adminemail.toLowerCase() &&
              (!editingDoc || a.adminid !== editingDoc.adminid)
      );

      if (isDuplicate) {
        setErrors({ adminemail: 'Email already exists.' });
        setIsSubmitting(false);
        return;
      }

      let response;
      if (editingDoc) {
        response = await fetch(`${API_URL}/api/admins/${editingDoc.adminid}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch(`${API_URL}/api/admins`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!response.ok) {
        const err = await response.json();
        setErrors({ submit: err.error?.replace('username', 'email') || 'Failed to save admin.' });
        setIsSubmitting(false);
        Swal.fire({ icon: 'error', title: 'Error', text: err.error?.replace('username', 'email') || 'Failed to save admin.', timer: 2500, showConfirmButton: false, customClass: { popup: 'swal2-minimalist' } });
        return;
      }

      onClose(true);
      Swal.fire({ icon: 'success', title: editingDoc ? 'Updated!' : 'Added!', text: editingDoc ? 'Admin updated successfully.' : 'Admin added successfully.', timer: 1500, showConfirmButton: false, customClass: { popup: 'swal2-minimalist' } });
    } catch (err) {
      setErrors({ submit: 'Failed to save admin.' });
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to save admin.', timer: 2500, showConfirmButton: false, customClass: { popup: 'swal2-minimalist' } });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isOpen) return;
      if (event.key === 'Enter' && !viewMode && !isSubmitting) { event.preventDefault(); handleSubmit(); }
      else if (event.key === 'Escape') { event.preventDefault(); onClose(false); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, viewMode, isSubmitting, onClose, handleSubmit]);

  if (!isOpen) return null;

  const modeLabel = viewMode ? 'View Admin' : editMode ? 'Edit Admin' : 'Add New Admin';
  const modeSubtitle = viewMode ? 'Administrator profile details' : editMode ? 'Update admin account credentials' : 'Create a new administrator account';

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
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-0.5">Administration</p>
            <h2 className="text-lg font-extrabold text-white tracking-tight">{modeLabel}</h2>
            <p className="text-[11px] text-white/60 font-medium mt-0.5">{modeSubtitle}</p>
          </div>
          <button
            onClick={() => onClose(false)}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer mt-0.5 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[70vh] scrollbar-hide">

          {/* Name */}
          <div className="modal-field">
            <label className="modal-label">Full Name <span className="req">*</span></label>
            <input
              type="text"
              name="adminname"
              placeholder="e.g. Juan Dela Cruz"
              className={`modal-input ${errors.adminname ? 'error' : ''}`}
              value={formData.adminname}
              onChange={handleChange}
              readOnly={viewMode}
            />
            {errors.adminname && <p className="modal-error-msg">{errors.adminname}</p>}
          </div>

          {/* Email */}
          <div className="modal-field">
            <label className="modal-label">Email Address <span className="req">*</span></label>
            <input
              type="text"
              name="adminemail"
              placeholder="e.g. jdelacruz@region1.dost.gov.ph"
              className={`modal-input ${errors.adminemail ? 'error' : ''}`}
              value={formData.adminemail}
              onChange={handleChange}
              readOnly={viewMode}
              autoComplete="off"
            />
            {errors.adminemail && <p className="modal-error-msg">{errors.adminemail}</p>}
          </div>

          {/* User Type (superadmin only) */}
          {isSuperAdmin && (
            <div className="modal-field">
              <label className="modal-label">User Type <span className="req">*</span></label>
              <select
                name="usertype"
                className={`modal-input modal-select ${errors.usertype ? 'error' : ''}`}
                value={formData.usertype}
                onChange={handleChange}
                disabled={viewMode}
              >
                <option value="admin">Admin</option>
                <option value="superadmin">Superadmin</option>
              </select>
              {errors.usertype && <p className="modal-error-msg">{errors.usertype}</p>}
            </div>
          )}

          {/* Document Direction */}
          {formData.usertype === 'admin' && editingDoc && (
            <div className="modal-field">
              <label className="modal-label">Document Direction <span className="req">*</span></label>
              <select
                name="documentdirection"
                className={`modal-input modal-select ${errors.documentdirection ? 'error' : ''}`}
                value={formData.documentdirection}
                onChange={handleDirectionChange}
                disabled={viewMode}
              >
                <option value="">Select Direction</option>
                <option value="incoming">Incoming</option>
                <option value="outgoing">Outgoing</option>
              </select>
              {errors.documentdirection && <p className="modal-error-msg">{errors.documentdirection}</p>}
            </div>
          )}

          {/* Password fields */}
          {!viewMode && (
            <>
              <div className="pt-1 border-t border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-3 mb-3">
                  {editMode ? 'Update Password (optional)' : 'Set Password'}
                </p>
              </div>

              <div className="modal-field">
                <label className="modal-label">
                  {editMode ? 'New Password' : 'Password'} {!editMode && <span className="req">*</span>}
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="adminpass"
                  placeholder={editMode ? 'Leave blank to keep current' : 'Enter password'}
                  className={`modal-input ${errors.adminpass ? 'error' : ''}`}
                  value={formData.adminpass}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
                {errors.adminpass && <p className="modal-error-msg">{errors.adminpass}</p>}
              </div>

              <div className="modal-field">
                <label className="modal-label">
                  Confirm {editMode ? 'New ' : ''}Password {!editMode && <span className="req">*</span>}
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPass"
                  placeholder={`Confirm ${editMode ? 'new ' : ''}password`}
                  className={`modal-input ${errors.confirmPass ? 'error' : ''}`}
                  value={formData.confirmPass}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
                {errors.confirmPass && <p className="modal-error-msg">{errors.confirmPass}</p>}
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 accent-[#0b4c95] cursor-pointer"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />
                <span className="text-xs font-semibold text-slate-500">Show Password</span>
              </label>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex items-center justify-end gap-3 flex-shrink-0">
          <button className="modal-cancel-btn" onClick={() => onClose(false)}>
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
              ) : editMode ? 'Save Changes' : 'Create Admin'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default OverlayAdmin;