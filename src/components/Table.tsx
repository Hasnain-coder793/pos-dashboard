import type { TableProps } from "@/types";

export default function Table({ headers, children, empty }: TableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-secondary shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-linear-to-r from-blue-50 to-slate-100">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 font-semibold whitespace-nowrap">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 [&_td]:px-4 [&_td]:py-3">
          {empty ? (
            <tr>
              <td colSpan={headers.length} className="text-center text-slate-600">
                Nothing to show
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}
