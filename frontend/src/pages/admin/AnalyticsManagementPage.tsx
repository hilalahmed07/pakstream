import React from 'react';
import AdminAnalyticsDashboard from '../../components/admin/AdminAnalyticsDashboard';

const AnalyticsManagementPage: React.FC = () => {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-primary)' }}>
      <div className="ml-64 p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
            Analytics
          </h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Platform statistics, active users, and top engagement
          </p>
        </div>
        <AdminAnalyticsDashboard />
      </div>
    </div>
  );
};

export default AnalyticsManagementPage;
