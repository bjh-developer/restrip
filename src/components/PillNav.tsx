"use client";

import React, { useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";

export interface PillNavItem {
  label: string;
  href: string;
}

interface PillNavProps {
  items: PillNavItem[];
  className?: string;
  ease?: string;
  baseColor?: string;
  pillColor?: string;
  hoveredPillTextColor?: string;
  pillTextColor?: string;
  theme?: "light" | "dark";
  initialLoadAnimation?: boolean;
}

interface PillAnimationState {
  circle: HTMLSpanElement | null;
  timeline: gsap.core.Timeline | null;
  activeTween: gsap.core.Tween | null;
}

export default function PillNav({
  items,
  className = "",
  ease = "power3.easeOut",
  baseColor = "#1c1c1c",
  pillColor = "#ffffff",
  hoveredPillTextColor = "#1c1c1c",
  pillTextColor = "#1c1c1c",
  theme = "light",
  initialLoadAnimation = true,
}: PillNavProps) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const navItemsRef = useRef<HTMLDivElement>(null);
  const pillStatesRef = useRef<Map<number, PillAnimationState>>(new Map());
  const isMobileMenuOpenRef = useRef(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const isLight = theme === "light";
  const bgColor = isLight ? "#FEFCF8" : "#1f2937";

  const mobileLoginItem = useMemo(
    () => items.find((item) => item.label.toLowerCase() === "login"),
    [items]
  );

  // Memoize derived item data to avoid recalculation on every render
  const itemData = useMemo(() => {
    return items.map((item, i) => ({
      ...item,
      isActive: pathname === item.href,
      isFirst: i === 0,
      isLogin:
        item.label.toLowerCase().includes("login") ||
        item.href.toLowerCase().includes("login"),
    }));
  }, [items, pathname]);

  // Build or rebuild GSAP timelines for hover effects
  const buildTimelines = useCallback(() => {
    pillStatesRef.current.forEach((state, i) => {
      if (!state.circle?.parentElement) return;

      const pill = state.circle.parentElement as HTMLElement;
      const rect = pill.getBoundingClientRect();
      const { width: w, height: h } = rect;

      // Calculate circle dimensions for pill hover fill effect
      const R = ((w * w) / 4 + h * h) / (2 * h);
      const D = Math.ceil(2 * R) + 2;
      const delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (w * w) / 4))) + 1;
      const originY = D - delta;

      state.circle.style.width = `${D}px`;
      state.circle.style.height = `${D}px`;
      state.circle.style.bottom = `-${delta}px`;

      gsap.set(state.circle, {
        xPercent: -50,
        scale: 0,
        transformOrigin: `50% ${originY}px`,
      });

      const label = pill.querySelector<HTMLElement>(".pill-label");
      const white = pill.querySelector<HTMLElement>(".pill-label-hover");

      if (label) gsap.set(label, { y: 0 });
      if (white) {
        gsap.set(white, { y: Math.ceil(h + 100), opacity: 0 });
      }

      state.timeline?.kill();
      const tl = gsap.timeline({ paused: true });

      tl.to(state.circle, { scale: 1.2, xPercent: -50, duration: 2, ease, overwrite: "auto" }, 0);

      if (label) {
        tl.to(label, { y: -(h + 8), duration: 2, ease, overwrite: "auto" }, 0);
      }

      if (white) {
        tl.to(white, { y: 0, opacity: 1, duration: 2, ease, overwrite: "auto" }, 0);
      }

      state.timeline = tl;
    });
  }, [ease]);

  useEffect(() => {
    buildTimelines();

    let resizeTimeout: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(buildTimelines, 100);
    };

    window.addEventListener("resize", onResize);

    if (document.fonts?.ready) {
      document.fonts.ready.then(buildTimelines).catch(() => {});
    }

    const menu = mobileMenuRef.current;
    if (menu) {
      gsap.set(menu, { visibility: "hidden", opacity: 0, scaleY: 1 });
    }

    if (initialLoadAnimation) {
      const nav = navRef.current;
      const navItems = navItemsRef.current;

      if (nav) {
        gsap.fromTo(nav, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease });
      }

      if (navItems) {
        gsap.fromTo(navItems, { width: 0, overflow: "hidden" }, { width: "auto", duration: 0.6, ease });
      }
    }

    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(resizeTimeout);
      // Kill all timelines on unmount
      pillStatesRef.current.forEach((state) => state.timeline?.kill());
    };
  }, [items, ease, initialLoadAnimation, buildTimelines]);

  const handleEnter = useCallback((i: number) => {
    const state = pillStatesRef.current.get(i);
    if (!state?.timeline) return;

    state.activeTween?.kill();
    state.activeTween = state.timeline.tweenTo(state.timeline.duration(), {
      duration: 0.3,
      ease,
      overwrite: "auto",
    });
  }, [ease]);

  const handleLeave = useCallback((i: number) => {
    const state = pillStatesRef.current.get(i);
    if (!state?.timeline) return;

    state.activeTween?.kill();
    state.activeTween = state.timeline.tweenTo(0, {
      duration: 0.2,
      ease,
      overwrite: "auto",
    });
  }, [ease]);

  const toggleMobileMenu = () => {
    const newState = !isMobileMenuOpenRef.current;
    isMobileMenuOpenRef.current = newState;

    const hamburger = hamburgerRef.current;
    const menu = mobileMenuRef.current;

    if (hamburger) {
      const lines = hamburger.querySelectorAll(".hamburger-line");
      if (newState) {
        gsap.to(lines[0], { rotation: 45, y: 3, duration: 0.3, ease });
        gsap.to(lines[1], { rotation: -45, y: -3, duration: 0.3, ease });
      } else {
        gsap.to(lines[0], { rotation: 0, y: 0, duration: 0.3, ease });
        gsap.to(lines[1], { rotation: 0, y: 0, duration: 0.3, ease });
      }
    }

    if (menu) {
      if (newState) {
        gsap.set(menu, { visibility: "visible" });
        gsap.fromTo(
          menu,
          { opacity: 0, y: 10, scaleY: 1 },
          {
            opacity: 1,
            y: 0,
            scaleY: 1,
            duration: 0.3,
            ease,
            transformOrigin: "top center",
          }
        );
      } else {
        gsap.to(menu, {
          opacity: 0,
          y: 10,
          scaleY: 1,
          duration: 0.2,
          ease,
          transformOrigin: "top center",
          onComplete: () => {
            gsap.set(menu, { visibility: "hidden" });
          },
        });
      }
    }
  };

  return (
    <div className="pill-nav-container relative">
      <nav
        ref={navRef}
        className={`pill-nav relative inline-flex items-center px-4 py-2 rounded-full shadow-lg w-[90vw] md:w-auto md:inline-flex ${className}`}
        aria-label="Primary"
        style={{
          backgroundColor: bgColor,
        }}
      >
        <div className="pill-nav-items hidden md:flex items-center gap-4" ref={navItemsRef}>
          <ul className="pill-list flex items-center gap-2" role="menubar">
            {itemData.map((item, i) => (
              <li key={item.href} role="none">
                <Link
                  role="menuitem"
                  href={item.href}
                  className={`
                    pill relative inline-flex items-center justify-center overflow-hidden
                    px-3 py-1. font-medium rounded-full whitespace-nowrap
                    ${item.isFirst ? "text-2xl font-bold font-display" : `text-sm ${["About", "Blog", "Contact", "Login"].includes(item.label) ? "font-sans" : "font-display"}`}
                    ${item.isActive ? "is-active" : ""}
                    ${item.isLogin ? "bg-gray-200 hover:bg-transparent transition-colors duration-200" : ""}
                  `}
                  onMouseEnter={() => handleEnter(i)}
                  onMouseLeave={() => handleLeave(i)}
                  style={{ color: item.isFirst ? baseColor : pillTextColor }}
                >
                  <span
                    className="hover-circle absolute left-1/2 rounded-full pointer-events-none"
                    aria-hidden="true"
                    ref={(el) => {
                      const state = pillStatesRef.current.get(i) ?? { circle: null, timeline: null, activeTween: null };
                      state.circle = el;
                      pillStatesRef.current.set(i, state);
                    }}
                    style={{ backgroundColor: pillColor }}
                  />
                  <span className="label-stack relative flex flex-col items-center">
                    <span className="pill-label">{item.label}</span>
                    <span
                      className="pill-label-hover absolute top-0 left-0 right-0 text-center"
                      aria-hidden="true"
                      style={{ color: hoveredPillTextColor }}
                    >
                      {item.label}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex md:hidden items-center justify-between w-full">
          {/* Left: Hamburger */}
          <button
            className="mobile-menu-button flex flex-col justify-center items-center w-8 h-8 gap-1.5"
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
            ref={hamburgerRef}
          >
            <span
              className="hamburger-line w-6 h-0.5 rounded-full"
              style={{ backgroundColor: baseColor }}
            />
            <span
              className="hamburger-line w-6 h-0.5 rounded-full"
              style={{ backgroundColor: baseColor }}
            />
          </button>
          
          {/* Center: ReStrip */}
          <span 
            className="font-display text-xl font-bold absolute left-1/2 -translate-x-1/2"
            style={{ color: baseColor }}
          >
            ReStrip
          </span>
          
          {/* Right: Login */}
          {mobileLoginItem && (
            <Link
              href="/auth"
              className="px-3 py-1.5 text-sm font-medium rounded-full bg-gray-200 hover:bg-transparent transition-colors duration-200"
              style={{ color: pillTextColor }}
            >
              Login
            </Link>
          )}
        </div>
      </nav>

      <div
        className="mobile-menu-popover md:hidden absolute top-full left-0 right-0 mt-2 mx-4 rounded-2xl shadow-xl overflow-hidden z-50"
        ref={mobileMenuRef}
        style={{
          backgroundColor: bgColor,
          visibility: 'hidden',
          opacity: 0,
        }}
      >
        <ul className="mobile-menu-list flex flex-col p-4">
          {items.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`
                    mobile-menu-link block px-4 py-3 rounded-lg font-medium
                    ${isActive ? "is-active bg-white/50" : ""}
                    hover:bg-white/30
                  `}
                  // Close the popover on navigation (feels more native on mobile).
                  onClick={() => {
                    isMobileMenuOpenRef.current = false;
                  }}
                  style={{ color: pillTextColor }}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
