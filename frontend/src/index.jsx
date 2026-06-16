import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './Login.jsx';
import Layout from './Layout/Layout.jsx';

// Lazy-loaded components
const Dashboard = lazy(() => import('./Navigation/Dashboard.jsx'));
const AllDocuments = lazy(() => import('./Navigation/AllDocuments.jsx'));
const ArchiveDocuments = lazy(() => import('./Navigation/ArchiveDocuments.jsx'));
const NetworkDays = lazy(() => import('./Navigation/ProcessingDays.jsx'));
const ManageAdmin = lazy(() => import('./Navigation/ManageAdmin.jsx'));
const ArchiveAdmin = lazy(() => import('./Navigation/ArchiveAdmin.jsx'));
const Profile = lazy(() => import('./Navigation/Profile.jsx'));
const Configuration = lazy(() => import('./Navigation/Configuration.jsx'));

function Index() {
  return (
    <Router>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen bg-slate-50/50">
          <div className="flex flex-col items-center gap-3">
            <svg className="animate-spin h-10 w-10 text-[#0b4c95]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">Loading records...</span>
          </div>
        </div>
      }>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/" element={<Layout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="alldocuments" element={<AllDocuments />} />
            <Route path="processingdays" element={<NetworkDays />} />
            <Route path="archivedocuments" element={<ArchiveDocuments />} />
            <Route path="manageadmin" element={<ManageAdmin />} />
            <Route path="archiveadmin" element={<ArchiveAdmin />} />
            <Route path="profile" element={<Profile />} />
            <Route path="configuration" element={<Configuration />} />
          </Route>
        </Routes>
      </Suspense>
    </Router>
  );
}

export default Index;
