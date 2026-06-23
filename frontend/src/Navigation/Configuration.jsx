import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import moment from 'moment';
import { io } from 'socket.io-client';
import {
  FiPlus,
  FiTrash2,
  FiCalendar,
  FiInfo,
  FiSettings,
  FiClock,
  FiUsers,
  FiEdit2,
  FiNavigation,
  FiFileText,
} from 'react-icons/fi';
import '../index.css';

function Configuration() {
  const [activeTab, setActiveTab] = useState('holidays'); // 'holidays' | 'settings' | 'payees' | 'routes' | 'doctypes'
  const [holidays, setHolidays] = useState([]);
  const [newHoliday, setNewHoliday] = useState({ date: '', description: '' });
  const [officeHours, setOfficeHours] = useState('8');
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  
  // Payees state
  const [newPayee, setNewPayee] = useState('');
  const [payees, setPayees] = useState([]);

  // Routes state
  const [newRoute, setNewRoute] = useState('');
  const [routes, setRoutes] = useState([]);
  const [editingRoute, setEditingRoute] = useState(null);
  const [routePage, setRoutePage] = useState(1);
  const [routeRowsPerPage, setRouteRowsPerPage] = useState(5);

  // Document Types state
  const [newDocType, setNewDocType] = useState('');
  const [docTypes, setDocTypes] = useState([]);
  const [editingDocType, setEditingDocType] = useState(null);
  const [docTypePage, setDocTypePage] = useState(1);
  const [docTypeRowsPerPage, setDocTypeRowsPerPage] = useState(5);
  
  // Payees pagination
  const [payeePage, setPayeePage] = useState(1);
  const [payeeRowsPerPage, setPayeeRowsPerPage] = useState(5);

  // Holidays pagination
  const [holidayPage, setHolidayPage] = useState(1);
  const [holidayRowsPerPage, setHolidayRowsPerPage] = useState(5);

  // Edit target states
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [editingPayee, setEditingPayee] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL;

  const fetchHolidays = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/api/holidays`);
      if (response.ok) {
        const data = await response.json();
        setHolidays(data);
      }
    } catch (error) {
      console.error('Error fetching holidays:', error);
    } finally {
      setIsLoading(false);
    }
  }, [API_URL]);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/settings`);
      if (response.ok) {
        const data = await response.json();
        if (data.office_hours_per_day) {
          setOfficeHours(data.office_hours_per_day);
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  }, [API_URL]);

  const fetchPayees = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/api/payees`);
      if (response.ok) {
        const data = await response.json();
        setPayees(data);
      }
    } catch (error) {
      console.error('Error fetching payees:', error);
    } finally {
      setIsLoading(false);
    }
  }, [API_URL]);

  const fetchRoutes = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/api/routes`);
      if (response.ok) {
        const data = await response.json();
        setRoutes(data);
      }
    } catch (error) {
      console.error('Error fetching routes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [API_URL]);

  const fetchDocTypes = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/api/document-types`);
      if (response.ok) {
        const data = await response.json();
        setDocTypes(data);
      }
    } catch (error) {
      console.error('Error fetching document types:', error);
    } finally {
      setIsLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchHolidays();
    fetchSettings();
    fetchPayees();
    fetchRoutes();
    fetchDocTypes();
  }, [fetchHolidays, fetchSettings, fetchPayees, fetchRoutes, fetchDocTypes]);

  useEffect(() => {
    const socket = io(API_URL);
    socket.on('recalc_progress', ({ current, total }) => {
      if (Swal.isVisible()) {
        if (total > 0) {
          Swal.update({
            html: `<div className="text-center space-y-2">
              <p className="font-bold text-[#0b4c95] text-sm animate-pulse">Recalculating processed days...</p>
              <p className="text-xs font-semibold text-slate-500">Updating records ${current} of ${total}</p>
            </div>`,
            showConfirmButton: false
          });
        }
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [API_URL]);

  const handleAddHoliday = async (e) => {
    if (e) e.preventDefault();
    const description = newHoliday.description.trim();
    if (!newHoliday.date || !description) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Fields',
        text: 'Please provide both a date and a description.',
        customClass: { popup: 'swal2-minimalist' },
      });
      return;
    }

    const isEdit = !!editingHoliday;
    const url = isEdit
      ? `${API_URL}/api/holidays/${editingHoliday.holidayid}`
      : `${API_URL}/api/holidays`;
    const method = isEdit ? 'PUT' : 'POST';

    // Show initial loading Swal
    Swal.fire({
      title: isEdit ? 'Updating Non-Office Day...' : 'Saving Non-Office Day...',
      html: `<div className="text-center space-y-2">
        <p className="font-bold text-[#0b4c95] text-sm animate-pulse">Calculating affected documents...</p>
        <p className="text-xs font-semibold text-slate-400">Please wait...</p>
      </div>`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
      customClass: { popup: 'swal2-minimalist' },
    });

    try {
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holidaydate: newHoliday.date,
          holidayname: description,
        }),
      });
      if (res.ok) {
        setNewHoliday({ date: '', description: '' });
        setEditingHoliday(null);
        fetchHolidays();
        Swal.fire({
          icon: 'success',
          title: isEdit ? 'Non-Office Day Updated!' : 'Non-Office Day Added!',
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: 'swal2-minimalist' },
        });
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save non-office day');
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message,
        customClass: { popup: 'swal2-minimalist' },
      });
    }
  };

  const handleDeleteHoliday = async (id) => {
    // If deleting the holiday currently being edited, cancel edit
    if (editingHoliday && editingHoliday.holidayid === id) {
      setEditingHoliday(null);
      setNewHoliday({ date: '', description: '' });
    }

    const result = await Swal.fire({
      title: 'Remove Non-Office Day?',
      text: 'This date will no longer be excluded from calculations.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#0b4c95',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!',
      customClass: { popup: 'swal2-minimalist' },
    });

    if (result.isConfirmed) {
      // Show initial loading Swal
      Swal.fire({
        title: 'Removing Non-Office Day...',
        html: `<div className="text-center space-y-2">
          <p className="font-bold text-[#0b4c95] text-sm animate-pulse">Calculating affected documents...</p>
          <p className="text-xs font-semibold text-slate-400">Please wait...</p>
        </div>`,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        },
        customClass: { popup: 'swal2-minimalist' },
      });

      try {
        const res = await fetch(`${API_URL}/api/holidays/${id}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          fetchHolidays();
          Swal.fire({
            icon: 'success',
            title: 'Non-Office Day Removed!',
            timer: 1500,
            showConfirmButton: false,
            customClass: { popup: 'swal2-minimalist' },
          });
        } else {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to delete non-office day');
        }
      } catch (err) {
        console.error(err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err.message,
          customClass: { popup: 'swal2-minimalist' },
        });
      }
    }
  };

  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    const hours = parseInt(officeHours, 10);
    if (isNaN(hours) || hours < 1 || hours > 24) {
      Swal.fire({
        icon: 'warning',
        title: 'Invalid Input',
        text: 'Office hours per day must be a number between 1 and 24.',
        customClass: { popup: 'swal2-minimalist' },
      });
      return;
    }

    try {
      setIsSavingSettings(true);
      const res = await fetch(`${API_URL}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settingkey: 'office_hours_per_day',
          settingvalue: String(hours),
        }),
      });
      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: 'Settings Saved!',
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: 'swal2-minimalist' },
        });
        fetchSettings();
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save settings');
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message,
        customClass: { popup: 'swal2-minimalist' },
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleAddPayee = async (e) => {
    if (e) e.preventDefault();
    const name = newPayee.trim();
    if (!name) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Fields',
        text: 'Please provide a payee name.',
        customClass: { popup: 'swal2-minimalist' },
      });
      return;
    }

    const isEdit = !!editingPayee;
    const url = isEdit
      ? `${API_URL}/api/payees/${editingPayee.payeeid}`
      : `${API_URL}/api/payees`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payeename: name,
        }),
      });
      if (res.ok) {
        setNewPayee('');
        setEditingPayee(null);
        fetchPayees();
        Swal.fire({
          icon: 'success',
          title: isEdit ? 'Payee Updated!' : 'Payee Added!',
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: 'swal2-minimalist' },
        });
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save payee');
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message,
        customClass: { popup: 'swal2-minimalist' },
      });
    }
  };

  const handleDeletePayee = async (id) => {
    // If deleting the payee currently being edited, cancel edit
    if (editingPayee && editingPayee.payeeid === id) {
      setEditingPayee(null);
      setNewPayee('');
    }

    const result = await Swal.fire({
      title: 'Remove Payee?',
      text: 'Are you sure you want to remove this payee?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#0b4c95',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!',
      customClass: { popup: 'swal2-minimalist' },
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`${API_URL}/api/payees/${id}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          fetchPayees();
          Swal.fire({
            icon: 'success',
            title: 'Payee Removed!',
            timer: 1500,
            showConfirmButton: false,
            customClass: { popup: 'swal2-minimalist' },
          });
        } else {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to delete payee');
        }
      } catch (err) {
        console.error(err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err.message,
          customClass: { popup: 'swal2-minimalist' },
        });
      }
    }
  };

  const handleAddRoute = async (e) => {
    if (e) e.preventDefault();
    const name = newRoute.trim();
    if (!name) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Fields',
        text: 'Please provide a route name.',
        customClass: { popup: 'swal2-minimalist' },
      });
      return;
    }

    const isEdit = !!editingRoute;
    const url = isEdit
      ? `${API_URL}/api/routes/${editingRoute.routeid}`
      : `${API_URL}/api/routes`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routename: name }),
      });
      if (res.ok) {
        setNewRoute('');
        setEditingRoute(null);
        fetchRoutes();
        Swal.fire({
          icon: 'success',
          title: isEdit ? 'Route Updated!' : 'Route Added!',
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: 'swal2-minimalist' },
        });
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save route');
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message,
        customClass: { popup: 'swal2-minimalist' },
      });
    }
  };

  const handleDeleteRoute = async (id) => {
    if (editingRoute && editingRoute.routeid === id) {
      setEditingRoute(null);
      setNewRoute('');
    }
    const result = await Swal.fire({
      title: 'Remove Route?',
      text: 'Are you sure you want to remove this route?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#0b4c95',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!',
      customClass: { popup: 'swal2-minimalist' },
    });
    if (result.isConfirmed) {
      try {
        const res = await fetch(`${API_URL}/api/routes/${id}`, { method: 'DELETE' });
        if (res.ok) {
          fetchRoutes();
          Swal.fire({
            icon: 'success',
            title: 'Route Removed!',
            timer: 1500,
            showConfirmButton: false,
            customClass: { popup: 'swal2-minimalist' },
          });
        } else {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to delete route');
        }
      } catch (err) {
        console.error(err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err.message,
          customClass: { popup: 'swal2-minimalist' },
        });
      }
    }
  };

  const handleAddDocType = async (e) => {
    if (e) e.preventDefault();
    const name = newDocType.trim();
    if (!name) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Fields',
        text: 'Please provide a document type name.',
        customClass: { popup: 'swal2-minimalist' },
      });
      return;
    }
    const isEdit = !!editingDocType;
    const url = isEdit
      ? `${API_URL}/api/document-types/${editingDocType.documentid}`
      : `${API_URL}/api/document-types`;
    const method = isEdit ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documenttype: name }),
      });
      if (res.ok) {
        setNewDocType('');
        setEditingDocType(null);
        fetchDocTypes();
        Swal.fire({
          icon: 'success',
          title: isEdit ? 'Document Type Updated!' : 'Document Type Added!',
          timer: 1500,
          showConfirmButton: false,
          customClass: { popup: 'swal2-minimalist' },
        });
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save document type');
      }
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message,
        customClass: { popup: 'swal2-minimalist' },
      });
    }
  };

  const handleDeleteDocType = async (id) => {
    if (editingDocType && editingDocType.documentid === id) {
      setEditingDocType(null);
      setNewDocType('');
    }
    const result = await Swal.fire({
      title: 'Remove Document Type?',
      text: 'Are you sure you want to remove this document type?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#0b4c95',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!',
      customClass: { popup: 'swal2-minimalist' },
    });
    if (result.isConfirmed) {
      try {
        const res = await fetch(`${API_URL}/api/document-types/${id}`, { method: 'DELETE' });
        if (res.ok) {
          fetchDocTypes();
          Swal.fire({
            icon: 'success',
            title: 'Document Type Removed!',
            timer: 1500,
            showConfirmButton: false,
            customClass: { popup: 'swal2-minimalist' },
          });
        } else {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to delete document type');
        }
      } catch (err) {
        console.error(err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err.message,
          customClass: { popup: 'swal2-minimalist' },
        });
      }
    }
  };

  return (
    <div className="p-4 space-y-6 animate-in fade-in duration-500">
      {/* Title Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-xl shadow-2xs border border-slate-100">
            <FiSettings className="w-5 h-5 text-[#0b4c95]" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">
            Configuration Settings
          </h1>
        </div>
        <p className="text-xs text-slate-400 font-medium ml-11">
          Manage system-wide exclusions, office standards, and document payees.
        </p>
      </div>

      {/* Modern Tabs Navigation */}
      <div className="border-b border-slate-200">
        <div className="flex gap-8">
          <button
            onClick={() => {
              setActiveTab('holidays');
              setEditingHoliday(null);
              setNewHoliday({ date: '', description: '' });
            }}
            className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'holidays'
                ? 'border-[#0b4c95] text-[#0b4c95]'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <FiCalendar className="w-4 h-4" />
            Non-Office Days
          </button>

          <button
            onClick={() => {
              setActiveTab('payees');
              setEditingPayee(null);
              setNewPayee('');
            }}
            className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'payees'
                ? 'border-[#0b4c95] text-[#0b4c95]'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <FiUsers className="w-4 h-4" />
            Payees
          </button>
          <button
            onClick={() => {
              setActiveTab('routes');
              setEditingRoute(null);
              setNewRoute('');
            }}
            className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'routes'
                ? 'border-[#0b4c95] text-[#0b4c95]'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <FiNavigation className="w-4 h-4" />
            Routes
          </button>
          <button
            onClick={() => {
              setActiveTab('doctypes');
              setEditingDocType(null);
              setNewDocType('');
            }}
            className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'doctypes'
                ? 'border-[#0b4c95] text-[#0b4c95]'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <FiFileText className="w-4 h-4" />
            Document Types
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'holidays' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
            {/* Form Column */}
            <div className="lg:col-span-4 space-y-4">
              <div className="card-premium overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                  <FiCalendar className="w-4 h-4 text-[#0b4c95]" />
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {editingHoliday ? 'Edit Non-Office Day' : 'Add Non-Office Day'}
                  </h3>
                </div>
                <form onSubmit={handleAddHoliday} className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                      Date
                    </label>
                    <input
                      type="date"
                      className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:border-[#0b4c95] focus:ring-4 focus:ring-sky-500/5 outline-none transition-all"
                      value={newHoliday.date}
                      onChange={(e) =>
                        setNewHoliday({ ...newHoliday, date: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                      Non-Office Day Name / Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Christmas Day or Special Non-Working Day"
                      className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:border-[#0b4c95] focus:ring-4 focus:ring-sky-500/5 outline-none transition-all"
                      value={newHoliday.description}
                      onChange={(e) =>
                        setNewHoliday({
                          ...newHoliday,
                          description: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="p-3 bg-sky-50 rounded-xl flex gap-2 border border-sky-100">
                    <FiInfo className="w-4 h-4 text-[#0b4c95] flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] leading-relaxed text-sky-700 font-semibold italic">
                      Excluding dates will automatically adjust the "Net Days" in
                      processing reports.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <button
                      type="submit"
                      className="w-full h-12 btn-dost-blue text-white font-bold text-xs rounded-xl shadow-md shadow-sky-900/10 flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                    >
                      <FiPlus className="w-5 h-5" />
                      <span>{editingHoliday ? 'Update Non-Office Day' : 'Save Non-Office Day'}</span>
                    </button>
                    {editingHoliday && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingHoliday(null);
                          setNewHoliday({ date: '', description: '' });
                        }}
                        className="w-full h-11 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl flex items-center justify-center transition-all cursor-pointer"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            {/* List Column */}
            <div className="lg:col-span-8 space-y-4">
              <div className="table-container-premium shadow-sm overflow-hidden">
                <table className="table-premium table-premium-compact w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-xs font-bold text-slate-700">Effective Date</th>
                      <th className="px-6 py-3 text-xs font-bold text-slate-700">Description</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-slate-700">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoading ? (
                      <tr>
                        <td
                          colSpan="3"
                          className="text-center py-10 text-slate-400 font-bold italic text-xs"
                        >
                          Loading schedule...
                        </td>
                      </tr>
                    ) : holidays.slice((holidayPage - 1) * holidayRowsPerPage, holidayPage * holidayRowsPerPage).length > 0 ? (
                      holidays.slice((holidayPage - 1) * holidayRowsPerPage, holidayPage * holidayRowsPerPage).map((h) => (
                        <tr key={h.holidayid}>
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2">
                              <FiClock className="text-slate-300 w-3.5 h-3.5" />
                              <span className="text-xs font-bold text-[#0b4c95]">
                                {moment(h.holidaydate).format('MMMM D, YYYY')}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-xs font-semibold text-slate-600">
                            {h.holidayname}
                          </td>
                          <td className="px-6 py-3 text-center">
                            <button
                              onClick={() => {
                                setEditingHoliday(h);
                                setNewHoliday({
                                  date: moment(h.holidaydate).format('YYYY-MM-DD'),
                                  description: h.holidayname,
                                });
                              }}
                              title="Edit Non-Office Day"
                              className="p-1.5 text-[#0b4c95] hover:bg-sky-50 rounded-lg transition-colors cursor-pointer mr-1"
                            >
                              <FiEdit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteHoliday(h.holidayid)}
                              title="Delete Non-Office Day"
                              className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <FiTrash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="3"
                          className="text-center py-10 text-slate-400 text-xs font-medium italic"
                        >
                          No scheduled non-office days found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Holiday Pagination */}
              {holidays.length > 0 && (
                <div className="flex items-center justify-between px-2 py-1 text-[11px]">
                  <div className="text-slate-400 font-medium">
                    Showing {((holidayPage - 1) * holidayRowsPerPage) + 1} to {Math.min(holidayPage * holidayRowsPerPage, holidays.length)} of {holidays.length} non-office days
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      className="h-8 px-2 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 outline-none"
                      value={holidayRowsPerPage}
                      onChange={(e) => {
                        setHolidayRowsPerPage(Number(e.target.value));
                        setHolidayPage(1);
                      }}
                    >
                      <option value={5}>5 / page</option>
                      <option value={10}>10 / page</option>
                      <option value={20}>20 / page</option>
                    </select>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setHolidayPage(prev => Math.max(prev - 1, 1))}
                        disabled={holidayPage === 1}
                        className="h-8 px-2.5 rounded-lg border border-slate-200 font-bold hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Prev
                      </button>
                      <span className="px-2 font-bold text-slate-600">
                        {holidayPage} / {Math.ceil(holidays.length / holidayRowsPerPage)}
                      </span>
                      <button
                        onClick={() => setHolidayPage(prev => Math.min(prev + 1, Math.ceil(holidays.length / holidayRowsPerPage)))}
                        disabled={holidayPage === Math.ceil(holidays.length / holidayRowsPerPage)}
                        className="h-8 px-2.5 rounded-lg border border-slate-200 font-bold hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}



        {activeTab === 'payees' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
            {/* Form Column */}
            <div className="lg:col-span-4 space-y-4">
              <div className="card-premium overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                  <FiUsers className="w-4 h-4 text-[#0b4c95]" />
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {editingPayee ? 'Edit Payee' : 'Add Payee'}
                  </h3>
                </div>
                <form onSubmit={handleAddPayee} className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                      Payee Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. DOST-CO"
                      className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:border-[#0b4c95] focus:ring-4 focus:ring-sky-500/5 outline-none transition-all"
                      value={newPayee}
                      onChange={(e) => setNewPayee(e.target.value)}
                      required
                    />
                  </div>
                  <div className="p-3 bg-sky-50 rounded-xl flex gap-2 border border-sky-100">
                    <FiInfo className="w-4 h-4 text-[#0b4c95] flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] leading-relaxed text-sky-700 font-semibold italic">
                      Configure payees or external offices that submit documents for logging.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <button
                      type="submit"
                      className="w-full h-12 btn-dost-blue text-white font-bold text-xs rounded-xl shadow-md shadow-sky-900/10 flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                    >
                      <FiPlus className="w-5 h-5" />
                      <span>{editingPayee ? 'Update Payee' : 'Save Payee'}</span>
                    </button>
                    {editingPayee && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPayee(null);
                          setNewPayee('');
                        }}
                        className="w-full h-11 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl flex items-center justify-center transition-all cursor-pointer"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            {/* List Column */}
            <div className="lg:col-span-8 space-y-4">
              <div className="table-container-premium shadow-sm overflow-hidden">
                <table className="table-premium table-premium-compact w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-xs font-bold text-slate-700">Payee Name</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-slate-700">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoading ? (
                      <tr>
                        <td
                          colSpan="2"
                          className="text-center py-10 text-slate-400 font-bold italic text-xs"
                        >
                          Loading payees...
                        </td>
                      </tr>
                    ) : payees.slice((payeePage - 1) * payeeRowsPerPage, payeePage * payeeRowsPerPage).length > 0 ? (
                      payees.slice((payeePage - 1) * payeeRowsPerPage, payeePage * payeeRowsPerPage).map((p) => (
                        <tr key={p.payeeid}>
                          <td className="px-6 py-3 text-xs font-semibold">
                            <span className="font-bold text-[#0b4c95]">
                              {p.payeename}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-center">
                            <button
                              onClick={() => {
                                setEditingPayee(p);
                                setNewPayee(p.payeename);
                              }}
                              title="Edit Payee"
                              className="p-1.5 text-[#0b4c95] hover:bg-sky-50 rounded-lg transition-colors cursor-pointer mr-1"
                            >
                              <FiEdit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePayee(p.payeeid)}
                              title="Delete Payee"
                              className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <FiTrash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="2"
                          className="text-center py-10 text-slate-400 text-xs font-medium italic"
                        >
                          No payees found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Payee Pagination */}
              {payees.length > 0 && (
                <div className="flex items-center justify-between px-2 py-1 text-[11px]">
                  <div className="text-slate-400 font-medium">
                    Showing {((payeePage - 1) * payeeRowsPerPage) + 1} to {Math.min(payeePage * payeeRowsPerPage, payees.length)} of {payees.length} payees
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      className="h-8 px-2 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 outline-none"
                      value={payeeRowsPerPage}
                      onChange={(e) => {
                        setPayeeRowsPerPage(Number(e.target.value));
                        setPayeePage(1);
                      }}
                    >
                      <option value={5}>5 / page</option>
                      <option value={10}>10 / page</option>
                      <option value={20}>20 / page</option>
                    </select>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPayeePage(prev => Math.max(prev - 1, 1))}
                        disabled={payeePage === 1}
                        className="h-8 px-2.5 rounded-lg border border-slate-200 font-bold hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Prev
                      </button>
                      <span className="px-2 font-bold text-slate-600">
                        {payeePage} / {Math.ceil(payees.length / payeeRowsPerPage)}
                      </span>
                      <button
                        onClick={() => setPayeePage(prev => Math.min(prev + 1, Math.ceil(payees.length / payeeRowsPerPage)))}
                        disabled={payeePage === Math.ceil(payees.length / payeeRowsPerPage)}
                        className="h-8 px-2.5 rounded-lg border border-slate-200 font-bold hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'routes' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
            {/* Form Column */}
            <div className="lg:col-span-4 space-y-4">
              <div className="card-premium overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                  <FiNavigation className="w-4 h-4 text-[#0b4c95]" />
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {editingRoute ? 'Edit Route' : 'Add Route'}
                  </h3>
                </div>
                <form onSubmit={handleAddRoute} className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                      Route Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Regional Director"
                      className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:border-[#0b4c95] focus:ring-4 focus:ring-sky-500/5 outline-none transition-all"
                      value={newRoute}
                      onChange={(e) => setNewRoute(e.target.value)}
                      required
                    />
                  </div>
                  <div className="p-3 bg-sky-50 rounded-xl flex gap-2 border border-sky-100">
                    <FiInfo className="w-4 h-4 text-[#0b4c95] flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] leading-relaxed text-sky-700 font-semibold italic">
                      Routes defined here will appear as options in the document routing dropdown.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <button
                      type="submit"
                      className="w-full h-12 btn-dost-blue text-white font-bold text-xs rounded-xl shadow-md shadow-sky-900/10 flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                    >
                      <FiPlus className="w-5 h-5" />
                      <span>{editingRoute ? 'Update Route' : 'Save Route'}</span>
                    </button>
                    {editingRoute && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRoute(null);
                          setNewRoute('');
                        }}
                        className="w-full h-11 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl flex items-center justify-center transition-all cursor-pointer"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            {/* List Column */}
            <div className="lg:col-span-8 space-y-4">
              <div className="table-container-premium shadow-sm overflow-hidden">
                <table className="table-premium table-premium-compact w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-xs font-bold text-slate-700">Route Name</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-slate-700">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoading ? (
                      <tr>
                        <td colSpan="2" className="text-center py-10 text-slate-400 font-bold italic text-xs">
                          Loading routes...
                        </td>
                      </tr>
                    ) : routes.slice((routePage - 1) * routeRowsPerPage, routePage * routeRowsPerPage).length > 0 ? (
                      routes.slice((routePage - 1) * routeRowsPerPage, routePage * routeRowsPerPage).map((r) => (
                        <tr key={r.routeid}>
                          <td className="px-6 py-3 text-xs font-semibold">
                            <span className="font-bold text-[#0b4c95]">{r.routename}</span>
                          </td>
                          <td className="px-6 py-3 text-center">
                            <button
                              onClick={() => {
                                setEditingRoute(r);
                                setNewRoute(r.routename);
                              }}
                              title="Edit Route"
                              className="p-1.5 text-[#0b4c95] hover:bg-sky-50 rounded-lg transition-colors cursor-pointer mr-1"
                            >
                              <FiEdit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteRoute(r.routeid)}
                              title="Delete Route"
                              className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <FiTrash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="2" className="text-center py-10 text-slate-400 text-xs font-medium italic">
                          No routes found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Route Pagination */}
              {routes.length > 0 && (
                <div className="flex items-center justify-between px-2 py-1 text-[11px]">
                  <div className="text-slate-400 font-medium">
                    Showing {((routePage - 1) * routeRowsPerPage) + 1} to {Math.min(routePage * routeRowsPerPage, routes.length)} of {routes.length} routes
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      className="h-8 px-2 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 outline-none"
                      value={routeRowsPerPage}
                      onChange={(e) => {
                        setRouteRowsPerPage(Number(e.target.value));
                        setRoutePage(1);
                      }}
                    >
                      <option value={5}>5 / page</option>
                      <option value={10}>10 / page</option>
                      <option value={20}>20 / page</option>
                    </select>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setRoutePage(prev => Math.max(prev - 1, 1))}
                        disabled={routePage === 1}
                        className="h-8 px-2.5 rounded-lg border border-slate-200 font-bold hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Prev
                      </button>
                      <span className="px-2 font-bold text-slate-600">
                        {routePage} / {Math.ceil(routes.length / routeRowsPerPage)}
                      </span>
                      <button
                        onClick={() => setRoutePage(prev => Math.min(prev + 1, Math.ceil(routes.length / routeRowsPerPage)))}
                        disabled={routePage === Math.ceil(routes.length / routeRowsPerPage)}
                        className="h-8 px-2.5 rounded-lg border border-slate-200 font-bold hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'doctypes' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-300">
            {/* Form Column */}
            <div className="lg:col-span-4 space-y-4">
              <div className="card-premium overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                  <FiFileText className="w-4 h-4 text-[#0b4c95]" />
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    {editingDocType ? 'Edit Document Type' : 'Add Document Type'}
                  </h3>
                </div>
                <form onSubmit={handleAddDocType} className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                      Document Type Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Disbursement Voucher"
                      className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:border-[#0b4c95] focus:ring-4 focus:ring-sky-500/5 outline-none transition-all"
                      value={newDocType}
                      onChange={(e) => setNewDocType(e.target.value)}
                      required
                    />
                  </div>
                  <div className="p-3 bg-sky-50 rounded-xl flex gap-2 border border-sky-100">
                    <FiInfo className="w-4 h-4 text-[#0b4c95] flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] leading-relaxed text-sky-700 font-semibold italic">
                      Document types defined here will appear as options in the document type dropdown.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <button
                      type="submit"
                      className="w-full h-12 btn-dost-blue text-white font-bold text-xs rounded-xl shadow-md shadow-sky-900/10 flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                    >
                      <FiPlus className="w-5 h-5" />
                      <span>{editingDocType ? 'Update Document Type' : 'Save Document Type'}</span>
                    </button>
                    {editingDocType && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDocType(null);
                          setNewDocType('');
                        }}
                        className="w-full h-11 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl flex items-center justify-center transition-all cursor-pointer"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>

            {/* List Column */}
            <div className="lg:col-span-8 space-y-4">
              <div className="table-container-premium shadow-sm overflow-hidden">
                <table className="table-premium table-premium-compact w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-xs font-bold text-slate-700">Document Type</th>
                      <th className="px-6 py-3 text-center text-xs font-bold text-slate-700">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isLoading ? (
                      <tr>
                        <td colSpan="2" className="text-center py-10 text-slate-400 font-bold italic text-xs">
                          Loading document types...
                        </td>
                      </tr>
                    ) : docTypes.slice((docTypePage - 1) * docTypeRowsPerPage, docTypePage * docTypeRowsPerPage).length > 0 ? (
                      docTypes.slice((docTypePage - 1) * docTypeRowsPerPage, docTypePage * docTypeRowsPerPage).map((d) => (
                        <tr key={d.documentid}>
                          <td className="px-6 py-3 text-xs font-semibold">
                            <span className="font-bold text-[#0b4c95]">{d.documenttype}</span>
                          </td>
                          <td className="px-6 py-3 text-center">
                            <button
                              onClick={() => {
                                setEditingDocType(d);
                                setNewDocType(d.documenttype);
                              }}
                              title="Edit Document Type"
                              className="p-1.5 text-[#0b4c95] hover:bg-sky-50 rounded-lg transition-colors cursor-pointer mr-1"
                            >
                              <FiEdit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDocType(d.documentid)}
                              title="Delete Document Type"
                              className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <FiTrash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="2" className="text-center py-10 text-slate-400 text-xs font-medium italic">
                          No document types found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Document Type Pagination */}
              {docTypes.length > 0 && (
                <div className="flex items-center justify-between px-2 py-1 text-[11px]">
                  <div className="text-slate-400 font-medium">
                    Showing {((docTypePage - 1) * docTypeRowsPerPage) + 1} to {Math.min(docTypePage * docTypeRowsPerPage, docTypes.length)} of {docTypes.length} document types
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      className="h-8 px-2 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 outline-none"
                      value={docTypeRowsPerPage}
                      onChange={(e) => {
                        setDocTypeRowsPerPage(Number(e.target.value));
                        setDocTypePage(1);
                      }}
                    >
                      <option value={5}>5 / page</option>
                      <option value={10}>10 / page</option>
                      <option value={20}>20 / page</option>
                    </select>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setDocTypePage(prev => Math.max(prev - 1, 1))}
                        disabled={docTypePage === 1}
                        className="h-8 px-2.5 rounded-lg border border-slate-200 font-bold hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Prev
                      </button>
                      <span className="px-2 font-bold text-slate-600">
                        {docTypePage} / {Math.ceil(docTypes.length / docTypeRowsPerPage)}
                      </span>
                      <button
                        onClick={() => setDocTypePage(prev => Math.min(prev + 1, Math.ceil(docTypes.length / docTypeRowsPerPage)))}
                        disabled={docTypePage === Math.ceil(docTypes.length / docTypeRowsPerPage)}
                        className="h-8 px-2.5 rounded-lg border border-slate-200 font-bold hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Configuration;
