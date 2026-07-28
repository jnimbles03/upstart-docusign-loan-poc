import ApplyWizard from "./wizard";
import type { LoanType } from "@/lib/types";

export default function ApplyPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const initialType: LoanType = searchParams.type === "auto" ? "auto" : "personal";
  return <ApplyWizard initialType={initialType} />;
}
