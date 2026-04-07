import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Calculator Salariu 2026 — Calcul Salariu Net/Brut Romania",
  description:
    "Calculator salariu net, brut și cost angajator pentru România 2026. Deducere personală, tichete de masă, scutiri impozit. Conform Codului Fiscal Art. 77.",
  keywords: [
    "calculator salariu",
    "salariu net",
    "salariu brut",
    "calcul salariu romania",
    "deducere personala",
    "cod fiscal 2026",
    "tichete de masa",
    "cost angajator",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
