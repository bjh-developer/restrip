import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://www.restrip.app/sign-up",
  },
};

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-warm-beige via-blush-pink/20 to-yellow-cream flex items-center justify-center px-4">
      <SignUp
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-card rounded-2xl",
          },
        }}
      />
    </div>
  );
}
