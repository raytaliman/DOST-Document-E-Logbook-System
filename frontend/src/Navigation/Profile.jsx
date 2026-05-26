import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { FiUser, FiMail, FiLock, FiEye, FiEyeOff, FiEdit2, FiCheck, FiX, FiLayers } from 'react-icons/fi';
import '../index.css';

function Profile() {
  const [viewMode, setViewMode] = useState(true);
  const [formData, setFormData] = useState({
    adminname: '',
    adminemail: '',
    documentdirection: '',
    adminpass: '',
    confirmPass: ''
  });
  const [originalData, setOriginalData] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userType, setUserType] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL;

  // Load current user from localStorage
  useEffect(() => {
    const admin = JSON.parse(localStorage.getItem('admin'));
    if (admin) {
      const initialData = {
        adminname: admin.adminname || '',
        adminemail: admin.adminemail || '',
        documentdirection: admin.documentdirection || '',
        adminpass: '',
        confirmPass: ''
      };

      setFormData(initialData);
      setOriginalData({
        adminname: admin.adminname || '',
        adminemail: admin.adminemail || '',
        documentdirection: admin.documentdirection || ''
      });
      setUserType(admin.usertype || '');
    }
  }, []);

  // Handle Edit action
  const handleEdit = () => {
    setOriginalData({
      adminname: formData.adminname,
      adminemail: formData.adminemail,
      documentdirection: formData.documentdirection
    });
    setViewMode(false);
  };

  // Handle Cancel action
  const handleCancel = () => {
    setFormData(prev => ({
      ...prev,
      adminname: originalData.adminname,
      adminemail: originalData.adminemail,
      documentdirection: originalData.documentdirection,
      adminpass: '',
      confirmPass: ''
    }));
    setErrors({});
    setViewMode(true);
  };

  // Handle input changes
  const handleChange = (e) => {
    if (viewMode) return;
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.adminname.trim()) {
      newErrors.adminname = 'Name is required';
    }
    if ((formData.adminpass || formData.confirmPass) && formData.adminpass !== formData.confirmPass) {
      newErrors.confirmPass = 'Passwords do not match.';
    }
    return newErrors;
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);

    try {
      const admin = JSON.parse(localStorage.getItem('admin'));
      const payload = {
        adminname: formData.adminname.trim(),
        ...(userType !== 'superadmin' && { documentdirection: formData.documentdirection }),
        ...(formData.adminpass && { adminpass: formData.adminpass })
      };

      const response = await fetch(`${API_URL}/api/admins/${admin.adminid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const err = await response.json();
        setErrors({ submit: err.error || 'Failed to update profile.' });
        setIsSubmitting(false);
        Swal.fire({
          icon: 'error',
          title: 'Update Failed',
          text: err.error || 'Failed to update profile.',
          timer: 2500,
          showConfirmButton: false,
          customClass: { popup: 'swal2-minimalist' }
        });
        return;
      }

      const updated = await response.json();
      localStorage.setItem('admin', JSON.stringify({ ...admin, ...updated }));

      setViewMode(true);
      setFormData((prev) => ({
        ...prev,
        adminpass: '',
        confirmPass: ''
      }));
      Swal.fire({
        icon: 'success',
        title: 'Profile Updated',
        text: 'Your profile has been updated successfully.',
        timer: 1500,
        showConfirmButton: false,
        customClass: { popup: 'swal2-minimalist' }
      });
    } catch (err) {
      setErrors({ submit: 'Failed to update profile.' });
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to update profile.',
        timer: 2500,
        showConfirmButton: false,
        customClass: { popup: 'swal2-minimalist' }
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-[480px] max-w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8 flex flex-col gap-6 relative transition-all duration-300">
        
        {/* Title */}
        <div className="text-center">
          <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Admin Profile</h2>
          <p className="text-xs text-slate-400 mt-1">Manage your account details and security settings</p>
        </div>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit} id="profile-form">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Name</label>
            <div className={`relative flex items-center rounded-xl border transition-all duration-200 ${
              errors.adminname ? 'border-red-500 bg-red-50/10' : 'border-slate-200 bg-white focus-within:border-[#0b4c95] focus-within:ring-4 focus-within:ring-sky-500/10'
            } ${viewMode ? 'bg-slate-50/50' : ''}`}>
              <FiUser className="absolute left-4 text-slate-400 w-4 h-4" />
              <input
                type="text"
                name="adminname"
                placeholder="e.g. Juan Dela Cruz"
                className={`text-xs w-full h-11 pl-11 pr-4 bg-transparent outline-none text-slate-800 font-semibold ${viewMode ? 'text-slate-500 cursor-not-allowed' : ''}`}
                value={formData.adminname}
                onChange={handleChange}
                readOnly={viewMode}
              />
            </div>
            {errors.adminname && <p className="text-[10px] font-bold text-red-500 mt-1 px-1">{errors.adminname}</p>}
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Email Address</label>
            <div className="relative flex items-center rounded-xl border border-slate-200 bg-slate-50/50">
              <FiMail className="absolute left-4 text-slate-400 w-4 h-4" />
              <input
                type="text"
                name="adminemail"
                placeholder="e.g. jdelacruz@region1.dost.gov.ph"
                className="text-xs w-full h-11 pl-11 pr-4 bg-transparent outline-none text-slate-500 cursor-not-allowed font-semibold"
                value={formData.adminemail}
                readOnly
                autoComplete="off"
              />
            </div>
          </div>

          {/* Document Direction (hide if superadmin) */}
          {userType !== 'superadmin' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Document Direction</label>
              <div className="relative flex items-center rounded-xl border border-slate-200 bg-slate-50/50">
                <FiLayers className="absolute left-4 text-slate-400 w-4 h-4" />
                <select
                  name="documentdirection"
                  className="text-xs w-full h-11 pl-11 pr-10 bg-transparent outline-none text-slate-500 cursor-not-allowed font-semibold appearance-none"
                  value={formData.documentdirection}
                  disabled={true}
                  readOnly
                >
                  <option value="">Select Direction</option>
                  <option value="incoming">Incoming</option>
                  <option value="outgoing">Outgoing</option>
                </select>
              </div>
            </div>
          )}

          {/* Passwords - Only show/edit if editing */}
          {!viewMode && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">New Password</label>
                <div className={`relative flex items-center rounded-xl border transition-all duration-200 ${
                  errors.adminpass ? 'border-red-500 bg-red-50/10' : 'border-slate-200 bg-white focus-within:border-[#0b4c95] focus-within:ring-4 focus-within:ring-sky-500/10'
                }`}>
                  <FiLock className="absolute left-4 text-slate-400 w-4 h-4" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="adminpass"
                    placeholder="Enter new password (optional)"
                    className="text-xs w-full h-11 pl-11 pr-12 bg-transparent outline-none text-slate-800 font-semibold"
                    value={formData.adminpass}
                    onChange={handleChange}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-4 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.adminpass && <p className="text-[10px] font-bold text-red-500 mt-1 px-1">{errors.adminpass}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Confirm Password</label>
                <div className={`relative flex items-center rounded-xl border transition-all duration-200 ${
                  errors.confirmPass ? 'border-red-500 bg-red-50/10' : 'border-slate-200 bg-white focus-within:border-[#0b4c95] focus-within:ring-4 focus-within:ring-sky-500/10'
                }`}>
                  <FiLock className="absolute left-4 text-slate-400 w-4 h-4" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="confirmPass"
                    placeholder="Confirm new password"
                    className="text-xs w-full h-11 pl-11 pr-12 bg-transparent outline-none text-slate-800 font-semibold"
                    value={formData.confirmPass}
                    onChange={handleChange}
                    autoComplete="new-password"
                  />
                </div>
                {errors.confirmPass && <p className="text-[10px] font-bold text-red-500 mt-1 px-1">{errors.confirmPass}</p>}
              </div>
            </>
          )}
        </form>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          {!viewMode ? (
            <>
              <button
                type="button"
                className="bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl px-5 py-2.5 transition-all duration-200 cursor-pointer flex items-center gap-1.5 border border-slate-200/50"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                <FiX className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
              <button
                type="submit"
                form="profile-form"
                className="btn-dost-blue text-xs font-bold rounded-xl px-5 py-2.5 transition-all duration-200 cursor-pointer flex items-center gap-1.5 shadow-md shadow-sky-900/10"
                disabled={isSubmitting}
              >
                <FiCheck className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn-dost-blue text-xs font-bold rounded-xl px-5 py-2.5 transition-all duration-200 cursor-pointer flex items-center gap-1.5 shadow-md shadow-sky-900/10 hover:-translate-y-0.5"
              onClick={handleEdit}
              title="Edit Profile"
            >
              <FiEdit2 className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

export default Profile;