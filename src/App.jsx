import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Header from './components/Header';
import SummaryCards from './components/SummaryCards';
import Toolbar from './components/Toolbar';
import RecordCard from './components/RecordCard';
import RecordFormModal from './components/RecordFormModal';
import ImportExportModal from './components/ImportExportModal';
import UserManagementModal from './components/UserManagementModal';
import ProfileModal from './components/ProfileModal';
import LoginModal from './components/LoginModal';
import Toast from './components/Toast';
import { api } from './services/api';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Default to 'All' to mix Branch and ATM on home dashboard by default
  const [kind, setKind] = useState('All');
  const [records, setRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ownershipFilter, setOwnershipFilter] = useState('all');
  const [activeView, setActiveView] = useState('my-pending');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState(null);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isUserMgmtOpen, setIsUserMgmtOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);

  // Toast state
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Check auth session on startup
  useEffect(() => {
    const verifySession = async () => {
      try {
        const session = await api.getCurrentUser();
        if (session && session.user) {
          setCurrentUser(session.user);
          setDbStatus(session.database);
        }
      } catch (err) {
        // Not logged in
      } finally {
        setIsAuthChecking(false);
      }
    };
    verifySession();
  }, []);

  // Roles determination
  const userRole = (currentUser?.role || 'noc').toLowerCase();
  const isAdmin = userRole === 'admin' || (currentUser?.username || '').toLowerCase().includes('admin');
  const isPM = userRole === 'pm';
  const canManageUsers = isAdmin || isPM;

  // Fetch users list (for assignment dropdown & user management)
  const loadUsers = useCallback(async () => {
    if (!currentUser) return;
    try {
      const uRole = (currentUser.role || '').toLowerCase();
      const uName = (currentUser.username || '').toLowerCase();
      if (uRole === 'admin' || uRole === 'pm' || uName.includes('admin')) {
        const uList = await api.getUsers();
        setUsers(uList || []);
      } else {
        setUsers([{ id: currentUser.id, username: currentUser.username, name: currentUser.name }]);
      }
    } catch {
      setUsers([{ id: currentUser.id, username: currentUser.username, name: currentUser.name }]);
    }
  }, [currentUser]);

  // Fetch records
  const loadData = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const res = await api.getRecords();
      setRecords(res.data || []);
      const stats = await api.getStats();
      if (stats?.database) {
        setDbStatus({ type: stats.database.includes('PostgreSQL') ? 'postgresql' : 'memory' });
      }
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') {
        setCurrentUser(null);
        showToast('Session expired. Please sign in again.', 'error');
      } else {
        showToast('Error loading records: ' + err.message, 'error');
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, showToast]);

  useEffect(() => {
    if (currentUser) {
      loadData();
      loadUsers();
    }
  }, [currentUser, loadData, loadUsers]);

  // Set default primary view based on role
  useEffect(() => {
    if (currentUser) {
      const uRole = (currentUser.role || '').toLowerCase();
      setActiveView(uRole === 'noc' ? 'my-pending' : 'all');
    }
  }, [currentUser?.username, currentUser?.role]);

  // Auth Handlers
  const handleLoginSuccess = async (username, password) => {
    const res = await api.login(username, password);
    setCurrentUser(res.user);
    showToast(`Welcome back, ${res.user.name || res.user.username}!`);
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setRecords([]);
    showToast('Signed out successfully.');
  };

  // Counts
  const branchRecords = useMemo(() => records.filter(r => r.kind === 'Branch'), [records]);
  const atmRecords = useMemo(() => records.filter(r => r.kind === 'ATM'), [records]);
  const currentKindRecords = useMemo(() => {
    if (kind === 'Branch') return branchRecords;
    if (kind === 'ATM') return atmRecords;
    return records; // 'All' sites mixed
  }, [kind, branchRecords, atmRecords, records]);

  // Dynamic KPI Status Statistics (Total, Completed, Pending, On Hold, Failed)
  const statusStats = useMemo(() => {
    let completed = 0;
    let pending = 0;
    let onHold = 0;
    let failed = 0;

    currentKindRecords.forEach(r => {
      const st = r.deploymentStatus || (r.working === 'Yes' ? 'Completed' : (r.working === 'No' ? 'Failed' : 'Pending'));
      if (st === 'Completed') completed++;
      else if (st === 'On Hold') onHold++;
      else if (st === 'Failed') failed++;
      else pending++;
    });

    return {
      total: currentKindRecords.length,
      completed,
      pending,
      onHold,
      failed
    };
  }, [currentKindRecords]);

  // View counts for Primary Navigation Tabs
  const viewCounts = useMemo(() => {
    const curUname = (currentUser?.username || '').toLowerCase();
    let myPending = 0;
    let completed = 0;
    let unassignedPending = 0;

    currentKindRecords.forEach(r => {
      const recStatus = r.deploymentStatus || (r.working === 'Yes' ? 'Completed' : (r.working === 'No' ? 'Failed' : 'Pending'));
      const isOwner = (r.claimedBy || '').toLowerCase() === curUname;
      const isUnclaimed = !r.claimedBy || r.claimedBy.trim() === '';

      if (isOwner && recStatus !== 'Completed') {
        myPending++;
      }

      if (recStatus === 'Completed') {
        if (isAdmin || isPM) {
          completed++;
        } else if (isOwner) {
          completed++;
        }
      }

      if (isUnclaimed && recStatus === 'Pending') {
        unassignedPending++;
      }
    });

    return {
      myPending,
      completed,
      unassignedPending,
      all: currentKindRecords.length
    };
  }, [currentKindRecords, currentUser, isAdmin, isPM]);

  // Filtered displayed records
  const displayedRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    const curUname = (currentUser?.username || '').toLowerCase();

    return currentKindRecords.filter(r => {
      const recStatus = r.deploymentStatus || (r.working === 'Yes' ? 'Completed' : (r.working === 'No' ? 'Failed' : 'Pending'));
      const isOwner = (r.claimedBy || '').toLowerCase() === curUname;
      const isUnclaimed = !r.claimedBy || r.claimedBy.trim() === '';

      // If search query is entered, search across currentKindRecords regardless of active tab
      if (q) {
        const str = JSON.stringify(r).toLowerCase();
        return str.includes(q);
      }

      // Tab View Filtering
      if (activeView === 'my-pending') {
        return isOwner && recStatus !== 'Completed';
      }

      if (activeView === 'completed') {
        if (isAdmin || isPM) {
          return recStatus === 'Completed';
        }
        return isOwner && recStatus === 'Completed';
      }

      if (activeView === 'unassigned') {
        return isUnclaimed && recStatus === 'Pending';
      }

      // activeView === 'all': apply granular statusFilter and ownershipFilter
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending' && recStatus !== 'Pending') return false;
        if (statusFilter === 'completed' && recStatus !== 'Completed') return false;
        if (statusFilter === 'onHold' && recStatus !== 'On Hold') return false;
        if (statusFilter === 'failed' && recStatus !== 'Failed') return false;
        if (statusFilter === 'working' && r.working !== 'Yes') return false;
        if (statusFilter === 'notWorking' && r.working !== 'No') return false;
      }

      // Ownership Filter
      if (ownershipFilter === 'mine') {
        if (!isOwner) return false;
      } else if (ownershipFilter === 'unassigned') {
        if (!isUnclaimed) return false;
      } else if (ownershipFilter.startsWith('user:')) {
        const targetUname = ownershipFilter.replace('user:', '').toLowerCase();
        if ((r.claimedBy || '').toLowerCase() !== targetUname) return false;
      }

      return true;
    });
  }, [currentKindRecords, search, activeView, statusFilter, ownershipFilter, currentUser, isAdmin, isPM]);

  // Claim site
  const handleClaimSite = async (recordId) => {
    try {
      const res = await api.claimRecord(recordId);
      setRecords(prev => prev.map(r => r.id === recordId ? res.record : r));
      showToast(`Site claimed successfully by you!`);
    } catch (err) {
      showToast('Could not claim site: ' + err.message, 'error');
    }
  };

  // Handover / Transfer Handlers
  const handleRequestTransfer = async (recordId) => {
    try {
      const res = await api.requestTransfer(recordId);
      setRecords(prev => prev.map(r => r.id === recordId ? res.record : r));
      showToast('Handover requested from current site owner!');
    } catch (err) {
      showToast(err.message || 'Failed to request transfer', 'error');
    }
  };

  const handleAcceptTransfer = async (recordId) => {
    try {
      const res = await api.acceptTransfer(recordId);
      setRecords(prev => prev.map(r => r.id === recordId ? res.record : r));
      showToast(`Site transfer accepted! Ownership assigned to ${res.record.claimedByName || res.record.claimedBy}.`);
    } catch (err) {
      showToast(err.message || 'Failed to accept transfer', 'error');
    }
  };

  const handleRejectTransfer = async (recordId) => {
    try {
      const res = await api.rejectTransfer(recordId);
      setRecords(prev => prev.map(r => r.id === recordId ? res.record : r));
      showToast(res.message || 'Site transfer request cancelled/declined.');
    } catch (err) {
      showToast(err.message || 'Failed to cancel/decline transfer', 'error');
    }
  };

  // Fast Status Transition Handler (Completed, Pending, On Hold, Failed)
  const handleStatusChange = async (recordId, newStatus) => {
    try {
      const res = await api.updateRecordStatus(recordId, newStatus);
      setRecords(prev => prev.map(r => r.id === recordId ? res.record : r));
      showToast(`Site status updated to "${newStatus}"!`);
    } catch (err) {
      showToast('Could not update status: ' + err.message, 'error');
    }
  };

  // Record Auto-Save Handler (Instant Background Persistence)
  const handleAutoSaveRecord = async (formData) => {
    try {
      if (formData.id) {
        const updated = await api.updateRecord(formData.id, formData);
        setRecords(prev => prev.map(r => (r.id === updated.id ? updated : r)));
        return updated;
      } else {
        const created = await api.createRecord(formData);
        setRecords(prev => [created, ...prev]);
        return created;
      }
    } catch (err) {
      console.warn('Auto-save error:', err.message);
      throw err;
    }
  };

  // Record CRUD Handlers
  const handleSaveRecord = async (formData) => {
    try {
      if (formData.id) {
        const updated = await api.updateRecord(formData.id, formData);
        setRecords(prev => prev.map(r => (r.id === updated.id ? updated : r)));
        showToast(`Saved ${formData.dpCode || formData.atmId || 'site'} to database!`);
      } else {
        const created = await api.createRecord(formData);
        setRecords(prev => [created, ...prev]);
        showToast(`Created ${created.kind} (${created.dpCode || created.atmId}) and moved to Pending queue!`);
      }
      setIsFormOpen(false);
      setRecordToEdit(null);
    } catch (err) {
      showToast(err.message || 'Failed to save record', 'error');
      throw err;
    }
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    try {
      await api.deleteRecord(recordToDelete.id);
      setRecords(prev => prev.filter(r => r.id !== recordToDelete.id));
      showToast(`Deleted ${recordToDelete.dpCode || recordToDelete.atmId || 'record'}`);
      setRecordToDelete(null);
    } catch (err) {
      showToast('Could not delete record: ' + err.message, 'error');
    }
  };

  // Export handlers
  const handleExportSingle = (record) => {
    const filename = `${record.kind.toLowerCase()}-${record.dpCode || record.atmId || 'record'}.json`;
    api.downloadFile(JSON.stringify(record, null, 2), filename, 'application/json');
    showToast(`Exported ${filename}`);
  };

  const handleExportAll = () => {
    const filename = `canara-sdwan-database-backup-${new Date().toISOString().slice(0, 10)}.json`;
    api.downloadFile(JSON.stringify(records, null, 2), filename, 'application/json');
    showToast(`Exported complete database (${records.length} records)`);
  };

  const handleExportFilteredCSV = (filteredList, filters = {}) => {
    const listToExport = filteredList || records;
    const fields = [
      'id', 'kind', 'dpCode', 'atmId', 'feName', 'feNumber',
      'newDeviceSerial', 'oldDeviceModel', 'oldDeviceSerial',
      'vlanConfigured', 'vlanDetails', 'vlanRemoved',
      'primaryLanIp', 'lanIpPrefix', 'primaryLanGateway', 'isDhcp', 'ipSource',
      'bsnlIp', 'bsnlGateway', 'bsnlPing',
      'jioIp', 'jioGateway', 'jioPing',
      'airtelIp', 'airtelGateway', 'ceIp', 'airtelPing',
      'configuration', 'csAdded', 'deviceOnline', 'dcDrReply', 'cablesConnected', 'working',
      'uatSubmitted', 'uatFormNo', 'claimedBy', 'claimedByName',
      'createdBy', 'updatedBy', 'created', 'updated'
    ];

    const csvHeader = fields.join(',');
    const csvRows = listToExport.map(r => {
      return fields.map(f => {
        const val = r[f] !== undefined && r[f] !== null ? String(r[f]) : '';
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',');
    });

    const csvContent = [csvHeader, ...csvRows].join('\r\n');
    const filename = `canara-sdwan-report-${new Date().toISOString().slice(0, 10)}.csv`;
    api.downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
    showToast(`Exported ${listToExport.length} site deployments to Excel CSV`);
  };

  // Render helper for feed content
  const renderFeedContent = () => {
    if (isLoading) {
      return (
        <div className="feed-loading-box">
          <div className="feed-spinner"></div>
          <span>Querying cloud PostgreSQL database...</span>
        </div>
      );
    }

    if (displayedRecords.length > 0) {
      return (
        <div className="sites-grid">
          {displayedRecords.map(record => (
            <RecordCard
              key={record.id}
              record={record}
              currentUser={currentUser}
              onClaim={handleClaimSite}
              onStatusChange={handleStatusChange}
              onRequestTransfer={handleRequestTransfer}
              onAcceptTransfer={handleAcceptTransfer}
              onRejectTransfer={handleRejectTransfer}
              onEdit={(rec) => {
                setRecordToEdit(rec);
                setIsFormOpen(true);
              }}
              onDelete={(rec) => setRecordToDelete(rec)}
              onExport={handleExportSingle}
              onNotify={showToast}
            />
          ))}
        </div>
      );
    }

    // Empty state when searching
    if (search.trim()) {
      return (
        <div className="feed-empty-state">
          <div className="empty-badge-icon">🔍</div>
          <h3>No matching deployments found</h3>
          <p>No site records matched "{search.trim()}". Check the DP code, ATM ID, FE name, or IP address.</p>
          <button
            type="button"
            className="reset-filters-btn"
            onClick={() => setSearch('')}
          >
            Clear Search
          </button>
        </div>
      );
    }

    // Empty state for My Pending Sites
    if (activeView === 'my-pending') {
      return (
        <div className="feed-empty-state">
          <div className="empty-badge-icon">📌</div>
          <h3>No Pending Sites Assigned to You</h3>
          <p>You have no active pending deployments right now. Check the Open Pool to claim available sites or add a new deployment.</p>
          <div className="empty-actions">
            <button
              type="button"
              className="claim-empty-btn"
              onClick={() => setActiveView('unassigned')}
            >
              🌐 Open Pool ({viewCounts.unassignedPending} Available)
            </button>
            <button
              type="button"
              className="add-site-cta"
              onClick={() => {
                setRecordToEdit(null);
                setIsFormOpen(true);
              }}
            >
              ＋ Add Deployment
            </button>
          </div>
        </div>
      );
    }

    // Empty state for Completed Sites
    if (activeView === 'completed') {
      return (
        <div className="feed-empty-state">
          <div className="empty-badge-icon">✅</div>
          <h3>No Completed Sites Yet</h3>
          <p>
            {isAdmin || isPM
              ? 'No sites in this category have been marked as Completed yet.'
              : 'You have not marked any sites as Completed yet. Sites you complete will appear here.'}
          </p>
          <div className="empty-actions">
            <button
              type="button"
              className="reset-filters-btn"
              onClick={() => setActiveView('all')}
            >
              👥 View All Sites & Team
            </button>
          </div>
        </div>
      );
    }

    // Empty state for Open Pool (Unassigned)
    if (activeView === 'unassigned') {
      return (
        <div className="feed-empty-state">
          <div className="empty-badge-icon">🌐</div>
          <h3>No Unassigned Pending Sites in Pool</h3>
          <p>All pending site deployments have been claimed by team engineers. New sites added will appear here.</p>
          <div className="empty-actions">
            <button
              type="button"
              className="reset-filters-btn"
              onClick={() => setActiveView('my-pending')}
            >
              📌 View My Pending Sites
            </button>
            <button
              type="button"
              className="add-site-cta"
              onClick={() => {
                setRecordToEdit(null);
                setIsFormOpen(true);
              }}
            >
              ＋ Add Deployment
            </button>
          </div>
        </div>
      );
    }

    // Default empty state for All Sites
    return (
      <div className="feed-empty-state">
        <div className="empty-badge-icon">📡</div>
        <h3>No site deployments found</h3>
        <p>
          {statusFilter !== 'all' || ownershipFilter !== 'all'
            ? 'No sites match your active status or ownership filters.'
            : 'Get started by registering your first site deployment.'}
        </p>
        {statusFilter !== 'all' || ownershipFilter !== 'all' ? (
          <button
            type="button"
            className="reset-filters-btn"
            onClick={() => {
              setStatusFilter('all');
              setOwnershipFilter('all');
            }}
          >
            Clear Active Filters
          </button>
        ) : (
          <button
            type="button"
            className="add-site-cta"
            onClick={() => {
              setRecordToEdit(null);
              setIsFormOpen(true);
            }}
          >
            ＋ Add First Deployment
          </button>
        )}
      </div>
    );
  };

  // Loading Screen
  if (isAuthChecking) {
    return (
      <div className="app-init-loader">
        <div className="init-spinner"></div>
        <h2>Canara Bank SD-WAN Tracker</h2>
        <p>Connecting to Cloud Infrastructure & Secure Session...</p>
      </div>
    );
  }

  // Not logged in -> Show Login Portal
  if (!currentUser) {
    return (
      <>
        <LoginModal onLoginSuccess={handleLoginSuccess} />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    );
  }

  return (
    <div className="dashboard-root">
      <Header
        currentUser={currentUser}
        dbStatus={dbStatus}
        onOpenImportExport={() => setIsImportExportOpen(true)}
        onOpenUserManagement={() => setIsUserMgmtOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onQuickBackup={handleExportAll}
        onLogout={handleLogout}
      />

      <main className="content-wrap">
        {/* Admin & PM Status Strip */}
        {canManageUsers && (
          <div className="admin-quick-strip">
            <div className="admin-strip-info">
              <span className="admin-badge-icon">🛡️</span>
              <div>
                <strong>{isAdmin ? 'Administrator Console:' : 'Project Manager Console:'}</strong>
                <span> Logged in as <em>{currentUser?.name || currentUser?.username}</em> ({userRole.toUpperCase()}). You have permission to manage team accounts, view all site deployments, and generate filtered audit exports.</span>
              </div>
            </div>
            <div className="admin-strip-actions">
              <button
                type="button"
                className="admin-strip-action-btn"
                onClick={() => setIsUserMgmtOpen(true)}
              >
                👥 Team & Users
              </button>
            </div>
          </div>
        )}

        <Toolbar
          activeView={activeView}
          onViewChange={setActiveView}
          viewCounts={viewCounts}
          kind={kind}
          onKindChange={(newKind) => {
            setKind(newKind);
            setSearch('');
          }}
          totalCount={records.length}
          branchCount={branchRecords.length}
          atmCount={atmRecords.length}
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          ownershipFilter={ownershipFilter}
          onOwnershipFilterChange={setOwnershipFilter}
          users={users}
          onAddNew={() => {
            setRecordToEdit(null);
            setIsFormOpen(true);
          }}
          canManageUsers={canManageUsers}
          onOpenUserManagement={() => setIsUserMgmtOpen(true)}
        />

        {search.trim() && (
          <div className="search-results-banner">
            <div className="search-banner-info">
              <span className="search-banner-icon">🔍</span>
              <span>
                Search results for <strong>"{search.trim()}"</strong> — {displayedRecords.length} {displayedRecords.length === 1 ? 'site' : 'sites'} found
              </span>
            </div>
            <button
              type="button"
              className="search-clear-banner-btn"
              onClick={() => setSearch('')}
              title="Exit search and return to dashboard"
            >
              ✕ Clear Search
            </button>
          </div>
        )}

        {/* Sites List ALWAYS ON TOP (Immediate Access on Mobile & Desktop) */}
        <section className="sites-feed">
          {renderFeedContent()}
        </section>

        {/* KPI Summary Cards AT THE BOTTOM (No Scrolling Needed to See Sites) */}
        <div className="stats-cards-divider">
          <span>Overall Status Breakdown ({kind === 'All' ? 'All Sites' : kind === 'Branch' ? 'Branches' : 'ATMs'})</span>
        </div>
        <SummaryCards
          kind={kind}
          total={statusStats.total}
          completed={statusStats.completed}
          pending={statusStats.pending}
          onHold={statusStats.onHold}
          failed={statusStats.failed}
          activeFilter={statusFilter}
          onSelectStatus={(st) => {
            setActiveView('all');
            setStatusFilter(st);
          }}
        />

        <footer className="portal-footer">
          <p>
            Connected to <strong>Canara Bank SD-WAN Database (PostgreSQL Engine)</strong>.
            Signed in as <strong>{currentUser.name || currentUser.username}</strong> ({userRole.toUpperCase()}).
          </p>
        </footer>
      </main>

      {/* Add / Edit Form Modal (Full-Screen Layout) */}
      {isFormOpen && (
        <RecordFormModal
          kind={kind}
          recordToEdit={recordToEdit}
          currentUser={currentUser}
          users={users}
          records={records}
          onSave={handleSaveRecord}
          onAutoSave={handleAutoSaveRecord}
          onClose={() => {
            setIsFormOpen(false);
            setRecordToEdit(null);
          }}
        />
      )}

      {/* Team / User Management Modal */}
      {isUserMgmtOpen && (
        <UserManagementModal
          isOpen={isUserMgmtOpen}
          onClose={() => {
            setIsUserMgmtOpen(false);
            loadUsers();
          }}
          currentUser={currentUser}
          onNotify={showToast}
        />
      )}

      {/* My Profile Modal */}
      {isProfileOpen && (
        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          currentUser={currentUser}
          onProfileUpdated={(updated) => {
            setCurrentUser(updated);
          }}
          onNotify={showToast}
        />
      )}

      {/* Export / Backup Modal */}
      <ImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        records={records}
        users={users}
        currentKind={kind}
        onExportFilteredCSV={handleExportFilteredCSV}
        onExportAllJSON={handleExportAll}
      />

      {/* Delete Confirmation Modal */}
      {recordToDelete && (
        <div className="modal-overlay" onClick={() => setRecordToDelete(null)}>
          <div className="modal-window delete-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-form-header">
              <h3>Confirm Permanent Deletion</h3>
              <button
                type="button"
                className="modal-close-button"
                onClick={() => setRecordToDelete(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-form-scrollable">
              <p>
                Are you sure you want to permanently delete{' '}
                <strong>
                  {recordToDelete.kind} record: {recordToDelete.dpCode || recordToDelete.atmId || 'site'}
                </strong>
                ?
              </p>
              <p className="delete-warning">
                This action cannot be undone. All circuit, VLAN, and hardware details will be erased from PostgreSQL.
              </p>
            </div>
            <div className="modal-form-footer">
              <button
                type="button"
                className="danger-btn"
                onClick={handleConfirmDelete}
              >
                Confirm Delete
              </button>
              <button
                type="button"
                className="cancel-btn"
                onClick={() => setRecordToDelete(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Container */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
