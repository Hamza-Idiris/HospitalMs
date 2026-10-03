import { openFile } from '../api';
import { Badge, dt } from './ui';

const Files = ({ files = [], hospitalId }) => files.length ? (
  <div className="mt-3 flex flex-wrap gap-2">{files.map((f) => <button key={f.filename} className="btn-ghost btn-sm" onClick={() => openFile(hospitalId, f.filename)}>{f.originalName}</button>)}</div>
) : null;

export function LabResultView({ result, hospitalId }) {
  return (
    <div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-500"><th className="py-1 pr-3">Test</th><th className="pr-3">Result</th><th className="pr-3">Unit</th><th className="pr-3">Reference range</th><th>Flag</th></tr></thead>
        <tbody>{result.items.map((i, n) => <tr key={n} className="border-t border-slate-100"><td className="py-1.5 pr-3 font-medium">{i.name}</td><td className="pr-3">{i.result}</td><td className="pr-3">{i.unit}</td><td className="pr-3">{i.range}</td><td>{i.flag && <Badge value={i.flag} />}</td></tr>)}</tbody></table></div>
      {result.notes && <p className="mt-2 text-sm"><span className="text-slate-500">Technician notes: </span>{result.notes}</p>}
      <p className="mt-1 text-xs text-slate-500">Reported {dt(result.resultDate)}{result.technician?.name ? ` by ${result.technician.name}` : ''}</p>
      <Files files={result.attachments} hospitalId={hospitalId} />
    </div>
  );
}
export function XrayReportView({ report, hospitalId }) {
  return (
    <div className="space-y-2 text-sm">
      {report.bodyPart && <p><span className="text-slate-500">Body part: </span>{report.bodyPart}</p>}
      <p><span className="text-slate-500">Findings: </span><span className="whitespace-pre-wrap">{report.findings}</span></p>
      {report.impression && <p><span className="text-slate-500">Impression: </span><span className="whitespace-pre-wrap">{report.impression}</span></p>}
      {report.technicalNotes && <p><span className="text-slate-500">Technical notes: </span>{report.technicalNotes}</p>}
      <p className="text-xs text-slate-500">Reported {dt(report.reportDate)}{report.technician?.name ? ` by ${report.technician.name}` : ''}</p>
      <Files files={report.attachments} hospitalId={hospitalId} />
    </div>
  );
}
