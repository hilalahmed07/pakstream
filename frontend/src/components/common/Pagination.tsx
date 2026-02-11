import React from 'react';

export interface PaginationInfo {
  current: number;
  pages: number;
  total: number;
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  total: number;
  limit?: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  total,
  limit = 10,
  onPageChange,
  loading = false,
}) => {
  if (totalPages <= 1 && total <= limit) {
    return null;
  }

  const startItem = total === 0 ? 0 : (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, total);

  const getPageNumbers = (): (number | 'ellipsis')[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | 'ellipsis')[] = [];
    if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, 'ellipsis', totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, 'ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages);
    }
    return pages;
  };

  return (
    <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {total > 0 ? (
          <>Showing {startItem}-{endItem} of {total}</>
        ) : (
          <>No items</>
        )}
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1 || loading}
          className="px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:opacity-90"
          style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text)' }}
        >
          Previous
        </button>
        <div className="flex items-center space-x-1">
          {getPageNumbers().map((page, idx) =>
            page === 'ellipsis' ? (
              <span key={`ellipsis-${idx}`} className="px-2" style={{ color: 'var(--color-text-secondary)' }}>
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                disabled={loading}
                className={`min-w-[36px] px-3 py-2 rounded-lg transition-colors ${
                  currentPage === page ? 'font-semibold' : 'hover:opacity-90'
                }`}
                style={{
                  backgroundColor: currentPage === page ? 'var(--color-accent)' : 'var(--color-hover)',
                  color: currentPage === page ? 'var(--color-accent-text)' : 'var(--color-text)',
                }}
              >
                {page}
              </button>
            )
          )}
        </div>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || loading}
          className="px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:opacity-90"
          style={{ backgroundColor: 'var(--color-hover)', color: 'var(--color-text)' }}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default Pagination;
