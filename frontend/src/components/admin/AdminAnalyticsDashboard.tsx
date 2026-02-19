import React, { useEffect, useState } from 'react';
import ProtectedRoute from '../ProtectedRoute';
import analyticsService, {
  AnalyticsSummary,
  TopContentItem,
  TopUserItem,
} from '../../services/analyticsService';

const AdminAnalyticsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await analyticsService.getSummary();
        setData(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <ProtectedRoute requireAdmin>
        <div className="flex items-center justify-center min-h-[400px]" style={{ color: 'var(--color-text-secondary)' }}>
          Loading analytics...
        </div>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute requireAdmin>
        <div className="p-4 rounded-lg bg-red-900/20 text-red-400" role="alert">
          {error}
        </div>
      </ProtectedRoute>
    );
  }

  if (!data) {
    return null;
  }

  const { platform, activeUsers, topVideos, topDocuments, topPresentations, topUsers } = data;

  const StatCard: React.FC<{
    label: string;
    value: number | string;
    accentColor?: string;
  }> = ({ label, value, accentColor }) => (
    <div
      className="p-4 rounded-lg"
      style={{ backgroundColor: 'var(--color-secondary)' }}
    >
      <div
        className="text-2xl font-bold"
        style={{ color: accentColor || 'var(--color-text)' }}
      >
        {value}
      </div>
      <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </div>
    </div>
  );

  const TopContentTable: React.FC<{
    title: string;
    items: TopContentItem[];
    type: string;
  }> = ({ title, items, type }) => (
    <div
      className="rounded-lg overflow-hidden mb-8"
      style={{ backgroundColor: 'var(--color-secondary)' }}
    >
      <h3 className="text-lg font-semibold p-4" style={{ color: 'var(--color-text)' }}>
        {title}
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y" style={{ borderColor: 'var(--color-border)' }}>
          <thead>
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium uppercase"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Title
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium uppercase"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Uploader
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium uppercase"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Views
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium uppercase"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Likes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-4 text-center text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  No {type} yet
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item._id}>
                  <td className="px-6 py-4 text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                    {item.title}
                  </td>
                  <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {typeof item.uploadedBy === 'object' && item.uploadedBy?.username
                      ? item.uploadedBy.username
                      : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-text)' }}>
                    {item.views}
                  </td>
                  <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-text)' }}>
                    {item.likes}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const TopUsersTable: React.FC<{ items: TopUserItem[] }> = ({ items }) => (
    <div
      className="rounded-lg overflow-hidden mb-8"
      style={{ backgroundColor: 'var(--color-secondary)' }}
    >
      <h3 className="text-lg font-semibold p-4" style={{ color: 'var(--color-text)' }}>
        Top Users by Engagement
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y" style={{ borderColor: 'var(--color-border)' }}>
          <thead>
            <tr>
              <th
                className="px-6 py-3 text-left text-xs font-medium uppercase"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                User
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium uppercase"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Uploads
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium uppercase"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Total Views
              </th>
              <th
                className="px-6 py-3 text-left text-xs font-medium uppercase"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Total Likes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-6 py-4 text-center text-sm"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  No user engagement data yet
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item._id}>
                  <td className="px-6 py-4 text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                    {item.username}
                  </td>
                  <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-text)' }}>
                    {item.uploadCount}
                  </td>
                  <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-text)' }}>
                    {item.totalViews}
                  </td>
                  <td className="px-6 py-4 text-sm" style={{ color: 'var(--color-text)' }}>
                    {item.totalLikes}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <ProtectedRoute requireAdmin>
      <div className="space-y-8">
        {/* Platform totals & Active users */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Total Users" value={platform.totalUsers} />
          <StatCard label="Total Content" value={platform.totalContent} />
          <StatCard label="Total Views" value={platform.totalViews} accentColor="#60a5fa" />
          <StatCard label="Daily Active Users" value={activeUsers.dau} accentColor="#4ade80" />
          <StatCard label="Monthly Active Users" value={activeUsers.mau} accentColor="#a78bfa" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Videos" value={platform.totalVideos} />
          <StatCard label="Documents" value={platform.totalDocuments} />
          <StatCard label="Presentations" value={platform.totalPresentations} />
        </div>

        {/* Top content tables */}
        <TopContentTable title="Top Videos by Views" items={topVideos} type="videos" />
        <TopContentTable title="Top Documents by Views" items={topDocuments} type="documents" />
        <TopContentTable title="Top Presentations by Views" items={topPresentations} type="presentations" />

        {/* Top users */}
        <TopUsersTable items={topUsers} />
      </div>
    </ProtectedRoute>
  );
};

export default AdminAnalyticsDashboard;
