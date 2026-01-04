"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Clock, Heart } from "lucide-react";
import { PasskeyAuth } from "../../../../../components/auth/PasskeyAuth";
import { EmailPasswordAuth } from "../../../../../components/auth/EmailPasswordAuth";
import { usePasskeySupport } from "../../../../../hooks/usePasskeySupport";
import { useAuth } from "../../../../../hooks/useAuth";

type AuthTab = "passkey" | "password";

const MEMORY_QUOTES = [
  "Take care of all your memories. For you cannot relive them. — Bob Dylan",
  "How do you want to be remembered? — Michael Hyatt",
  "Memories, the one thing that can never be taken away from us. Make lots of them! — Catherine Pulsifer",
  "Sometimes you will never know the value of a moment, until it becomes a memory. — Dr. Seuss",
  "Some memories are realities, and are better than anything that can ever happen to one again. — Willa Cather",
  "A good life is a collection of happy memories. — Dennis Waitley",
  "It’s never too late to have a happy childhood. — Tom Robbins",
  "My family legacy is mainly memories, so I especially cherish my few tangible mementos. — Maureen Killoran",
  "Of all that I have possessed in my life, my memories are the only things remaining to me. Indeed, I believe that memories are the only real treasure any human can hope to hold always. — Gary Jennings",
  "Memories warm you up from the inside. But they also tear you apart. — Haruki Murakami",
  "When you are gone, the only truly important thing you will leave behind are the memories you’ve created. How do you want to be remembered? — Michael Hyatt",
  "What greater thing is there for two human souls, than to feel that they are joined for life — to strengthen each other in all labor, to rest on each other in all sorrow, to minister to each other in all pain, to be one with each other in silent unspeakable memories at the moment of the last parting? — George Eliot",
  "Memories are the treasures that we keep locked deep within the storehouse of our souls, to keep our hearts warm when we are lonely. — Becky Aligada",
  "We do not remember days, we remember moments. — Cesare Pavese",
  "Sweet is the memory of distant friends. Like the mellow rays departing the sun, it falls tenderly, yet sadly, on the heart. — Washington Irving",
  "There are memories that time does not erase... Forever does not make loss forgettable, only bearable. — Cassandra Clare",
  "Memory is the diary that we all carry about with us. — Oscar Wilde",
  "The worst part of holding the memories is not the pain. It's the loneliness of it. Memories need to be shared. — Lois Lowry",
  "Without memory, there is no healing. Without forgiveness, there is no future. — Desmond Tutu",
  "When our memories outweigh our dreams, we have grown old. — Bill Clinton",
  "The next best thing to the enjoyment of a good time is the recollection of it. — James Lendall Basford",
  "Nothing is ever really lost to us as long as we remember it. — L. M. Montgomery",
  "Time moves in one direction, memory in another. — William Gibson",
  "Life is like a garden. Perfect moments can be had, but not preserved, except in memory. — Leonard Sweet",
  "Yesterday is but today’s memory, tomorrow is today’s dream. — Khalil Gibran",
  "The only real treasure is in your head. Memories are better than diamonds and nobody can steal them from you. — Nikola Tesla",
  "For some life lasts a short while, but the memories it holds last forever. — Laura Swenson",
  "Our memories are the only paradise from which we can never be expelled. — Jean Paul",
  "You never know when you’re making a memory. — Rickie Lee Jones",
  "Be careful who you make memories with. Those things can last a lifetime. — Ugo Eze",
  "Memory is the scribe of the soul. — Aristotle",
  "Memory is the mother of all wisdom. — Aeschylus",
  "Everybody needs his memories. They keep the wolf of insignificance from the door. — Saul Bellow",
  "The past beats inside me like a second heart. — John Banville",
  "Every man’s memory is his private literature. — Aldous Huxley",
  "There is nothing like an odor to stir memories. — Jeanine Engle",
  "Memory is a crazy woman that hoards colored rags and throws away food. — Austin O'Malley",
  "The beautiful thing about memories is that they are yours; whether they are good, bad, or indifferent. — Unknown",
  "When someone you love becomes a memory, that memory becomes a treasure. — Unknown"
];


export default function MemoryAuthPage() {
  const router = useRouter();
  const params = useParams();
  const { user, isLoading: authLoading, hasEncryptionKey } = useAuth();
  const { passkeySupported, isLoading: supportLoading } = usePasskeySupport();
  const [activeTab, setActiveTab] = useState<AuthTab>("passkey");
  const [randomQuote] = useState(() => 
    MEMORY_QUOTES[Math.floor(Math.random() * MEMORY_QUOTES.length)]
  );

  // Redirect to memory if fully authenticated
  useEffect(() => {
    if (user && hasEncryptionKey && params.id) {
      console.log(
        `MemoryAuthPage: User authenticated, redirecting to memory ${params.id}`
      );
      router.push(`/memory/${params.id}`);
    }
  }, [user, hasEncryptionKey, router, params.id]);

  // Set default tab based on passkey support
  useEffect(() => {
    if (!supportLoading && !passkeySupported) {
      setActiveTab("password");
    }
  }, [passkeySupported, supportLoading]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-warm-beige via-blush-pink/20 to-yellow-cream flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

  // Don't render if authenticated (will redirect)
  if (user && hasEncryptionKey) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-warm-beige via-blush-pink/20 to-yellow-cream flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Redirecting...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-warm-beige via-blush-pink/20 to-yellow-cream">
      <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-screen">
        <div className="max-w-md w-full">
          {/* Header with nostalgic feel */}
          <div className="text-center mb-8 space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blush-pink/30 rounded-full mb-4 animate-pulse">
              <Heart className="w-8 h-8 text-soft-black" fill="currentColor" />
            </div>
            <h1 className="font-display text-4xl font-bold text-soft-black">
              Welcome Back!
            </h1>
            <p className="text-gray-600 text-lg">
              A memory awaits for you...
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span>Sign in to reveal your photo strip</span>
            </div>
          </div>

          {/* Auth Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-blush-pink/20">
            {/* Tab Switcher */}
            {passkeySupported && (
              <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab("passkey")}
                  className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${
                    activeTab === "passkey"
                      ? "bg-white text-soft-black shadow-sm"
                      : "text-gray-600 hover:text-soft-black"
                  }`}
                >
                  Passkey
                </button>
                <button
                  onClick={() => setActiveTab("password")}
                  className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${
                    activeTab === "password"
                      ? "bg-white text-soft-black shadow-sm"
                      : "text-gray-600 hover:text-soft-black"
                  }`}
                >
                  Password
                </button>
              </div>
            )}

            {/* Auth Forms */}
            <div className="space-y-4">
              {activeTab === "passkey" && passkeySupported && (
                <PasskeyAuth />
              )}
              {activeTab === "password" && <EmailPasswordAuth signinOnly={true} />}
            </div>
          </div>

          {/* Bottom message */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600 italic">
              "{randomQuote}"
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="pb-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-gray-600">
            &copy; {new Date().getFullYear()} ReStrip · Memories that come back
            to you
          </p>
        </div>
      </footer>
    </div>
  );
}
