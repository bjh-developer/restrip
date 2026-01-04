"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "../../../../hooks/useAuth";
import {
  getEncryptionKey,
  decryptImage,
  decryptDataAsString,
} from "../../../../lib/encryption";
import { createClient } from "../../../../lib/supabase/client";
import { Spinner } from "../../../../components/ui/shadcn-io/spinner";

interface SnapMetadata {
  id: string;
  storage_path: string;
  encrypted_caption: string;
  caption_iv: string;
  image_iv: string;
  send_date: string;
  send_time: string;
  delivery_method: string;
  period_type: string;
  delivered: boolean;
  delivered_at: string | null;
  created_at: string;
}

export default function MemoryPage() {
  const router = useRouter();
  const params = useParams();
  const { user, signOut, hasEncryptionKey, isLoading: authLoading } = useAuth();

  const [snap, setSnap] = useState<SnapMetadata | null>(null);
  const [decryptedImage, setDecryptedImage] = useState<string | null>(null);
  const [decryptedCaption, setDecryptedCaption] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Redirect to auth if not authenticated, with memory-specific login page
  useEffect(() => {
    if (!authLoading && (!user || !hasEncryptionKey)) {
      console.log("MemoryPage: Not fully authenticated, redirecting to memory auth");
      setIsRedirecting(true);
      router.push(`/memory/${params.id}/auth`);
    }
  }, [user, hasEncryptionKey, authLoading, router, params.id]);

  // Fetch and decrypt snap
  useEffect(() => {
    const fetchAndDecryptSnap = async () => {
      // Early return if auth is loading, user not authenticated, or redirecting
      if (authLoading || !user || !hasEncryptionKey || !params.id || isRedirecting) return;

      try {
        setIsLoading(true);
        setError(null);

        // Fetch snap metadata from API
        const response = await fetch(`/api/snaps/${params.id}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch memory");
        }

        const snapData: SnapMetadata = await response.json();
        setSnap(snapData);

        // Get encryption key
        const encryptionKey = await getEncryptionKey();
        if (!encryptionKey) {
          throw new Error(
            "Encryption key not available. Please sign in again."
          );
        }

        // Download encrypted image from Supabase Storage
        const supabase = createClient();
        const { data: imageData, error: downloadError } = await supabase.storage
          .from("encrypted-images")
          .download(snapData.storage_path);

        if (downloadError || !imageData) {
          throw new Error("Failed to download encrypted image");
        }

        // Convert blob to base64 (chunked to avoid stack overflow)
        const arrayBuffer = await imageData.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const base64 = btoa(binary);

        // Decrypt image
        const decryptedImg = await decryptImage(
          base64,
          snapData.image_iv,
          encryptionKey
        );
        setDecryptedImage(decryptedImg);

        // Decrypt caption
        const decryptedCap = await decryptDataAsString(
          snapData.encrypted_caption,
          snapData.caption_iv,
          encryptionKey
        );
        setDecryptedCaption(decryptedCap);

        console.log("✅ Memory decrypted successfully");
      } catch (err) {
        console.error("Failed to decrypt memory:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load memory"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndDecryptSnap();
  }, [user, hasEncryptionKey, params.id, authLoading, isRedirecting]);

  // Handle sign out
  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-warm-beige flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!user || !hasEncryptionKey) {
    return (
      <div className="min-h-screen bg-warm-beige flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Redirecting...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-warm-beige via-blush-pink/20 to-yellow-cream">
      {/* Header */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* User info bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between bg-white rounded-lg px-4 py-2 shadow-sm">
              <span className="text-sm text-gray-600">
                Signed in as <span className="font-medium">{user.email}</span>
              </span>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </div>
          </div>

          {/* Memory Card */}
          <div className="bg-white rounded-lg shadow-card p-8">
            {/* Loading State */}
            {isLoading && (
              <>
                <h1 className="font-display text-4xl font-bold mb-6 text-center text-soft-black">
                  Your Memory
                </h1>
                <div className="flex flex-col items-center justify-center py-12">
                  <Spinner
                    variant="pinwheel"
                    className="text-pastel-blue mb-4"
                    size={64}
                    style={{ width: "64px", height: "64px" }}
                  />
                  <p className="text-gray-500">Decrypting your memory...</p>
                </div>
              </>
            )}

            {/* Error State */}
            {error && !isLoading && (
              <>
                <h1 className="font-display text-4xl font-bold mb-6 text-center text-soft-black">
                  Your Memory
                </h1>
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-center">{error}</p>
                </div>
              </>
            )}

            {/* Success State */}
            {!isLoading && !error && decryptedImage && snap && (
              <div className="space-y-6">
                <h1 className="font-display text-4xl font-bold mb-6 text-center text-soft-black">
                  On {new Date(snap.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </h1>
                {/* Image */}
                <div className="flex justify-center">
                  <img
                    src={decryptedImage}
                    alt="Your memory"
                    className="max-w-full max-h-[600px] object-contain rounded-lg shadow-md"
                  />
                </div>

                {/* Caption */}
                {decryptedCaption && (
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <p className="text-gray-700 whitespace-pre-wrap text-center">
                      {decryptedCaption}
                    </p>
                  </div>
                )}

                {/* Back button */}
                <div className="pt-4">
                  <button
                    onClick={() => router.push("/upload")}
                    className="w-full bg-pastel-blue text-soft-black rounded-md py-3 font-body font-semibold hover:bg-blush-pink transition-all"
                  >
                    Create Another Memory
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
