import type { TableProps } from "@/types";

export default function Table({ headers, children, empty }: TableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-neutral-50">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3 font-semibold whitespace-nowrap">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 [&_td]:px-4 [&_td]:py-3">
          {empty ? (
            <tr>
              <td colSpan={headers.length} className="text-center text-neutral-500">
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
