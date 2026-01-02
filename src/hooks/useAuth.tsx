"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { createClient } from "../lib/supabase/client";
import {
  type User,
  type Session,
  type AuthChangeEvent,
} from "@supabase/supabase-js";
import {
  setEncryptionKey,
  clearEncryptionKey,
  deriveKeyFromPRF,
  deriveKeyFromPassword,
  getEncryptionKey,
} from "../lib/encryption";

type AuthMethod = "passkey" | "password" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  authMethod: AuthMethod;
  isLoading: boolean;
  hasEncryptionKey: boolean;
  signOut: () => Promise<void>;
  setEncryptionKeyFromPRF: (prfOutput: ArrayBuffer) => Promise<void>;
  setEncryptionKeyFromPassword: (
    password: string,
    salt: Uint8Array,
  ) => Promise<void>;
  setHasEncryptionKey: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authMethod, setAuthMethod] = useState<AuthMethod>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [encryptionKeySet, setEncryptionKeySet] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (currentSession) {
          setSession(currentSession);
          setUser(currentSession.user);

          // Check auth method from user metadata
          const method = currentSession.user.user_metadata
            ?.auth_method as AuthMethod;
          setAuthMethod(method || null);

          // Check if encryption key exists in storage
          const existingKey = await getEncryptionKey();
          if (existingKey) {
            setEncryptionKeySet(true);
            console.log("✅ Encryption key restored from storage");
          }
        }
      } catch (error) {
        console.error("Failed to get session:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, newSession: Session | null) => {
        console.log("Auth state changed:", event);

        if (newSession) {
          setSession(newSession);
          setUser(newSession.user);
          const method = newSession.user.user_metadata
            ?.auth_method as AuthMethod;
          setAuthMethod(method || null);
        } else {
          setSession(null);
          setUser(null);
          setAuthMethod(null);
          clearEncryptionKey();
          setEncryptionKeySet(false);
        }
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  // Sign out
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setAuthMethod(null);
    clearEncryptionKey();
    setEncryptionKeySet(false);
  }, [supabase.auth]);

  // Set encryption key from PRF output (passkey users)
  const setEncryptionKeyFromPRF = useCallback(
    async (prfOutput: ArrayBuffer) => {
      try {
        const key = await deriveKeyFromPRF(prfOutput);
        await setEncryptionKey(key);
        setEncryptionKeySet(true);
        console.log("✅ Encryption key derived from passkey PRF");
      } catch (error) {
        console.error("Failed to derive key from PRF:", error);
        throw error;
      }
    },
    [],
  );

  // Set encryption key from password (fallback users)
  const setEncryptionKeyFromPassword = useCallback(
    async (password: string, salt: Uint8Array) => {
      try {
        console.log("useAuth: Setting encryption key from password");
        const key = await deriveKeyFromPassword(password, salt);
        await setEncryptionKey(key);
        setEncryptionKeySet(true);
        console.log(
          "useAuth: Encryption key set successfully, encryptionKeySet = true",
        );
      } catch (error) {
        console.error("useAuth: Failed to derive key from password:", error);
        throw error;
      }
    },
    [],
  );

  // Allow external components to set the encryption key flag
  // (used when key wrapping is done in component)
  const setHasEncryptionKeyValue = useCallback((value: boolean) => {
    setEncryptionKeySet(value);
  }, []);

  const value: AuthContextType = {
    user,
    session,
    authMethod,
    isLoading,
    hasEncryptionKey: encryptionKeySet,
    signOut,
    setEncryptionKeyFromPRF,
    setEncryptionKeyFromPassword,
    setHasEncryptionKey: setHasEncryptionKeyValue,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
