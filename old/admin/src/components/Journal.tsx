import type { JournalRow, TimelineRow } from '@/lib/data/types';

export const Journal = ({ rows }: { rows: JournalRow[] }) => (
  <table className="jl">
    <thead>
      <tr>
        <th>Account</th>
        <th className="r">Debit</th>
        <th className="r">Credit</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((j, i) => (
        <tr key={i}>
          <td>{j.account}</td>
          <td className="r">{j.dr}</td>
          <td className="r">{j.cr}</td>
        </tr>
      ))}
    </tbody>
  </table>
);

export const Timeline = ({ rows }: { rows: TimelineRow[] }) => (
  <ol className="audit">
    {rows.map((e, i) => (
      <li key={i}>
        <span className="num mono" style={{ color: 'var(--text-3)' }}>
          {e.at}
        </span>
        <span>{e.text}</span>
      </li>
    ))}
  </ol>
);
