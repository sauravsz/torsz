import React from "react";
import {
  X,
  SearchCheck,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ArrowRight,
  Database,
  Layers,
  Copy,
  Check,
} from "lucide-react";

export interface QueryPlanStep {
  id: number;
  parent: number;
  detail: string;
}

export interface IndexRecommendation {
  tableName: string;
  columnName?: string;
  sql: string;
  reason: string;
  estimatedImpact: "High" | "Medium" | "Low";
}

interface SqlProfilerModalProps {
  isOpen: boolean;
  onClose: () => void;
  querySql: string;
  planSteps: QueryPlanStep[];
  onApplyIndexSql: (indexSql: string) => void;
}

export const SqlProfilerModal: React.FC<SqlProfilerModalProps> = ({
  isOpen,
  onClose,
  querySql,
  planSteps,
  onApplyIndexSql,
}) => {
  const [copiedSql, setCopiedSql] = React.useState<string | null>(null);

  if (!isOpen) return null;

  // Analyze plan steps for unindexed table scans and generate index suggestions
  const recommendations: IndexRecommendation[] = [];
  const hasFullTableScan = planSteps.some((s) => s.detail.toLowerCase().includes("scan table"));

  for (const step of planSteps) {
    const detail = step.detail.toLowerCase();
    if (detail.includes("scan table")) {
      const match = step.detail.match(/SCAN TABLE\s+["`]?([A-Za-z0-9_]+)["`]?/i);
      const tableName = match ? match[1] : "table";

      // Extract filtered columns from query if possible
      const whereMatch = querySql.match(/WHERE\s+([A-Za-z0-9_.]+)/i);
      const joinMatch = querySql.match(/ON\s+[A-Za-z0-9_.]+\.([A-Za-z0-9_]+)\s*=/i);
      const candidateCol = whereMatch ? whereMatch[1].split(".").pop() : joinMatch ? joinMatch[1] : "id";

      recommendations.push({
        tableName,
        columnName: candidateCol,
        sql: `CREATE INDEX IF NOT EXISTS idx_${tableName}_${candidateCol} ON "${tableName}"("${candidateCol}");`,
        reason: `Full table scan detected on '${tableName}'. Creating a B-Tree index avoids O(N) linear iteration.`,
        estimatedImpact: "High",
      });
    }
  }

  // If already optimal
  if (recommendations.length === 0 && !hasFullTableScan) {
    recommendations.push({
      tableName: "Optimal",
      sql: "-- Query is already utilizing primary keys / indexed lookups.",
      reason: "Execution plan uses index seeks / covered B-Trees.",
      estimatedImpact: "Low",
    });
  }

  const handleCopy = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedSql(sql);
    setTimeout(() => setCopiedSql(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150 text-ink">
      <div className="bg-surface-card border border-hairline w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-hairline flex items-center justify-between bg-surface-soft shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <SearchCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-editorial-serif text-xl font-medium text-ink">
                SQL Execution Plan & Index Advisor
              </h3>
              <p className="text-xs text-muted">
                SQLite B-Tree query profiling and automated index optimization recommendations.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-muted hover:text-ink hover:bg-surface-cream rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 select-text">
          {/* Query Summary Box */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Profiled Query:
            </span>
            <pre className="p-3 bg-canvas border border-hairline rounded-xl text-xs font-mono text-ink overflow-x-auto leading-relaxed">
              {querySql}
            </pre>
          </div>

          {/* Execution Plan Tree */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span>Execution Steps (EXPLAIN QUERY PLAN):</span>
            </span>

            <div className="bg-canvas border border-hairline rounded-xl p-3 space-y-2 font-mono text-xs">
              {planSteps.length === 0 ? (
                <p className="text-muted italic">No execution steps recorded.</p>
              ) : (
                planSteps.map((step, idx) => {
                  const isScan = step.detail.toLowerCase().includes("scan table");
                  const isIndex = step.detail.toLowerCase().includes("using index") || step.detail.toLowerCase().includes("using primary key");

                  return (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                        isScan
                          ? "bg-warning/10 border-warning/30 text-ink"
                          : isIndex
                          ? "bg-success/10 border-success/30 text-ink"
                          : "bg-surface-card border-hairline text-body"
                      }`}
                    >
                      {isScan ? (
                        <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                      ) : isIndex ? (
                        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                      ) : (
                        <ArrowRight className="w-4 h-4 text-muted shrink-0" />
                      )}
                      <span className="font-semibold">{step.detail}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Automated Index Recommendations */}
          <div className="space-y-2.5">
            <span className="text-[11px] font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              <span>Recommended Index Optimizations:</span>
            </span>

            <div className="space-y-3">
              {recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="bg-canvas border border-hairline rounded-xl p-4 shadow-2xs space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-primary" />
                      <span className="font-bold text-xs text-ink">{rec.tableName}</span>
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        rec.estimatedImpact === "High"
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "bg-success/10 text-success border-success/20"
                      }`}
                    >
                      Impact: {rec.estimatedImpact}
                    </span>
                  </div>

                  <p className="text-xs text-body leading-relaxed">{rec.reason}</p>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-hairline-soft">
                    <pre className="font-mono text-xs text-primary font-semibold truncate flex-1">
                      {rec.sql}
                    </pre>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleCopy(rec.sql)}
                        className="p-1.5 text-muted hover:text-ink hover:bg-surface-cream rounded-md border border-hairline transition-colors"
                        title="Copy Index SQL"
                      >
                        {copiedSql === rec.sql ? (
                          <Check className="w-3.5 h-3.5 text-success" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {rec.estimatedImpact !== "Low" && (
                        <button
                          onClick={() => {
                            onApplyIndexSql(rec.sql);
                            onClose();
                          }}
                          className="flex items-center gap-1 bg-primary hover:bg-primary-active text-on-primary text-xs font-semibold px-3 py-1 rounded-lg transition-colors shadow-2xs"
                        >
                          <Zap className="w-3 h-3 fill-current" />
                          <span>Apply Index</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-hairline bg-surface-soft flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-body hover:text-ink transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
