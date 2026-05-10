'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { PhoneMockup } from './PhoneMockup';
import { WineyTitle } from '@/components/winey/Typography';

const STEPS = [
  {
    id: 'setup',
    title: 'The Host',
    description: "It starts with a host. Configure the tasting: how many players, how many bottles, and how many rounds. It's your party, your rules.",
    image: '/images/1. Setup Tasting - Sized-portrait.png',
  },
  {
    id: 'wine-list',
    title: 'The Bottles',
    description: "Input the real wines (hidden from players) and give them fun nicknames like 'Velvet Thunder' or 'Napa Gold'. Set the price to build the challenge.",
    image: '/images/2. Wine List - Sized-portrait.png',
  },
  {
    id: 'organize',
    title: 'The Flight',
    description: "Assign bottles to rounds manually or let the app randomize them for you. Mix high-end with budget bottles to confuse the palate.",
    image: '/images/3. Organize Wines - Sized-portrait.png',
  },
  {
    id: 'lobby',
    title: 'The Gathering',
    description: "Share the game code. Players join from their own phones—no app download required. Just a browser and a thirst.",
    image: '/images/4. Lobby - Sized-portrait.png',
  },
  {
    id: 'tasting',
    title: 'The Tasting',
    description: "Pour the wines. Players taste blindly, taking notes on aroma and flavor before the big decision.",
    image: '/images/6. Round 1 of 3 (With Text) - Sized-portrait.png',
  },
  {
    id: 'ranking',
    title: 'The Ranking',
    description: "The core mechanic: Rank the wines from most to least expensive. Trust your gut (or your wallet).",
    image: '/images/5. Round 1 of 3 (Without Text) - Sized-portrait.png', // Swapped order slightly for flow, actually 6 is better for tasting, 5 is blank. Let's stick to 6 for the "Ranking" visual as it looks populated.
  },
  {
    id: 'reveal',
    title: 'The Reveal',
    description: "Round over. The app reveals the true order and prices. Did 'Velvet Thunder' cost $80 or $12? Instant gratification (or shame).",
    image: '/images/7. Round 3 of 5 Results - Sized-portrait.png',
  },
  {
    id: 'leaderboard',
    title: 'The Score',
    description: "Points are awarded for every correct placement. Watch the live leaderboard shift after every round.",
    image: '/images/8. Leaderboard - Sized-portrait.png',
  },
  {
    id: 'recap',
    title: 'The Memory',
    description: "At the end, get a personalized recap of what you tasted, what you liked, and how you performed. A souvenir for your palate.",
    image: '/images/9. Your Tasting Recap - Sized-portrait.png',
  },
];

export function ScrollShowcase() {
  const [activeStep, setActiveStep] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Simple intersection observer to detect which text block is active
  useEffect(() => {
    const observers = STEPS.map((_, index) => {
      const element = document.getElementById(`step-${index}`);
      if (!element) return null;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            setActiveStep(index);
          }
        },
        { threshold: 0.5, rootMargin: '-20% 0px -20% 0px' }
      );

      observer.observe(element);
      return observer;
    });

    return () => {
      observers.forEach((obs) => obs?.disconnect());
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
      <div className="lg:grid lg:grid-cols-2 lg:gap-16 items-start">
        {/* Sticky Phone Display (Desktop) */}
        <div className="hidden lg:block sticky top-24 h-[calc(100vh-12rem)] flex items-center justify-center">
          <div className="relative w-full max-w-[360px]">
            {STEPS.map((step, index) => (
              <motion.div
                key={step.id}
                className="absolute inset-0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ 
                  opacity: activeStep === index ? 1 : 0,
                  x: activeStep === index ? 0 : 20,
                  scale: activeStep === index ? 1 : 0.95
                }}
                transition={{ duration: 0.5 }}
              >
                <PhoneMockup src={step.image} alt={step.title} priority={index < 2} />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Scrollable Text Steps */}
        <div className="space-y-24 lg:space-y-0 lg:py-[20vh]">
          {STEPS.map((step, index) => (
            <div
              key={step.id}
              id={`step-${index}`}
              className="flex flex-col justify-center min-h-[50vh] lg:min-h-[80vh] transition-opacity duration-500"
              style={{ opacity: typeof window !== 'undefined' && window.innerWidth >= 1024 ? (activeStep === index ? 1 : 0.3) : 1 }}
            >
              {/* Mobile-only image */}
              <div className="lg:hidden mb-8">
                 <PhoneMockup src={step.image} alt={step.title} />
              </div>

              <div className="max-w-lg mx-auto lg:mx-0">
                <span className="text-[color:var(--winey-title)] font-bold text-sm tracking-widest uppercase mb-2 block">
                  Step 0{index + 1}
                </span>
                <WineyTitle className="text-3xl sm:text-4xl mb-4">{step.title}</WineyTitle>
                <p className="text-[color:var(--winey-muted)] text-lg leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

