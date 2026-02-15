"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Spinner } from "../../../../components/ui/shadcn-io/spinner";

interface SnapData {
  id: string;
  storage_path: string;
  caption: string;
  image_url: string | null;
  send_date: string;
  send_time: string;
  delivery_method: string;
  period_type: string;
  delivery_status: string;
  created_at: string;
}

export default function MemoryPage() {
  const router = useRouter();
  const params = useParams();

  const [snap, setSnap] = useState<SnapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load UserJot SDK
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_USERJOT_KEY;
    if (!apiKey) return;

    const script1 = document.createElement("script");
    script1.innerHTML = `window.$ujq=window.$ujq||[];window.uj=window.uj||new Proxy({},{get:(_,p)=>(...a)=>window.$ujq.push([p,...a])});document.head.appendChild(Object.assign(document.createElement('script'),{src:'https://cdn.userjot.com/sdk/v2/uj.js',type:'module',async:!0}));`;
    document.head.appendChild(script1);

    const script2 = document.createElement("script");
    script2.innerHTML = `
      window.uj.init('${apiKey}', {
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

  // Fetch snap data from API
  useEffect(() => {
    const fetchSnap = async () => {
      if (!params.id) return;

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/snaps/${params.id}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch memory");
        }

        const snapData: SnapData = await response.json();
        setSnap(snapData);
      } catch (err) {
        console.error("Failed to load memory:", err);
        setError(err instanceof Error ? err.message : "Failed to load memory");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSnap();
  }, [params.id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-warm-beige via-blush-pink/20 to-yellow-cream">
      {/* Header */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {/* User info bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between bg-white rounded-lg px-4 py-2 shadow-sm">
              <span className="text-sm text-gray-600 font-medium">
                Your Memory
              </span>
              <UserButton afterSignOutUrl="/" />
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
                  <p className="text-gray-500">Loading your memory...</p>
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
            {!isLoading && !error && snap && (
              <div className="space-y-6">
                <h1 className="font-display text-4xl font-bold mb-6 text-center text-soft-black">
                  On{" "}
                  {new Date(snap.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </h1>
                {/* Image */}
                {snap.image_url && (
                  <div className="flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={snap.image_url}
                      alt="Your memory"
                      className="max-w-full max-h-[600px] object-contain rounded-lg shadow-md"
                    />
                  </div>
                )}

                {/* Caption */}
                {snap.caption && (
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <p className="text-gray-700 whitespace-pre-wrap text-center font-caption">
                      {snap.caption}
                    </p>
                  </div>
                )}

                {/* Back button */}
                <div className="pt-4">
                  <button
                    onClick={() => router.push("/new")}
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
