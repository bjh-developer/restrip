"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowUpRightIcon } from "lucide-react";
import { PasskeyAuth } from "../../components/auth/PasskeyAuth";
import { EmailPasswordAuth } from "../../components/auth/EmailPasswordAuth";
import { usePasskeySupport } from "../../hooks/usePasskeySupport";
import { useAuth } from "../../hooks/useAuth";
import ShinyText from "../../components/ShinyText";
import ScrollReveal from "../../components/ScrollReveal";
import {
  Announcement,
  AnnouncementTag,
  AnnouncementTitle,
} from "../../components/ui/shadcn-io/announcement";
import {
  Banner,
  BannerAction,
  BannerClose,
  BannerIcon,
  BannerTitle,
} from "../../components/ui/shadcn-io/banner";
import { CircleAlert } from "lucide-react";

// Register ScrollTrigger plugin
try {
  gsap.registerPlugin(ScrollTrigger);
} catch {
  // Plugin already registered or registration failed
}

type AuthTab = "passkey" | "password";

const AnnouncementBanner = () => (
  <Banner>
    <BannerIcon icon={CircleAlert} />
    <BannerTitle>
      v2.0 is coming soon with exciting new features! e.g. a canvas to store
      your photo strip memories...
    </BannerTitle>
    <BannerAction
      onClick={() => {
        window.open("https://restrip.userjot.com/", "_blank");
      }}
    >
      Suggest a feature
    </BannerAction>
    <BannerClose />
  </Banner>
);

const AnnouncementPill = () => (
  <Announcement className="bg-sky-100 text-sky-700" themed>
    <AnnouncementTag>Info</AnnouncementTag>
    <AnnouncementTitle>
      Website under construction, functionalities limited
      <ArrowUpRightIcon className="shrink-0 opacity-70" size={16} />
    </AnnouncementTitle>
  </Announcement>
);

export default function AuthPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, hasEncryptionKey, signOut } = useAuth();
  const { passkeySupported, isLoading: supportLoading } = usePasskeySupport();
  const [activeTab, setActiveTab] = useState<AuthTab>("passkey");
  const [showEmailVerificationMessage, setShowEmailVerificationMessage] = useState(false);
  const [isPasskeyRegistration, setIsPasskeyRegistration] = useState(false);

  // Redirect to upload if fully authenticated
  useEffect(() => {
    if (user && hasEncryptionKey) {
      console.log('AuthPage: User fully authenticated, redirecting to /upload');
      router.push('/upload');
    }
  }, [user, hasEncryptionKey, router]);

  // Check if user came from email verification link
  useEffect(() => {
    const checkEmailVerification = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const type = hashParams.get('type');
      
      if (type === 'signup' || type === 'email') {
        setActiveTab("password");
        setShowEmailVerificationMessage(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      
      if (user?.user_metadata?.auth_method === 'password') {
        setActiveTab("password");
      }
    };
    
    checkEmailVerification();
  }, [user]);

  // Check for passkey registration hash
  useEffect(() => {
    const checkPasskeyRegistration = () => {
      setIsPasskeyRegistration(window.location.hash === '#passkey-registration');
    };

    checkPasskeyRegistration();

    const handleHashChange = () => {
      checkPasskeyRegistration();
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Load UserJot SDK
  useEffect(() => {
    const script1 = document.createElement("script");
    script1.innerHTML = `window.$ujq=window.$ujq||[];window.uj=window.uj||new Proxy({},{get:(_,p)=>(...a)=>window.$ujq.push([p,...a])});document.head.appendChild(Object.assign(document.createElement('script'),{src:'https://cdn.userjot.com/sdk/v2/uj.js',type:'module',async:!0}));`;
    document.head.appendChild(script1);

    const script2 = document.createElement("script");
    script2.innerHTML = `
      window.uj.init('cmjjzikhm01fr15o1n4jg1h93', {
        widget: true,
        position: 'right',
        theme: 'auto'
      });
    `;
    document.head.appendChild(script2);
    
    return () => {
      script1.remove();
      script2.remove();
    };
  }, []);

  // Show loading state
  if (authLoading || supportLoading) {
    return (
      <div className="min-h-screen bg-warm-beige flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  // User is authenticated but missing encryption key - show re-auth
  if (user && !hasEncryptionKey && !showEmailVerificationMessage) {
    if (isPasskeyRegistration) {
      return (
        <div className="min-h-screen bg-warm-beige">
          <AnnouncementBanner />
          <div className="container mx-auto px-4 py-16">
            <div className="text-center mb-12">
              <h1 className="font-display text-5xl md:text-6xl font-bold mb-3">
                ReStrip
              </h1>
              <ShinyText
                text="Photo strips that come back to you."
                disabled={false}
                speed={15}
                className="font-display text-3xl md:text-4xl font-semibold text-soft-black mb-4"
              />
            </div>
            <div className="w-full max-w-md mx-auto p-6">
              <PasskeyAuth onSuccess={() => router.push('/upload')} />
            </div>
          </div>
          <Footer />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-warm-beige">
        <AnnouncementBanner />
        <div className="container mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h1 className="font-display text-5xl md:text-6xl font-bold mb-3">
              ReStrip
            </h1>
            <ShinyText
              text="Photo strips that come back to you."
              disabled={false}
              speed={15}
              className="font-display text-3xl md:text-4xl font-semibold text-soft-black mb-4"
            />
          </div>

          <div className="w-full max-w-md mx-auto p-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Re-authenticate to Enter
              </h2>
              <p className="text-gray-600 text-sm">
                Your session is active but we need your passkey or password to
                decrypt your data.
              </p>
            </div>

            {passkeySupported && (user?.user_metadata?.auth_method === 'passkey' || user?.user_metadata?.auth_method === 'passkey_pending_verification') ? (
              <PasskeyAuth onSuccess={() => router.push('/upload')} />
            ) : !passkeySupported && (user?.user_metadata?.auth_method === 'passkey' || user?.user_metadata?.auth_method === 'passkey_pending_verification' || user?.user_metadata?.auth_method === 'password_and_passkey') ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <h3 className="text-sm font-semibold text-amber-900 mb-2">
                      Passkey Not Supported on This Device
                    </h3>
                    <p className="text-sm text-amber-800 mb-3">
                      Your account uses passkey authentication, but this device or browser doesn't support passkeys.
                    </p>
                    <div className="space-y-2 text-sm text-amber-700">
                      <p className="font-medium">What you can do:</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Try accessing your account from a supported device</li>
                        <li>Use a compatible browser (Chrome, Safari, Edge, or Firefox)</li>
                        <li>Contact support if you need to link a password</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <EmailPasswordAuth onSuccess={() => router.push('/upload')} signinOnly />
            )}

            <div className="mt-6 pt-4 border-t border-gray-200 text-center">
              <p className="text-xs text-gray-500 mb-2">
                Want to sign in with a different account?
              </p>
              <button
                onClick={async () => {
                  await signOut();
                }}
                className="text-sm text-gray-600 hover:text-gray-900 underline"
              >
                Sign out completely
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // User is not authenticated - show full auth UI
  const handleSuccess = () => {
    router.push('/upload');
  };

  return (
    <div className="min-h-screen bg-warm-beige">
      <AnnouncementBanner />
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="font-display text-5xl md:text-6xl font-bold mb-3">
            ReStrip
          </h1>
          <ShinyText
            text="Photo strips that come back to you."
            disabled={false}
            speed={15}
            className="font-display text-3xl md:text-4xl font-semibold text-soft-black mb-4"
          />
          <p className="font-body text-grey mb-6">
            Upload your photo strip, pick a future period, and we'll send you a
            surprise email then. That's it.
          </p>
          <AnnouncementPill />
        </div>

        <div className="w-full max-w-md mx-auto p-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold text-soft-black mb-2">
              Sign In/Up to Continue
            </h2>
            <p className="text-gray-600 text-sm">
              Passkey / Password blocks anyone (even us) from viewing your uploaded
              images.
            </p>
          </div>

          {/* Email verification success message */}
          {showEmailVerificationMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-xl">✅</span>
                <div>
                  <p className="text-sm font-medium text-green-900">
                    Email verified successfully!
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    Now sign in with your password to access your account.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab selector - only show if passkeys are supported */}
          {passkeySupported && (
            <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setActiveTab("passkey")}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition flex items-center justify-center gap-2 ${
                  activeTab === "passkey"
                    ? "bg-white text-gray-900 shadow"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <span>🔑</span>
                Passkey
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("password")}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition flex items-center justify-center gap-2 ${
                  activeTab === "password"
                    ? "bg-white text-gray-900 shadow"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <span>🔒</span>
                Email/Password
              </button>
            </div>
          )}

          {/* Passkey recommendation badge */}
          {passkeySupported && activeTab === "passkey" && (
            <div className="mb-4 flex items-center justify-center">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                ✓ Recommended
              </span>
            </div>
          )}

          {/* Auth components */}
          {passkeySupported && activeTab === "passkey" ? (
            <PasskeyAuth onSuccess={handleSuccess} />
          ) : (
            <EmailPasswordAuth onSuccess={handleSuccess} />
          )}

          {/* Security info */}
          <div className="mt-8 pt-6 border-t border-soft-black">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              🔐 How your data is protected
            </h3>
            <ul className="space-y-2 text-xs text-gray-500">
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>
                  Images are Zero-Knowledge Encrypted on your device before upload
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Encryption keys never leave your device</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Even we cannot see your uploaded images</span>
              </li>
              {passkeySupported && (
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✓</span>
                  <span>Passkeys use hardware security for maximum protection</span>
                </li>
              )}
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>
                  If you lose your passkey or password, you will lose access to your
                  data. That's the cost of true privacy.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* About Section */}
        <div className="max-w-2xl mx-auto mt-6">
          <div className="text-center bg-white rounded-lg shadow-card hover:shadow-card-hover p-8 transition-shadow">
            <ScrollReveal
              baseOpacity={0}
              enableBlur={true}
              baseRotation={0}
              blurStrength={10}
            >
              We live in a world where memories are fleeting, photo strips pile
              up, and feelings fade. ReStrip slows time down. You capture a
              moment today and, months later, it comes back to make you smile.
              ReStrip is a time machine for your happiest moments.
            </ScrollReveal>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-soft-black text-warm-beige py-8">
      <div className="container mx-auto px-4 text-center">
        <p className="text-sm">
          &copy; {new Date().getFullYear()} ReStrip, made with ❤️, by{" "}
          <a
            href="https://www.linkedin.com/in/bek-joon-hao/"
            className="hover:underline transition-all hover:text-pastel-blue"
          >
            Joon Hao
          </a>
          .
        </p>
        <div className="mt-4 flex justify-center space-x-4">
          <a
            href="/privacy-policy"
            className="text-warm-beige hover:underline"
          >
            Privacy Policy
          </a>
          <a href="/contact" className="text-warm-beige hover:underline">
            Contact Us
          </a>
        </div>
      </div>
    </footer>
  );
}
