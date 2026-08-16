import { EmptyState, ErrorState, LoadingBlock, Pagination } from './ui';

/**
 * Generic table used by every module.
 * columns: [{ key, header, render?, className?, hideOn? }]
 */
export default function DataTable({
  columns,
  rows,
  loading,
  error,
  onRetry,
  pagination,
  onPageChange,
  emptyTitle = 'No records found',
  emptyDescription,
  emptyAction,
  rowKey = (row) => row.id,
  toolbar,
}) {
  return (
    <div className="card overflow-hidden">
      {toolbar && (
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
          {toolbar}
        </div>
      )}

      {loading && <LoadingBlock />}

      {!loading && error && (
        <div className="p-4">
          <ErrorState message={error} onRetry={onRetry} />
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      )}

      {!loading && !error && rows.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.key} className={col.className}>
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={rowKey(row)}>
                    {columns.map((col) => (
                      <td key={col.key} className={col.className}>
                        {col.render ? col.render(row) : row[col.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={pagination} onPageChange={onPageChange} />
        </>
      )}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }) {
  return (
    <input
      type="search"
      className="input sm:max-w-xs"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      aria-label={placeholder}
    />
  );
}
