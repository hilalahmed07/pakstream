import React, { useEffect, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import ProtectedRoute from '../ProtectedRoute';
import analyticsService, {
  AnalyticsSummary,
  TopUserItem,
} from '../../services/analyticsService';
import UserDetailDialog from './UserDetailDialog';
import { isPatchVisible } from '../../config/features';

const AdminAnalyticsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDialogOpen, setUserDialogOpen] = useState(false);

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

  const { platform, activeUsers, topUsers } = data;

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

  const openUserDialog = (userId: string) => {
    setSelectedUserId(userId);
    setUserDialogOpen(true);
  };

  const TopUsersTable: React.FC<{
    items: TopUserItem[];
    onUserClick?: (userId: string) => void;
  }> = ({ items, onUserClick }) => (
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
                    {onUserClick ? (
                      <button
                        type="button"
                        onClick={() => onUserClick(item._id)}
                        className="text-left font-medium underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-offset-1 rounded"
                        style={{ color: 'var(--color-accent, #60a5fa)' }}
                      >
                        {item.username.toUpperCase()}
                      </button>
                    ) : (
                      item.username
                    )}
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
        {/* First row: Total users, Total views, DAU, MAU */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Users" value={platform.totalUsers} />
          <StatCard label="Daily Active Users" value={activeUsers.dau} accentColor="#4ade80" />
          <StatCard label="Monthly Active Users" value={activeUsers.mau} accentColor="#a78bfa" />
          <StatCard label="Total Views" value={platform.totalViews} accentColor="#60a5fa" />
        </div>
        {/* Second row: Total contents, Videos, Documents, Presentations, Patches */}
        <div className={`grid grid-cols-1 md:grid-cols-2 ${isPatchVisible ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
          <StatCard label="Videos" value={platform.totalVideos} />
          <StatCard label="Presentations" value={platform.totalPresentations} />
          <StatCard label="Documents" value={platform.totalDocuments} />
          {isPatchVisible && <StatCard label="Patches" value={platform.totalPatches ?? 0} />}
          <StatCard label="Total Contents" value={platform.totalContent} />
        </div>

        {/* Content breakdown chart */}
        {(() => {
          const contentData = [
            { name: 'Videos', value: platform.totalVideos, color: '#60a5fa' },
            { name: 'Documents', value: platform.totalDocuments, color: '#4ade80' },
            { name: 'Presentations', value: platform.totalPresentations, color: '#a78bfa' },
            ...(isPatchVisible ? [{ name: 'Patches', value: platform.totalPatches ?? 0, color: '#f59e0b' }] : []),
          ].filter((d) => d.value > 0);
          if (contentData.length === 0) return null;
          return (
            <div
              className="rounded-lg p-4 mb-8"
              style={{ backgroundColor: 'var(--color-secondary)' }}
            >
              <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
                Content Breakdown
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={contentData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {contentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [value, 'Count']}
                    contentStyle={{
                      backgroundColor: 'var(--color-secondary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      color: 'var(--color-text)',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          );
        })()}

        {/* Top users bar chart */}
        {topUsers.length > 0 && (
          <div
            className="rounded-lg p-4 mb-8"
            style={{ backgroundColor: 'var(--color-secondary)' }}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
              Top Users by Views
            </h3>
            <ResponsiveContainer width="100%" height={Math.min(400, 56 * topUsers.length)}>
              <BarChart
                layout="vertical"
                data={topUsers.map((u) => ({ name: u.username, views: u.totalViews, userId: u._id }))}
                margin={{ top: 8, right: 24, left: 80, bottom: 8 }}
              >
                <XAxis type="number" stroke="var(--color-text-secondary)" />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={72}
                  stroke="var(--color-text-secondary)"
                  tick={{ fill: 'var(--color-text)' }}
                />
                <Tooltip
                  formatter={(value: number) => [value, 'Total views']}
                  contentStyle={{
                    backgroundColor: 'var(--color-secondary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    color: 'var(--color-text)',
                  }}
                  labelStyle={{ color: 'var(--color-text)' }}
                />
                <Bar dataKey="views" fill="#60a5fa" radius={[0, 4, 4, 0]} name="Total views" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top users */}
        <TopUsersTable items={topUsers} onUserClick={openUserDialog} />

        <UserDetailDialog
          userId={selectedUserId}
          open={userDialogOpen}
          onClose={() => {
            setUserDialogOpen(false);
            setSelectedUserId(null);
          }}
        />
      </div>
    </ProtectedRoute>
  );
};

export default AdminAnalyticsDashboard;
