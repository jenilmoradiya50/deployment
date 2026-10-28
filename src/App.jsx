import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Header from './components/Header';
import SummaryCards from './components/SummaryCards';
import Toolbar from './components/Toolbar';
import RecordCard from './components/RecordCard';
import RecordFormModal from './components/RecordFormModal';
import ImportExportModal from './components/ImportExportModal';
import UserManagementModal from './components/UserManagementModal';
import LoginModal from './components/LoginModal';
import Toast from './components/Toast';
import { api } from './services/api';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const [kind, setKind] = useState('Branch');
  const [records, setRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ownershipFilter, setOwnershipFilter] = useState('all');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState(null);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
  const [isUserMgmtOpen, setIsUserMgmtOpen] = useState(false);
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

  // Fetch users list (for assignment dropdown & user management)
  const loadUsers = useCallback(async () => {
    if (!currentUser) return;
    try {
      const uRole = (currentUser.role || '').toLowerCase();
      const uName = (currentUser.username || '').toLowerCase();
      if (uRole === 'admin' || uName.includes('admin')) {
        const uList = await api.getUsers();
        setUsers(uList || []);
      } else {
        setUsers([{ id: currentUser.id, username: currentUser.username, name: currentUser.name }]);
      }
    } catch {
      // Non-admins might not have full list, fallback
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

  // Filtered counts
  const branchRecords = useMemo(() => records.filter(r => r.kind === 'Branch'), [records]);
  const atmRecords = useMemo(() => records.filter(r => r.kind === 'ATM'), [records]);
  const currentKindRecords = useMemo(() => (kind === 'Branch' ? branchRecords : atmRecords), [kind, branchRecords, atmRecords]);
  const doneCount = useMemo(() => currentKindRecords.filter(r => r.working === 'Yes').length, [currentKindRecords]);

  // Filtered displayed records
  const displayedRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    const curUname = (currentUser?.username || '').toLowerCase();

    return currentKindRecords.filter(r => {
      // Status Filter
      if (statusFilter === 'working' && r.working !== 'Yes') return false;
      if (statusFilter === 'notWorking' && r.working !== 'No') return false;
      if (statusFilter === 'pending' && (r.working === 'Yes' || r.working === 'No')) return false;

      // Ownership Filter
      if (ownershipFilter === 'mine') {
        if (!r.claimedBy || r.claimedBy.toLowerCase() !== curUname) return false;
      }
      if (ownershipFilter === 'unassigned') {
        if (r.claimedBy && r.claimedBy.trim() !== '') return false;
      }

      // Search Query
      if (q) {
        const str = JSON.stringify(r).toLowerCase();
        if (!str.includes(q)) return false;
      }

      return true;
    });
  }, [currentKindRecords, search, statusFilter, ownershipFilter, currentUser]);

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

  // Record CRUD Handlers
  const handleSaveRecord = async (formData) => {
    try {
      if (formData.id) {
        const updated = await api.updateRecord(formData.id, formData);
        setRecords(prev => prev.map(r => (r.id === updated.id ? updated : r)));
        showToast(`Updated ${formData.dpCode || formData.atmId || 'site'} in database!`);
      } else {
        const created = await api.createRecord(formData);
        setRecords(prev => [created, ...prev]);
        showToast(`Created new ${kind} record in database!`);
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

  const handleExportCurrent = () => {
    const filename = `${kind.toLowerCase()}-sites-export-${new Date().toISOString().slice(0, 10)}.json`;
    api.downloadFile(JSON.stringify(currentKindRecords, null, 2), filename, 'application/json');
    showToast(`Exported ${currentKindRecords.length} ${kind} sites`);
  };

  const handleExportAll = () => {
    const filename = `canara-sdwan-database-backup-${new Date().toISOString().slice(0, 10)}.json`;
    api.downloadFile(JSON.stringify(records, null, 2), filename, 'application/json');
    showToast(`Exported complete database (${records.length} records)`);
  };

  const handleExportCSV = () => {
    const fields = [
      'id', 'kind', 'dpCode', 'atmId', 'feName', 'feNumber',
      'newDeviceSerial', 'oldDeviceModel', 'oldDeviceSerial',
      'vlanConfigured', 'vlanDetails', 'vlanRemoved',
      'primaryLanIp', 'lanIpPrefix', 'primaryLanGateway',
      'bsnlIp', 'bsnlGateway', 'bsnlPing',
      'jioIp', 'jioGateway', 'jioPing',
      'airtelIp', 'airtelGateway', 'ceIp', 'airtelPing',
      'configuration', 'csAdded', 'deviceOnline', 'mailSent', 'dcMail', 'drcMail', 'cablesConnected', 'working',
      'uatSubmitted', 'uatFormNo', 'claimedBy', 'claimedByName',
      'createdBy', 'updatedBy', 'created', 'updated'
    ];

    const csvHeader = fields.join(',');
    const csvRows = records.map(r => {
      return fields.map(f => {
        const val = r[f] !== undefined && r[f] !== null ? String(r[f]) : '';
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',');
    });

    const csvContent = [csvHeader, ...csvRows].join('\r\n');
    const filename = `canara-sdwan-work-tracker-${new Date().toISOString().slice(0, 10)}.csv`;
    api.downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
    showToast('Exported CSV spreadsheet for Excel');
  };

  // Auth checking screen
  if (isAuthChecking) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-spinner"></div>
        <p>Connecting to Canara SD-WAN Portal...</p>
      </div>
    );
  }

  // Not logged in -> Show Login Portal (with zero demo text)
  if (!currentUser) {
    return (
      <>
        <LoginModal onLoginSuccess={handleLoginSuccess} />
        <Toast toast={toast} onClose={() => setToast(null)} />
      </>
    );
  }

  const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin' || 
                  (currentUser?.username || '').toLowerCase().includes('admin');

  return (
    <div className="dashboard-root">
      <Header
        currentUser={currentUser}
        dbStatus={dbStatus}
        onOpenImportExport={() => setIsImportExportOpen(true)}
        onOpenUserManagement={() => setIsUserMgmtOpen(true)}
        onQuickBackup={handleExportAll}
        onLogout={handleLogout}
      />

      <main className="content-wrap">
        {isAdmin && (
          <div className="admin-quick-strip">
            <div className="admin-strip-info">
              <span className="admin-badge-icon">🛡️</span>
              <div>
                <strong>Administrator Console:</strong>
                <span> Logged in as <em>{currentUser?.name || currentUser?.username}</em>. You can register Field Engineers, set their login passwords, and manage bank site assignments.</span>
              </div>
            </div>
            <div className="admin-strip-actions">
              <button
                type="button"
                className="admin-strip-action-btn"
                onClick={() => setIsUserMgmtOpen(true)}
              >
                👥 Add User / Manage Team
              </button>
            </div>
          </div>
        )}

        <Toolbar
          kind={kind}
          onKindChange={(newKind) => {
            setKind(newKind);
            setSearch('');
          }}
          branchCount={branchRecords.length}
          atmCount={atmRecords.length}
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          ownershipFilter={ownershipFilter}
          onOwnershipFilterChange={setOwnershipFilter}
          onAddNew={() => {
            setRecordToEdit(null);
            setIsFormOpen(true);
          }}
          isAdmin={isAdmin}
          onOpenUserManagement={() => setIsUserMgmtOpen(true)}
        />

        <SummaryCards
          kind={kind}
          totalKind={currentKindRecords.length}
          doneKind={doneCount}
          totalAll={records.length}
        />

        {/* Feed of Site Records */}
        <section className="sites-feed">
          {isLoading ? (
            <div className="feed-loading-box">
              <div className="feed-spinner"></div>
              <span>Querying cloud PostgreSQL database...</span>
            </div>
          ) : displayedRecords.length > 0 ? (
            <div className="sites-grid">
              {displayedRecords.map(record => (
                <RecordCard
                  key={record.id}
                  record={record}
                  currentUser={currentUser}
                  onClaim={handleClaimSite}
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
          ) : (
            <div className="feed-empty-state">
              <div className="empty-badge-icon">📡</div>
              <h3>No {kind.toLowerCase()} sites found</h3>
              <p>
                {search || statusFilter !== 'all' || ownershipFilter !== 'all'
                  ? 'No sites match your active search or filters.'
                  : `Get started by registering your first ${kind.toLowerCase()} site deployment.`}
              </p>
              {search || statusFilter !== 'all' || ownershipFilter !== 'all' ? (
                <button
                  type="button"
                  className="reset-filters-btn"
                  onClick={() => {
                    setSearch('');
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
                  ＋ Add First {kind} Record
                </button>
              )}
            </div>
          )}
        </section>

        <footer className="portal-footer">
          <p>
            Connected to <strong>Canara Bank SD-WAN Database (PostgreSQL Engine)</strong>.
            Signed in as <strong>{currentUser.name || currentUser.username}</strong> ({currentUser.role}).
          </p>
        </footer>
      </main>

      {/* Add / Edit Form Modal */}
      {isFormOpen && (
        <RecordFormModal
          kind={kind}
          recordToEdit={recordToEdit}
          currentUser={currentUser}
          users={users}
          onSave={handleSaveRecord}
          onClose={() => {
            setIsFormOpen(false);
            setRecordToEdit(null);
          }}
        />
      )}

      {/* Admin User Management Modal */}
      {isUserMgmtOpen && (
        <UserManagementModal
          isOpen={isUserMgmtOpen}
          onClose={() => {
            setIsUserMgmtOpen(false);
            loadUsers();
          }}
          onNotify={showToast}
        />
      )}

      {/* Export / Backup Modal */}
      <ImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        records={records}
        currentKind={kind}
        onExportCurrent={handleExportCurrent}
        onExportAll={handleExportAll}
        onExportCSV={handleExportCSV}
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
            <div className="delete-dialog-body">
              <p>
                Are you sure you want to permanently delete site{' '}
                <strong>{recordToDelete.dpCode || recordToDelete.atmId || recordToDelete.id}</strong>?
              </p>
              <p className="delete-warning">
                This record will be permanently deleted from the database.
              </p>
            </div>
            <div className="delete-dialog-actions">
              <button
                type="button"
                className="delete-confirm-btn"
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

      {/* Toast Alert */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
