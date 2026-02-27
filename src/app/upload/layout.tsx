import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://www.restrip.app/upload",
  },
};

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen">{children}</div>;
}
