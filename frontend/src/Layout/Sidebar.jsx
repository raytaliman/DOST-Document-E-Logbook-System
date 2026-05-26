import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FiGrid,
  FiFileText,
  FiCalendar,
  FiArchive,
  FiUsers,
  FiUser,
  FiLogOut,
  FiChevronRight,
  FiChevronLeft
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [userType, setUserType] = useState('admin');
  const [collapsed, setCollapsed] = useState(false);
  const [unitName, setUnitName] = useState('');
  const [isHovering, setIsHovering] = useState(false);

  const isActive = (path) => location.pathname === path;

  useEffect(() => {
    const fetchAdminData = () => {
      try {
        const storedAdmin = localStorage.getItem('admin');

        if (!storedAdmin) {
          console.warn('No admin data found in localStorage');
          return;
        }

        const admin = JSON.parse(storedAdmin);

        if (!admin || typeof admin !== 'object') {
          throw new Error('Invalid admin data format');
        }

        if (!admin.documentdirection) {
          console.warn('Admin object is missing documentdirection property');
          console.log('Full admin object:', admin);
          return;
        }

        const docType = admin.documentdirection.toString().toLowerCase().trim();
        console.log(docType);
        switch (docType) {
          case 'all':
            setUnitName("ITSM");
            setUserType('superadmin');
            break;
          case 'incoming':
            setUnitName("Office of Regional Director (ORD)");
            setUserType('admin');
            break;
          case 'outgoing':
            setUnitName("Budget and Finance");
            setUserType('admin');
            break;
          default:
            console.warn('Unknown document type:', docType);
            setUserType('admin');
        }
      } catch (error) {
        console.error('Error parsing admin data:', error);
        setUserType('admin');
      }
    };

    fetchAdminData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('admin');
    navigate('/');
  };

  const toggleCollapse = () => {
    setCollapsed(!collapsed);
  };

  return (
    <motion.div
      initial={{ width: 220 }}
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ type: 'spring', damping: 20 }}
      className="h-screen text-white flex flex-col relative border-r border-white/5 shadow-2xl"
      style={{ background: 'var(--sidebar-gradient)' }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Collapse/Expand button */}
      <motion.button
        onClick={toggleCollapse}
        whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.1)' }}
        whileTap={{ scale: 0.95 }}
        className="absolute right-2 top-2 p-1.5 rounded-xl hover:bg-white/5 z-10 cursor-pointer text-white/80 transition-colors"
        title={collapsed ? "Expand" : "Collapse"}
      >
        {collapsed ? (
          <FiChevronRight className="h-5 w-5" stroke="currentColor" />
        ) : (
          <FiChevronLeft className="h-5 w-5" stroke="currentColor" />
        )}
      </motion.button>

      {/* Top section - department name */}
      <motion.div
        className="text-center py-3 px-3 text-xs font-extrabold tracking-wider mt-12 mb-4 overflow-hidden border-y border-white/10 uppercase"
        style={{ background: 'rgba(255, 255, 255, 0.04)' }}
        initial={{ opacity: 1 }}
        animate={{ opacity: collapsed ? 0 : 1 }}
        transition={{ duration: 0.2 }}
      >
        BUDTRACK
      </motion.div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <nav className="px-2 py-4 space-y-1">
          {/* Common routes for both user types */}
          <SidebarLink
            to="/dashboard"
            label="Dashboard"
            icon={<FiGrid stroke="currentColor" />}
            collapsed={collapsed}
          />
          <SidebarLink
            to="/alldocuments"
            label="All Documents"
            icon={<FiFileText stroke="currentColor" />}
            collapsed={collapsed}
          />
          <SidebarLink
            to="/processingdays"
            label="Processing Days"
            icon={<FiCalendar stroke="currentColor" />}
            collapsed={collapsed}
          />
          <SidebarLink
            to="/archivedocuments"
            label="Archive Documents"
            icon={<FiArchive stroke="currentColor" />}
            collapsed={collapsed}
          />

          {/* Superadmin only route */}
          {userType === 'superadmin' && (
            <>
              <SidebarLink
                to="/manageadmin"
                label="Manage Admin"
                icon={<FiUsers stroke="currentColor" />}
                collapsed={collapsed}
              />
              <SidebarLink
                to="/archiveadmin"
                label="Archive Admin"
                icon={<FiArchive stroke="currentColor" />}
                collapsed={collapsed}
              />
            </>
          )}
        </nav>
      </div>

      {/* Bottom section - profile and logout */}
      <div className={`px-2 py-4 space-y-1 border-t border-white/10 sticky bottom-0 ${collapsed ? 'text-center' : ''}`} style={{ background: 'rgba(7, 52, 103, 0.95)' }}>
        <SidebarLink
          to="/profile"
          label="Profile"
          icon={<FiUser stroke="currentColor" />}
          collapsed={collapsed}
        />
        <motion.button
          onClick={handleLogout}
          whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
          whileTap={{ scale: 0.98 }}
          className={`flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer w-full text-white/80 hover:text-white transition-colors ${collapsed ? 'justify-center' : 'text-left'
            }`}
        >
          <SidebarIcon icon={<FiLogOut stroke="currentColor" />} />
          {!collapsed && (
            <motion.span
              initial={{ opacity: 1 }}
              animate={{ opacity: collapsed ? 0 : 1 }}
              className="text-xs font-semibold tracking-wide"
            >
              Logout
            </motion.span>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}

function SidebarLink({ to, label, icon, collapsed }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link to={to}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 cursor-pointer ${isActive
          ? 'bg-white/10 text-white border-l-4 border-[#c2185b] font-bold shadow-inner'
          : 'text-white/70 hover:text-white hover:bg-white/5'
          } ${collapsed ? 'justify-center' : ''}`}
        title={collapsed ? label : ''}
      >
        <SidebarIcon icon={icon} />
        {!collapsed && (
          <motion.span
            initial={{ opacity: 1 }}
            animate={{ opacity: collapsed ? 0 : 1 }}
            className="text-xs font-semibold tracking-wide"
          >
            {label}
          </motion.span>
        )}
      </motion.div>
    </Link>
  );
}

function SidebarIcon({ icon }) {
  return (
    <motion.div
      className="w-5 h-5 flex items-center justify-center"
      whileHover={{ scale: 1.1 }}
    >
      {icon}
    </motion.div>
  );
}

export default Sidebar;