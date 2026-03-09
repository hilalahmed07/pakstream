import React from 'react';
import AdminDownloadDashboard from '../../components/admin/AdminDownloadDashboard';

const DownloadManagementPage: React.FC = () => {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-primary)' }}>
      <div className="ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>Download Management</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>Track and monitor downloads for videos, documents, presentations, and patches</p>
        </div>
        <AdminDownloadDashboard />
      </div>
    </div>
  );
};

export default DownloadManagementPage;
