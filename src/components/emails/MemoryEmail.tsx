/**
 * Memory Delivery Email Template
 *
 * React component used by Resend to render the email HTML.
 * Matches the existing ReStrip brand (warm beige, soft black, blush pink).
 *
 * @module components/emails/MemoryEmail
 */

import * as React from "react";

interface MemoryEmailProps {
  caption?: string;
}

export function MemoryEmail({ caption }: MemoryEmailProps) {
  return (
    <div
      style={{
        margin: 0,
        padding: 0,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif",
        backgroundColor: "#F3E8D8",
      }}
    >
      <table
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        style={{ backgroundColor: "#F3E8D8" }}
      >
        <tbody>
          <tr>
            <td align="center" style={{ padding: "40px 20px" }}>
              <table
                width="100%"
                cellPadding={0}
                cellSpacing={0}
                style={{
                  maxWidth: "600px",
                  backgroundColor: "#ffffff",
                  borderRadius: "12px",
                  overflow: "hidden",
                  boxShadow: "0 2px 8px rgba(28, 28, 28, 0.08)",
                }}
              >
                <tbody>
                  {/* Header */}
                  <tr>
                    <td
                      align="center"
                      style={{
                        padding: "40px 24px",
                        backgroundColor: "#1C1C1C",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "32px",
                          fontWeight: 700,
                          color: "#F3E8D8",
                          letterSpacing: "-0.5px",
                        }}
                      >
                        ReStrip
                      </div>
                      <div
                        style={{
                          fontSize: "14px",
                          color: "#EBEBEB",
                          marginTop: "6px",
                          fontWeight: 300,
                          letterSpacing: "0.5px",
                        }}
                      >
                        Photo strips that come back to you.
                      </div>
                    </td>
                  </tr>

                  {/* Body */}
                  <tr>
                    <td style={{ padding: "48px 40px" }}>
                      <p
                        style={{
                          margin: "0 0 24px 0",
                          fontSize: "18px",
                          color: "#1C1C1C",
                          lineHeight: "1.5",
                          fontWeight: 500,
                        }}
                      >
                        A memory from your past! 🤗
                      </p>
                      {caption && (
                        <p
                          style={{
                            margin: "0 0 28px 0",
                            fontSize: "16px",
                            color: "#6B6B6B",
                            lineHeight: "1.7",
                            fontStyle: "italic",
                          }}
                        >
                          &ldquo;{caption}&rdquo;
                        </p>
                      )}
                      <p
                        style={{
                          margin: "24px 0 0 0",
                          fontSize: "14px",
                          color: "#6B6B6B",
                          textAlign: "center" as const,
                        }}
                      >
                        Your photo strip is attached to this email
                      </p>
                    </td>
                  </tr>

                  {/* Footer */}
                  <tr>
                    <td
                      style={{
                        padding: "28px 40px",
                        borderTop: "1px solid #EBEBEB",
                        backgroundColor: "#F3E8D8",
                      }}
                    >
                      <p
                        style={{
                          margin: "0 0 12px 0",
                          fontSize: "13px",
                          color: "#6B6B6B",
                          textAlign: "center" as const,
                        }}
                      >
                        ReStrip &bull; Photo strips that come back
                        to you.
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "12px",
                          color: "#6B6B6B",
                          textAlign: "center" as const,
                        }}
                      >
                        <a
                          href="https://restrip.app/privacy-policy"
                          style={{
                            color: "#1C1C1C",
                            textDecoration: "none",
                            fontWeight: 500,
                          }}
                        >
                          Privacy Policy
                        </a>{" "}
                        &bull;{" "}
                        <a
                          href="https://restrip.app/contact"
                          style={{
                            color: "#1C1C1C",
                            textDecoration: "none",
                            fontWeight: 500,
                          }}
                        >
                          Contact Us
                        </a>
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
