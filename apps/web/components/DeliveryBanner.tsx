"use client";
import { useEffect, useState } from "react";

const slides = [
  {
    photo: "/real-products/hero-parcel.webp",
    en: "Across Dhaka, from door to door.",
    bn: "ঢাকার এক দরজা থেকে আরেক দরজায়।",
    href: "/parcels",
    action: ["Get a parcel quote", "পার্সেলের খরচ দেখুন"],
  },
  {
    photo: "/real-products/hero-market.webp",
    en: "The market, closer to home.",
    bn: "ঘরের কাছেই আপনার বাজার।",
    href: "/groceries",
    action: ["Browse groceries", "বাজার দেখুন"],
  },
  {
    photo: "/real-products/fish-rohu.webp",
    en: "Whole, cleaned, or cut your way.",
    bn: "আস্ত, পরিষ্কার বা কাটা, আপনার পছন্দ।",
    href: "/groceries",
    action: ["Explore Fresh groceries", "তাজা পণ্য দেখুন"],
  },
];

export function DeliveryBanner({ bn }: { bn: boolean }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (paused || focused || hovered || reduced) return;
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % slides.length),
      6500,
    );
    return () => window.clearInterval(timer);
  }, [paused, focused, hovered, reduced]);
  const slide = slides[index];
  return (
    <section
      className="campaign"
      aria-label={bn ? "সেবার প্রচার" : "Delivery highlights"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <div
        className="campaign-picture"
        style={{ backgroundImage: "url(" + slide.photo + ")" }}
      />
      <div className="campaign-content">
        <p className="kicker">
          {bn ? "অর্ডার ও পিকআপের অনুরোধ" : "GROCERY & PICKUP REQUESTS"}
        </p>
        <h1>{bn ? slide.bn : slide.en}</h1>
        <a href={slide.href} className="primary">
          {slide.action[bn ? 1 : 0]} →
        </a>
      </div>
      <div className="campaign-controls">
        {slides.map((_, i) => (
          <button
            type="button"
            key={i}
            aria-label={(bn ? "স্লাইড " : "Slide ") + (i + 1)}
            aria-pressed={index === i}
            onClick={() => setIndex(i)}
          >
            {i + 1}
          </button>
        ))}
        {!reduced && (
          <button type="button" onClick={() => setPaused(!paused)}>
            {paused ? (bn ? "চালু করুন" : "Play") : bn ? "বিরতি" : "Pause"}
          </button>
        )}
      </div>
    </section>
  );
}
