import React, { useState, useEffect, useRef } from 'react';
import downloadService from '../../services/downloadService';
import { Download, DownloadStats, DownloadAssetType } from '../../types/download';

const AdminDownloadDashboard: React.FC = () => {
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [stats, setStats] = useState<DownloadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10);
  
  // Filters
  const [userIdFilter, setUserIdFilter] = useState('');
  const [debouncedUserIdFilter, setDebouncedUserIdFilter] = useState('');
  const [assetTypeFilter, setAssetTypeFilter] = useState<DownloadAssetType | 'all'>('all');
  const [assetIdFilter, setAssetIdFilter] = useState('');
  const [debouncedAssetIdFilter, setDebouncedAssetIdFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('downloadedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const userIdDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const assetIdDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce userId filter
  useEffect(() => {
    if (userIdDebounceRef.current) {
      clearTimeout(userIdDebounceRef.current);
    }
    
    userIdDebounceRef.current = setTimeout(() => {
      setDebouncedUserIdFilter(userIdFilter);
      setCurrentPage(1);
    }, 500);

    return () => {
      if (userIdDebounceRef.current) {
        clearTimeout(userIdDebounceRef.current);
      }
    };
  }, [userIdFilter]);

  // Debounce assetId filter
  useEffect(() => {
    if (assetIdDebounceRef.current) {
      clearTimeout(assetIdDebounceRef.current);
    }
    
    assetIdDebounceRef.current = setTimeout(() => {
      setDebouncedAssetIdFilter(assetIdFilter);
      setCurrentPage(1);
    }, 500);

    return () => {
      if (assetIdDebounceRef.current) {
        clearTimeout(assetIdDebounceRef.current);
      }
    };
  }, [assetIdFilter]);

  const fetchStats = async () => {
    try {
      const response = await downloadService.getDownloadStats();
      setStats(response.data);
    } catch (err: any) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchDownloads = async () => {
    try {
      setLoading(true);
      const response = await downloadService.getAllDownloads({
        page: currentPage,
        limit,
        userId: debouncedUserIdFilter || undefined,
        assetType: assetTypeFilter === 'all' ? undefined : assetTypeFilter,
        assetId: debouncedAssetIdFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sortBy,
        sortOrder
      });
      setDownloads(response.data.downloads);
      setTotalPages(response.data.pagination.pages);
      setTotal(response.data.pagination.total);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch downloads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchDownloads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, limit, debouncedUserIdFilter, debouncedAssetIdFilter, assetTypeFilter, startDate, endDate, sortBy, sortOrder]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const clearFilters = () => {
    setUserIdFilter('');
    setAssetTypeFilter('all');
    setAssetIdFilter('');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="rounded-lg p-6" style={{ backgroundColor: 'var(--color-secondary)' }}>
            <div className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>Total Downloads</div>
            <div className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>{stats.totalDownloads.toLocaleString()}</div>
          </div>
          
          <div className="rounded-lg p-6" style={{ backgroundColor: 'var(--color-secondary)' }}>
            <div className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>Top Video</div>
            <div className="text-lg font-semibold truncate" style={{ color: 'var(--color-text)' }}>
              {stats.downloadsPerVideo[0]?.videoTitle || 'N/A'}
            </div>
            <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {stats.downloadsPerVideo[0]?.downloadCount || 0} downloads
            </div>
          </div>

          <div className="rounded-lg p-6" style={{ backgroundColor: 'var(--color-secondary)' }}>
            <div className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>Top Patch</div>
            {(() => {
              const patchRows = stats.downloadsPerAsset.filter((a) => a.assetType === 'patch');
              const topPatch = patchRows.sort((a, b) => b.downloadCount - a.downloadCount)[0];
              return (
                <>
                  <div className="text-lg font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                    {topPatch?.assetTitle || 'N/A'}
                  </div>
                  <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {topPatch?.downloadCount ?? 0} downloads
                  </div>
                </>
              );
            })()}
          </div>
          
          <div className="rounded-lg p-6" style={{ backgroundColor: 'var(--color-secondary)' }}>
            <div className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>Top User</div>
            <div className="text-lg font-semibold truncate" style={{ color: 'var(--color-text)' }}>
              {stats.downloadsPerUser[0]?.username || 'N/A'}
            </div>
            <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {stats.downloadsPerUser[0]?.downloadCount || 0} downloads
            </div>
          </div>
          
          <div className="rounded-lg p-6" style={{ backgroundColor: 'var(--color-secondary)' }}>
            <div className="text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>Last 30 Days</div>
            <div className="text-3xl font-bold" style={{ color: 'var(--color-text)' }}>
              {stats.downloadsOverTime.reduce((sum, item) => sum + item.count, 0).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--color-secondary)' }}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>User ID</label>
            <input
              type="text"
              value={userIdFilter}
              onChange={(e) => {
                setUserIdFilter(e.target.value);
              }}
              placeholder="Filter by user ID"
              className="w-full px-3 py-2 rounded text-sm focus:outline-none"
              style={{ 
                backgroundColor: 'var(--color-primary)', 
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)'
              }}
            />
          </div>
          
          <div>
            <label className="block text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>Asset Type</label>
            <select
              value={assetTypeFilter}
              onChange={(e) => {
                setAssetTypeFilter(e.target.value as DownloadAssetType | 'all');
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded text-sm focus:outline-none"
              style={{
                backgroundColor: 'var(--color-primary)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
            >
              <option value="all">All</option>
              <option value="video">Video</option>
              <option value="document">Document</option>
              <option value="presentation">Presentation</option>
              <option value="patch">Patch</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>Asset ID</label>
            <input
              type="text"
              value={assetIdFilter}
              onChange={(e) => {
                setAssetIdFilter(e.target.value);
              }}
              placeholder="Filter by asset ID"
              className="w-full px-3 py-2 rounded text-sm focus:outline-none"
              style={{ 
                backgroundColor: 'var(--color-primary)', 
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)'
              }}
            />
          </div>
          
          <div>
            <label className="block text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded text-sm focus:outline-none"
              style={{ 
                backgroundColor: 'var(--color-primary)', 
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)'
              }}
            />
          </div>
          
          <div>
            <label className="block text-sm mb-2" style={{ color: 'var(--color-text-secondary)' }}>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded text-sm focus:outline-none"
              style={{ 
                backgroundColor: 'var(--color-primary)', 
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)'
              }}
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full px-4 py-2 rounded transition-colors"
              style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text)' }}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Downloads Table */}
      <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--color-secondary)' }}>
        <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h2 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Download History</h2>
          <div className="flex items-center space-x-2">
            <label className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Per page:</label>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-1 rounded text-sm focus:outline-none"
              style={{ 
                backgroundColor: 'var(--color-primary)', 
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)'
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-900 bg-opacity-50 text-red-200 border-l-4 border-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--color-accent)' }}></div>
            <p style={{ color: 'var(--color-text-secondary)' }}>Loading downloads...</p>
          </div>
        ) : downloads.length === 0 ? (
          <div className="p-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>
            No downloads found
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead style={{ backgroundColor: 'var(--color-hover)' }}>
                  <tr>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium uppercase cursor-pointer hover:opacity-80"
                      style={{ color: 'var(--color-text-secondary)' }}
                      onClick={() => handleSort('user')}
                    >
                      Name {sortBy === 'user' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium uppercase cursor-pointer hover:opacity-80"
                      style={{ color: 'var(--color-text-secondary)' }}
                      onClick={() => handleSort('video')}
                    >
                      Type {sortBy === 'video' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium uppercase cursor-pointer hover:opacity-80"
                      style={{ color: 'var(--color-text-secondary)' }}
                      onClick={() => handleSort('downloadedAt')}
                    >
                      Download Date {sortBy === 'downloadedAt' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                  {downloads
                    .filter((download) => download.user && download.asset)
                    .map((download) => {
                    const fullName = download.user.profile?.firstName && download.user.profile?.lastName
                      ? `${download.user.profile.firstName} ${download.user.profile.lastName}`
                      : download.user.username;
                    
                    return (
                      <tr key={download._id} className="transition-colors">
                        <td className="px-4 py-3 text-sm">
                          <div className="font-medium" style={{ color: 'var(--color-text)' }}>{fullName}</div>
                          <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{download.user.email}</div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {download.asset ? (
                            <>
                              <div className="font-medium" style={{ color: 'var(--color-text)' }}>
                                {download.asset.title}
                              </div>
                              <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                Type: {download.assetType.charAt(0).toUpperCase() + download.assetType.slice(1)}
                              </div>
                            
                            </>
                          ) : (
                            <div className="italic" style={{ color: 'var(--color-text-secondary)' }}>
                              Asset deleted
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                          {formatDate(download.downloadedAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--color-border)' }}>
                <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                  Showing {(currentPage - 1) * limit + 1} to {Math.min(currentPage * limit, total)} of {total} downloads
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text)' }}
                  >
                    Previous
                  </button>
                  <span style={{ color: 'var(--color-text)' }}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text)' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminDownloadDashboard;
