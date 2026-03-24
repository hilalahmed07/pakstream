import React from 'react';

type VerificationHeaderProps = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
};

type VerificationSearchProps = {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (next: string) => void;
};

type VerificationTabLayoutProps = {
  header: VerificationHeaderProps;
  search: VerificationSearchProps;
  table: React.ReactNode;
  stats?: React.ReactNode;
};

const VerificationHeaderCard: React.FC<VerificationHeaderProps> = ({ icon = '🔒', title, description }) => {
  return (
    <div
      className="rounded-lg p-6 shadow-md border"
      style={{
        backgroundColor: 'rgba(59, 130, 246, 0.12)',
        borderColor: 'rgba(59, 130, 246, 0.35)',
      }}
    >
      <div className="flex items-center gap-4">
        <div
          className="h-12 w-12 rounded-lg flex items-center justify-center text-2xl"
          style={{ backgroundColor: 'rgba(0,0,0,0.25)' }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-xl font-bold truncate" style={{ color: 'var(--color-text)' }}>
            {title}
          </h3>
          {description && (
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const VerificationSearchCard: React.FC<VerificationSearchProps> = ({ label, placeholder, value, onChange }) => {
  return (
    <div className="p-6 rounded-lg shadow-sm border" style={{ backgroundColor: 'var(--color-secondary)', borderColor: 'var(--color-border)' }}>
      <label className="block text-xs font-bold uppercase tracking-widest mb-3 opacity-70" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 rounded-lg outline-none border transition-all focus:ring-2"
          style={{
            backgroundColor: 'var(--color-primary)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text)',
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            '--tw-ring-color': 'var(--color-accent)',
          } as React.CSSProperties}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
      </div>
    </div>
  );
};

const VerificationTableShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="rounded-lg overflow-hidden border shadow-sm" style={{ backgroundColor: 'var(--color-secondary)', borderColor: 'var(--color-border)' }}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
};

const VerificationTabLayout: React.FC<VerificationTabLayoutProps> & {
  HeaderCard: typeof VerificationHeaderCard;
  SearchCard: typeof VerificationSearchCard;
  TableShell: typeof VerificationTableShell;
} = ({ header, search, table, stats }) => {
  return (
    <div className="space-y-6">
      <VerificationHeaderCard {...header} />
      <VerificationSearchCard {...search} />
      <VerificationTableShell>{table}</VerificationTableShell>
      {stats ? <div>{stats}</div> : null}
    </div>
  );
};

VerificationTabLayout.HeaderCard = VerificationHeaderCard;
VerificationTabLayout.SearchCard = VerificationSearchCard;
VerificationTabLayout.TableShell = VerificationTableShell;

export default VerificationTabLayout;

