import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset Password - ReStrip",
  description: "Reset your password to regain access to your ReStrip account",
};

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
