import React, { useState, useEffect } from 'react';
import OverlayAdmin from '../OverlayModal/OverlayAdmin';
import Swal from 'sweetalert2';
import { FiEye, FiEdit2, FiArchive, FiPlus, FiSearch, FiRotateCcw, FiTrash2, FiUsers } from 'react-icons/fi';
import '../index.css';

function ManageAdmin() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [archivingId, setArchivingId] = useState(null);
  const adminData = localStorage.getItem('admin');
  const currentAdmin = adminData ? JSON.parse(adminData) : null;
  const currentAdminDirection = currentAdmin ? currentAdmin.documentdirection : null;
  const currentAdminId = currentAdmin ? currentAdmin.adminid : null;
  const API_URL = import.meta.env.VITE_API_URL;
  const getUnit = (direction) => {
    const dir = direction?.toLowerCase();
    if (dir === 'incoming') return 'ORD (Office of the Regional Director)';
    if (dir === 'outgoing') return 'Budget and Finance Unit';
    if (dir === 'all') return 'ITSM (Information Technology Services Management)';
    return 'General Administration';
  };

  // Fetch admins
  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/admins`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      // Filter to show all users except the current logged-in user
      const filteredAdmins = data.filter(admin => admin.adminid !== currentAdminId);
      setAdmins(filteredAdmins);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching admins:', error);
      setLoading(false);
      Swal.fire({
        icon: 'error',
        title: 'Failed to Load Admins',
        text: 'Please try again.',
        timer: 2500,
        showConfirmButton: false,
        customClass: {
          popup: 'swal2-minimalist'
        }
      });
    }
  };

  const fetchArchivedAdmins = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/admins/archived`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      // Filter out the current logged-in user if they are archived
      const filteredAdmins = data.filter(admin => admin.adminid !== currentAdminId);
      setAdmins(filteredAdmins);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching archived admins:', error);
      setLoading(false);
      Swal.fire({
        icon: 'error',
        title: 'Failed to Load Archived Users',
        text: 'Please try again.',
        timer: 2500,
        showConfirmButton: false,
        customClass: { popup: 'swal2-minimalist' }
      });
    }
  };

  useEffect(() => {
    if (showArchived) {
      fetchArchivedAdmins();
    } else {
      fetchAdmins();
    }
  }, [showArchived]);

  // Restore user
  const handleRestore = async (adminId) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to restore this user?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, restore it!',
      cancelButtonText: 'Cancel',
      customClass: {
        popup: 'swal2-minimalist'
      }
    });
    if (!result.isConfirmed) return;
    try {
      const response = await fetch(`${API_URL}/api/admins/${adminId}/restore`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isarchive: false })
      });
      if (response.ok) {
        setAdmins(admins.filter(admin => admin.adminid !== adminId));
        Swal.fire({
          icon: 'success',
          title: 'Restored Successfully',
          text: 'User has been restored.',
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
          title: 'Failed to Restore',
          text: error.message || 'Failed to restore user. Please try again.',
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
        text: error.message || 'An error occurred while restoring. Please try again.',
        timer: 2500,
        showConfirmButton: false,
        customClass: {
          popup: 'swal2-minimalist'
        }
      });
    }
  };

  // Delete user permanently
  const handleDelete = async (adminId) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'This will permanently delete the user from the database. This action cannot be undone!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
      customClass: {
        popup: 'swal2-minimalist'
      }
    }); 
    
    if (!result.isConfirmed) return;
    
    try {
      const response = await fetch(`${API_URL}/api/admins/${adminId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });
  
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(text || 'Failed to delete user');
      }
  
      const data = await response.json();
  
      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete user');
      }
  
      setAdmins(admins.filter(admin => admin.adminid !== adminId));
      Swal.fire({
        icon: 'success',
        title: 'Permanently Deleted',
        text: 'User has been permanently deleted.',
        timer: 1800,
        showConfirmButton: false,
        customClass: {
          popup: 'swal2-minimalist'
        }
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message.includes('<!DOCTYPE html>') 
          ? 'Server error occurred' 
          : error.message || 'An error occurred while deleting. Please try again.',
        timer: 2500,
        showConfirmButton: false,
        customClass: {
          popup: 'swal2-minimalist'
        }
      });
    }
  };

  const handleAddRecord = () => {
    setSelectedAdmin(null);
    setIsViewMode(false);
    setIsEditMode(false);
    setShowAdminModal(true);
  };

  const handleView = (admin) => {
    setSelectedAdmin(admin);
    setIsViewMode(false);
    setIsEditMode(true);
    setShowAdminModal(true);
  };

  const handleArchive = async (adminId) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to archive this admin?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, archive it!',
      cancelButtonText: 'Cancel',
      customClass: {
        popup: 'swal2-minimalist'
      }
    });
    if (!result.isConfirmed) return;

    setArchivingId(adminId);
    try {
      const archivedate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const response = await fetch(`${API_URL}/api/admins/${adminId}/archive`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isarchive: true,
          archivedate
        })
      });

      if (response.ok) {
        setAdmins(prev => prev.filter(admin => admin.adminid !== adminId));
        Swal.fire({
          icon: 'success',
          title: 'Archived Successfully',
          text: 'Admin has been archived.',
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
          text: error.message || 'Failed to archive admin. Please try again.',
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

  const filteredAdmins = admins.filter(admin => {
    const search = searchTerm.toLowerCase();
    const unit = getUnit(admin.documentdirection)?.toLowerCase();
    const direction = admin.documentdirection?.toLowerCase();
    const matchesSearch =
      admin.adminname?.toLowerCase().includes(search) ||
      admin.adminemail?.toLowerCase().includes(search) ||
      unit?.includes(search) ||
      direction?.includes(search);
    return matchesSearch;
  });

  return (
    <div className="p-2 space-y-6">
      {/* Header Panel with Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">
            {showArchived ? 'Archived Users' : 'Manage Users'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {showArchived
              ? 'Review, restore, or permanently delete archived user accounts'
              : 'Create, view, and configure user permissions'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search bar */}
          <div className="relative w-80 h-10 bg-white border border-slate-200/80 rounded-xl shadow-2xs flex items-center px-3.5 focus-within:border-[#0b4c95] focus-within:ring-4 focus-within:ring-sky-500/10 transition-all duration-200">
            <FiSearch className="text-slate-400 w-4 h-4 mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder={showArchived ? 'Search archived users...' : 'Search by name, email, or unit...'}
              className="w-full bg-transparent outline-none text-slate-700 placeholder:text-slate-400 text-xs font-semibold"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Toggle Active/Archived Button */}
          <button
            onClick={() => setShowArchived(prev => !prev)}
            className={`px-4 h-10 rounded-xl flex items-center justify-center gap-2 text-xs font-bold border transition-all duration-200 cursor-pointer hover:-translate-y-0.5 ${
              showArchived
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
            }`}
            title={showArchived ? 'View active users' : 'View archived users'}
          >
            {showArchived ? <FiUsers className="w-4 h-4" /> : <FiArchive className="w-4 h-4" />}
            <span>{showArchived ? 'Active Users' : 'Archived Users'}</span>
          </button>

          {/* Add User Button */}
          {!showArchived && (
            <button
              onClick={handleAddRecord}
              className="btn-dost-blue px-4 h-10 rounded-xl flex items-center justify-center gap-2 text-xs font-bold shadow-md shadow-sky-900/15 cursor-pointer hover:-translate-y-0.5"
            >
              <FiPlus className="w-4 h-4" />
              <span>Add User</span>
            </button>
          )}
        </div>
      </div>

      {/* User Table Container */}
      <div className="table-container-premium shadow-2xs">
        <div className="overflow-x-auto">
          <table className="table-premium w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="w-[15%] text-center">Date Created</th>
                <th className="w-[20%]">User Name</th>
                <th className="w-[25%]">Email</th>
                <th className={showArchived ? "w-[15%]" : "w-[30%]"}>Unit</th>
                {showArchived && (
                  <>
                    <th className="w-[10%] text-center">Direction</th>
                    <th className="w-[15%] text-center">Archive Date</th>
                  </>
                )}
                <th className="w-[10%] text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={showArchived ? 7 : 5} className="text-center py-10 text-slate-400 font-semibold">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-sky-700" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>{showArchived ? 'Loading archived records...' : 'Loading user records...'}</span>
                    </div>
                  </td>
                </tr>
              ) : filteredAdmins.length > 0 ? (
                filteredAdmins.map((admin) => {
                  const direction = admin.documentdirection?.toLowerCase();
                  let directionBadgeClass = "bg-slate-50 text-slate-600 border-slate-200";
                  if (direction === 'incoming') {
                    directionBadgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200/50";
                  } else if (direction === 'outgoing') {
                    directionBadgeClass = "bg-pink-50 text-pink-700 border-pink-200/50";
                  }

                  const isArchiveDisabled =
                    archivingId === admin.adminid ||
                    (currentAdminDirection === 'incoming' && direction !== 'incoming') ||
                    (currentAdminDirection === 'outgoing' && direction !== 'outgoing');

                  return (
                    <tr key={admin.adminid}>
                      <td className="text-center font-medium text-slate-500 text-xs">
                        {admin.datecreated ? new Date(admin.datecreated).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        }) : '-'}
                      </td>
                      <td className="font-extrabold text-slate-800 text-xs">{admin.adminname}</td>
                      <td className="text-slate-600 font-medium text-xs">{admin.adminemail}</td>
                      <td className="text-slate-500 font-semibold text-xs">{getUnit(admin.documentdirection)}</td>
                      {showArchived && (
                        <>
                          <td className="text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${directionBadgeClass}`}>
                              {admin.documentdirection}
                            </span>
                          </td>
                          <td className="text-center text-slate-500 font-semibold text-xs">
                            {admin.archivedate || '-'}
                          </td>
                        </>
                      )}
                      <td>
                        <div className="flex items-center justify-center gap-1.5">
                          {!showArchived ? (
                            <>
                              <button
                                onClick={() => handleView(admin)}
                                className="p-2 text-sky-600 hover:bg-sky-50 border border-sky-100 rounded-lg transition-colors cursor-pointer"
                                title="View/Edit Details"
                              >
                                <FiEye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleArchive(admin.adminid)}
                                className={`p-2 rounded-lg transition-colors cursor-pointer border ${isArchiveDisabled
                                    ? 'opacity-40 cursor-not-allowed text-slate-400 border-slate-100'
                                    : 'text-pink-600 hover:bg-pink-50 border-pink-100'
                                  }`}
                                title={isArchiveDisabled ? "Action restricted" : "Archive User"}
                                disabled={isArchiveDisabled}
                              >
                                {archivingId === admin.adminid ? (
                                  <svg className="w-3.5 h-3.5 animate-spin text-pink-600" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                  </svg>
                                ) : (
                                  <FiArchive className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleRestore(admin.adminid)}
                                className={`p-2 rounded-lg transition-colors cursor-pointer border ${
                                  isArchiveDisabled
                                    ? 'opacity-40 cursor-not-allowed text-slate-400 border-slate-100'
                                    : 'text-[#0b4c95] hover:bg-sky-50 border-sky-100'
                                }`}
                                title={isArchiveDisabled ? "Action restricted" : "Restore User"}
                                disabled={isArchiveDisabled}
                              >
                                <FiRotateCcw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(admin.adminid)}
                                className={`p-2 rounded-lg transition-colors cursor-pointer border ${
                                  isArchiveDisabled
                                    ? 'opacity-40 cursor-not-allowed text-slate-400 border-slate-100'
                                    : 'text-pink-600 hover:bg-pink-50 border-pink-100'
                                }`}
                                title={isArchiveDisabled ? "Action restricted" : "Delete Permanently"}
                                disabled={isArchiveDisabled}
                              >
                                <FiTrash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={showArchived ? 7 : 5} className="text-center py-16 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FiSearch className="w-8 h-8 opacity-30" />
                      <p className="text-sm font-semibold">{showArchived ? 'No archived records found' : 'No users found'}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Modal */}
      {showAdminModal && (
        <OverlayAdmin
          isOpen={showAdminModal}
          onClose={(refresh) => {
            setShowAdminModal(false);
            if (refresh) {
              if (showArchived) {
                fetchArchivedAdmins();
              } else {
                fetchAdmins();
              }
            }
          }}
          editingDoc={selectedAdmin}
          viewMode={isViewMode}
          editMode={isEditMode}
        />
      )}
    </div>
  );
}

export default ManageAdmin;