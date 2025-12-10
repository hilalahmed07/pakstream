import React from 'react';
import AdminPresentationDashboard from '../../components/presentation/AdminPresentationDashboard';

const PresentationManagementPage: React.FC = () => {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-primary)' }}>
      <div className="ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>Presentation Management</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>Upload, manage, and monitor presentations</p>
        </div>
        <AdminPresentationDashboard />
      </div>
    </div>
  );
};

export default PresentationManagementPage;
