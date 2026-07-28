import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Upstart x DocuSign — On-Demand Loan Underwriting POC",
  description:
    "Self-service borrower webform → Upstart Credit Decision → DocuSign Document Prep → Workspaces → multi-envelope eSign. Consumer personal & auto loans.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
