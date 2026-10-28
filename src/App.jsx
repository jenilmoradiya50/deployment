import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Header from './components/Header';
import SummaryCards from './components/SummaryCards';
import Toolbar from './components/Toolbar';
import RecordCard from './components/RecordCard';
import RecordFormModal from './components/RecordFormModal';
import ImportExportModal from './components/ImportExportModal';
import LoginModal from './components/LoginModal';
import Toast from './components/Toast';
import { api } from './services/api';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const [kind, setKind] = useState('Branch');
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ispFilter, setIspFilter] = useState('all');

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState(null);
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);
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

  // Fetch records
  const loadData = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const res = await api.getRecords();
      setRecords(res.data || []);
      const stats = await api.getStats();
      if (stats?.database) {
        setDbStatus({ type: stats.database.includes('MongoDB') ? 'mongodb' : 'local' });
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
    }
  }, [currentUser, loadData]);

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

    return currentKindRecords.filter(r => {
      // Status Filter
      if (statusFilter === 'working' && r.working !== 'Yes') return false;
      if (statusFilter === 'notWorking' && r.working !== 'No') return false;
      if (statusFilter === 'pending' && (r.working === 'Yes' || r.working === 'No')) return false;

      // ISP Circuit Filter
      if (ispFilter === 'bsnlOk' && r.bsnlPing !== 'Yes') return false;
      if (ispFilter === 'jioOk' && r.jioPing !== 'Yes') return false;
      if (ispFilter === 'airtelOk' && r.airtelPing !== 'Yes') return false;

      // Search Query
      if (q) {
        const str = JSON.stringify(r).toLowerCase();
        if (!str.includes(q)) return false;
      }

      return true;
    });
  }, [currentKindRecords, search, statusFilter, ispFilter]);

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
    const filename = `sd-wan-database-backup-${new Date().toISOString().slice(0, 10)}.json`;
    api.downloadFile(JSON.stringify(records, null, 2), filename, 'application/json');
    showToast(`Exported complete database (${records.length} records)`);
  };

  const handleExportCSV = () => {
    const fields = [
      'id', 'kind', 'dpCode', 'atmId', 'vlan',
      'lanIp', 'lanGateway', 'atmIp', 'atmGateway',
      'bsnlIp', 'bsnlGateway', 'bsnlPing',
      'jioIp', 'jioGateway', 'jioPing',
      'airtelIp', 'airtelGateway', 'ceIp', 'airtelPing',
      'configuration', 'mp', 'online', 'mail', 'dcMail', 'drcMail', 'cables', 'working',
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
    const filename = `sdwan-work-tracker-${new Date().toISOString().slice(0, 10)}.csv`;
    api.downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
    showToast('Exported CSV spreadsheet for Excel');
  };

  // Import handler
  const handleImportRecords = async (importedList, mode) => {
    try {
      const res = await api.bulkImport(importedList, mode);
      await loadData();
      showToast(res.message || `Imported ${importedList.length} records!`);
    } catch (err) {
      showToast('Import failed: ' + err.message, 'error');
      throw err;
    }
  };

  // Auth checking screen
  if (isAuthChecking) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-spinner"></div>
        <p>Connecting to SD-WAN Portal...</p>
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
        onQuickBackup={handleExportAll}
        onLogout={handleLogout}
      />

      <main className="content-wrap">
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
          ispFilter={ispFilter}
          onIspFilterChange={setIspFilter}
          onAddNew={() => {
            setRecordToEdit(null);
            setIsFormOpen(true);
          }}
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
              <span>Syncing records from database...</span>
            </div>
          ) : displayedRecords.length > 0 ? (
            <div className="sites-grid">
              {displayedRecords.map(record => (
                <RecordCard
                  key={record.id}
                  record={record}
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
              <h3>No {kind.toLowerCase()} records found</h3>
              <p>
                {search || statusFilter !== 'all' || ispFilter !== 'all'
                  ? 'No sites match your active search or filters.'
                  : `Get started by registering your first ${kind.toLowerCase()} site deployment.`}
              </p>
              {search || statusFilter !== 'all' || ispFilter !== 'all' ? (
                <button
                  type="button"
                  className="reset-filters-btn"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('all');
                    setIspFilter('all');
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
            Connected to <strong>Node.js Backend & MongoDB / Local Database</strong>.
            Authorized access for <strong>{currentUser.name || currentUser.username}</strong> ({currentUser.role}).
          </p>
        </footer>
      </main>

      {/* Add / Edit Form Modal */}
      {isFormOpen && (
        <RecordFormModal
          kind={kind}
          recordToEdit={recordToEdit}
          onSave={handleSaveRecord}
          onClose={() => {
            setIsFormOpen(false);
            setRecordToEdit(null);
          }}
        />
      )}

      {/* Import / Export Modal */}
      <ImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        records={records}
        currentKind={kind}
        onImport={handleImportRecords}
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
                Are you sure you want to permanently delete{' '}
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
