import React, { useState } from 'react';
import { AuditReport } from '@/lib/agent/types';
import { ShieldCheck, ShieldAlert, Shield, ChevronDown, ChevronUp } from 'lucide-react';

interface AuditCardProps {
  audit: AuditReport;
}

export function AuditCard({ audit }: AuditCardProps) {
  const [expanded, setExpanded] = useState(false);

  const colors = {
    trustworthy: { text: 'text-green-500' },
    caution: { text: 'text-yellow-500' },
    unreliable: { text: 'text-red-500' },
  };

  const icons = {
    trustworthy: ShieldCheck,
    caution: ShieldAlert,
    unreliable: Shield,
  };

  const VerdictIcon = icons[audit.overallVerdict];
  const colorScheme = colors[audit.overallVerdict];
  const hasFindings = Object.values(audit.findings).some(arr => arr.length > 0) || audit.citationVerification.failed > 0;

  return (
    <div className="mt-3 rounded-lg overflow-hidden animate-fade-in">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 bg-[#0a0a0a] border border-[#222] rounded hover:bg-[#111] transition-colors"
      >
        <div className="flex items-center gap-2">
          {VerdictIcon && <VerdictIcon size={14} className={colorScheme.text} />}
          <span className="font-semibold text-sm text-gray-200 capitalize">
            {audit.overallVerdict} Answer
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[10px] uppercase tracking-wider font-mono px-2 py-1 bg-black rounded border border-[#333] text-gray-400">
            {audit.citationVerification.verified} / {audit.citationVerification.total} verified
          </div>
          {expanded ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
        </div>
      </button>

      {expanded && (
        <div className="p-4 border-x border-b border-[#222] bg-[#000] rounded-b text-sm">
          <p className="text-gray-300 mb-4 leading-relaxed">{audit.summary}</p>
          
          <div className="space-y-4">
            <div className="border-t border-[#222] pt-3">
              <h4 className="font-bold text-[10px] uppercase tracking-widest text-gray-500 mb-3">Citation Verification <span className="font-normal text-gray-600">Programmatic</span></h4>
              <div className="grid grid-cols-3 gap-2 mb-2 text-xs">
                <div className="bg-black/30 p-2 rounded flex flex-col items-center">
                  <span className="text-lg font-mono text-blue-400">{audit.citationVerification.total}</span>
                  <span className="opacity-70">Total</span>
                </div>
                <div className="bg-black/30 p-2 rounded flex flex-col items-center">
                  <span className="text-lg font-mono text-green-400">{audit.citationVerification.verified}</span>
                  <span className="opacity-70">Verified</span>
                </div>
                <div className="bg-black/30 p-2 rounded flex flex-col items-center">
                  <span className="text-lg font-mono text-red-400">{audit.citationVerification.failed}</span>
                  <span className="opacity-70">Failed</span>
                </div>
              </div>
              {audit.citationVerification.failed > 0 && (
                <div className="text-xs mt-2 text-red-300">
                  Failed citations:
                  <ul className="list-disc pl-4 mt-1 opacity-80">
                    {audit.citationVerification.details
                      .filter(c => c.verdict === 'invalid')
                      .map((c, i) => <li key={i}>{c.citation.raw} - {c.reason}</li>)}
                  </ul>
                </div>
              )}
            </div>

            <div className="border-t border-[#222] pt-3">
              <h4 className="font-bold text-[10px] uppercase tracking-widest text-gray-500 mb-3">AI Findings <span className="font-normal text-gray-600">Gemini Pro</span></h4>
              {!hasFindings && <div className="text-xs opacity-70 italic text-gray-400">No significant issues found.</div>}
              
              {audit.findings.hallucinations.length > 0 && (
                <div className="mb-3">
                  <h5 className="text-red-400 text-xs font-semibold mb-1">Hallucinations:</h5>
                  <ul className="list-disc pl-4 text-gray-400 space-y-1">
                    {audit.findings.hallucinations.map((h, i) => <li key={i}>{h}</li>)}
                  </ul>
                </div>
              )}
              {audit.findings.contradictions.length > 0 && (
                <div className="mb-3">
                  <h5 className="text-orange-400 text-xs font-semibold mb-1">Contradictions:</h5>
                  <ul className="list-disc pl-4 text-gray-400 space-y-1">
                    {audit.findings.contradictions.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              )}
              {audit.findings.logicalGaps.length > 0 && (
                <div className="mb-3">
                  <h5 className="text-yellow-400 text-xs font-semibold mb-1">Logical Gaps:</h5>
                  <ul className="list-disc pl-4 text-gray-400 space-y-1">
                    {audit.findings.logicalGaps.map((h, i) => <li key={i}>{h}</li>)}
                  </ul>
                </div>
              )}
              {audit.findings.riskyAdvice.length > 0 && (
                <div className="mb-3">
                  <h5 className="text-yellow-400 text-xs font-semibold mb-1">Risky Advice:</h5>
                  <ul className="list-disc pl-4 text-gray-400 space-y-1">
                    {audit.findings.riskyAdvice.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              )}
              {audit.findings.overConfidence.length > 0 && (
                <div>
                  <strong className="text-blue-400">Over-confidence:</strong>
                  <ul className="list-disc pl-4 opacity-90">{audit.findings.overConfidence.map((f, i) => <li key={i}>{f}</li>)}</ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
