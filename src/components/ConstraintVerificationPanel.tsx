import React from "react";
import { CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { LpProblem, LpSolution } from "../services/or/types";

interface ConstraintVerificationPanelProps {
  problem: LpProblem;
  solution: LpSolution;
}

export const ConstraintVerificationPanel: React.FC<ConstraintVerificationPanelProps> = ({
  problem,
  solution,
}) => {
  const varMap = new Map<string, number>();
  solution.variableValues.forEach((v, idx) => {
    varMap.set(v.name, v.value);
    varMap.set(`x${idx + 1}`, v.value);
    varMap.set(`x_${idx + 1}`, v.value);
  });

  const varNames = problem.variableNames || problem.objectiveCoefficients.map((_, i) => `x${i + 1}`);

  const rows = problem.constraints.map((c, i) => {
    let lhs = 0;
    const terms: string[] = [];

    c.coefficients.forEach((coef, varIdx) => {
      const vName = varNames[varIdx] || `x${varIdx + 1}`;
      const vVal = solution.variableValues[varIdx]?.value || 0;
      lhs += coef * vVal;

      if (Math.abs(coef) > 1e-6) {
        const coefStr = coef === 1 ? "" : coef === -1 ? "-" : `${coef}`;
        terms.push(`${coefStr}${vName}`);
      }
    });

    const roundedLhs = Math.round(lhs * 1000) / 1000;
    const formulaStr = terms.length > 0 ? terms.join(" + ").replace(/\+ -/g, "- ") : "0";

    let isSatisfied = false;
    const tol = 1e-4;
    if (c.operator === "<=") {
      isSatisfied = roundedLhs <= c.rhs + tol;
    } else if (c.operator === ">=") {
      isSatisfied = roundedLhs >= c.rhs - tol;
    } else {
      isSatisfied = Math.abs(roundedLhs - c.rhs) <= tol;
    }

    const slackOrSurplus = Math.abs(c.rhs - roundedLhs);
    const isBinding = Math.abs(slackOrSurplus) < tol;
    const opDisplay = c.operator === "<=" ? "≤" : c.operator === ">=" ? "≥" : "=";

    return {
      index: i + 1,
      formulaStr,
      lhs: roundedLhs,
      opDisplay,
      rhs: c.rhs,
      isSatisfied,
      isBinding,
      slackOrSurplus: Math.round(slackOrSurplus * 1000) / 1000,
      operator: c.operator,
    };
  });

  const allSatisfied = rows.every((r) => r.isSatisfied);

  return (
    <div className="bg-surface-card border border-hairline rounded-2xl p-5 shadow-sm space-y-3 animate-keyframe-fade-up text-ink">
      <div className="flex items-center justify-between border-b border-hairline pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className={`w-4 h-4 ${allSatisfied ? "text-success" : "text-error"}`} />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-ink">
            Constraint Verification & Feasibility Check
          </h4>
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            allSatisfied
              ? "bg-success/10 text-success border-success/30"
              : "bg-error/10 text-error border-error/30"
          }`}
        >
          {allSatisfied ? "All Constraints Satisfied" : "Infeasible / Violations Detected"}
        </span>
      </div>

      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.index}
            className="p-3 bg-canvas border border-hairline rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {r.isSatisfied ? (
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-error shrink-0" />
              )}
              <span className="font-mono text-muted font-bold text-[11px]">C{r.index}:</span>
              <span className="font-mono text-ink text-[12px] truncate">
                {r.formulaStr} = <strong className="text-primary font-bold">{r.lhs}</strong> {r.opDisplay} {r.rhs}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] shrink-0 font-mono">
              {r.isBinding ? (
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-semibold">
                  Binding (Slack = 0)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-surface-soft text-muted border border-hairline">
                  {r.operator === "<=" ? "Slack" : "Surplus"}: {r.slackOrSurplus}
                </span>
              )}

              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  r.isSatisfied ? "text-success bg-success/10" : "text-error bg-error/10"
                }`}
              >
                {r.isSatisfied ? "PASS" : "FAIL"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
