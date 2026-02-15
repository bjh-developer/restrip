import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-warm-beige via-blush-pink/20 to-yellow-cream flex items-center justify-center px-4">
      <SignIn
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
