/**
 * One-time data migration: encrypt existing plaintext scrapbook data
 *
 * Reads all rows where encrypted_title / encrypted_elements are still empty
 * (i.e. rows that existed before migration 020), encrypts the plaintext values
 * using the same AES-256-GCM key as the API, and writes back the ciphertext.
 *
 * Run AFTER applying migration 020 and BEFORE applying migration 021.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   ENCRYPTION_SECRET=... \
 *   npx tsx scripts/migrate-scrapbook-encryption.ts
 */

import { createClient } from "@supabase/supabase-js";
import { encryptData } from "../src/lib/simple-encryption";

// ---------------------------------------------------------------------------
// Validate env vars up front
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const encryptionSecret = process.env.ENCRYPTION_SECRET;

if (!supabaseUrl || !serviceRoleKey || !encryptionSecret) {
  console.error(
    "Missing required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_SECRET",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// ---------------------------------------------------------------------------
// Migrate scrapbook_books.title → encrypted_title + title_iv
// ---------------------------------------------------------------------------
async function migrateBookTitles(key: string): Promise<void> {
  const { data: books, error } = await supabase
    .from("scrapbook_books")
    .select("id, title")
    .eq("encrypted_title", ""); // only rows not yet migrated

  if (error) throw new Error(`Failed to fetch books: ${error.message}`);
  if (!books || books.length === 0) {
    console.log("  No unencrypted book titles found — skipping.");
    return;
  }

  console.log(`  Encrypting ${books.length} book title(s)...`);
  for (const book of books) {
    const plaintext = typeof book.title === "string" && book.title.trim()
      ? book.title.trim()
      : "Untitled Book";
    const { encrypted, iv } = await encryptData(plaintext, key);

    const { error: updateErr } = await supabase
      .from("scrapbook_books")
      .update({ encrypted_title: encrypted, title_iv: iv })
      .eq("id", book.id);

    if (updateErr) {
      console.error(`  ERROR encrypting book ${book.id}: ${updateErr.message}`);
    } else {
      console.log(`  ✓ Book ${book.id} ("${plaintext}")`);
    }
  }
}

// ---------------------------------------------------------------------------
// Migrate scrapbook_pages.elements → encrypted_elements + elements_iv
// ---------------------------------------------------------------------------
async function migratePageElements(key: string): Promise<void> {
  const { data: pages, error } = await supabase
    .from("scrapbook_pages")
    .select("id, elements")
    .eq("encrypted_elements", ""); // only rows not yet migrated

  if (error) throw new Error(`Failed to fetch pages: ${error.message}`);
  if (!pages || pages.length === 0) {
    console.log("  No unencrypted page elements found — skipping.");
    return;
  }

  console.log(`  Encrypting ${pages.length} page element set(s)...`);
  for (const page of pages) {
    const plaintext = JSON.stringify(Array.isArray(page.elements) ? page.elements : []);
    const { encrypted, iv } = await encryptData(plaintext, key);

    const { error: updateErr } = await supabase
      .from("scrapbook_pages")
      .update({ encrypted_elements: encrypted, elements_iv: iv })
      .eq("id", page.id);

    if (updateErr) {
      console.error(`  ERROR encrypting page ${page.id}: ${updateErr.message}`);
    } else {
      console.log(`  ✓ Page ${page.id}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const key = encryptionSecret!;

  console.log("=== Scrapbook encryption migration ===\n");

  console.log("[1/2] Books (scrapbook_books.title)");
  await migrateBookTitles(key);

  console.log("\n[2/2] Pages (scrapbook_pages.elements)");
  await migratePageElements(key);

  console.log("\nDone. You can now apply migration 021_scrapbook_drop_plaintext.sql");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
