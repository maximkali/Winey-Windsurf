'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Wine, Users, Trophy, Sparkles, ArrowRight, ChevronDown } from 'lucide-react';

// ============================================================================
// HERO SECTION
// ============================================================================
function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20">
      {/* Background Elements - contained in own overflow-hidden wrapper */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-[10%] left-[5%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[color:var(--winey-title)]/20 to-transparent blur-[100px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-tl from-[color:var(--winey-danger)]/15 to-transparent blur-[80px]" />
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-8 sm:py-12 lg:py-0">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-8 items-center">
          
          {/* Left: Text Content */}
          <motion.div 
            className="text-center lg:text-left z-10"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[color:var(--winey-card-tan)]/60 border border-[color:var(--winey-border)] mb-4 sm:mb-6">
              <Sparkles className="w-4 h-4 text-[color:var(--winey-title)]" />
              <span className="text-sm font-medium text-[color:var(--winey-muted-2)]">The ultimate taste test</span>
            </div>

            <h1 className="font-serif text-4xl sm:text-6xl lg:text-7xl xl:text-8xl font-semibold tracking-tight leading-[0.95]">
              <span className="text-[color:var(--winey-muted-2)]">Blind</span>
              <br />
              <span className="text-gradient-gold">Tasting,</span>
              <br />
              <span className="text-[color:var(--winey-muted-2)] italic">Perfected.</span>
            </h1>

            <p className="mt-6 sm:mt-8 text-base sm:text-xl text-[color:var(--winey-muted)] max-w-xl mx-auto lg:mx-0 leading-relaxed">
              Host blind wine tastings with friends. Rank by price, compete for points, and discover who has the most refined palate.
            </p>

            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link href="/host/setup">
                <Button className="btn-shine w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg font-semibold shadow-[var(--winey-shadow-sm)] hover:shadow-[var(--winey-shadow-lg)] hover:translate-y-[-2px] transition-all duration-300">
                  Host a Tasting
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/player/join">
                <Button variant="neutral" className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg font-semibold border-2 hover:bg-[color:var(--winey-card-tan)] transition-all duration-300">
                  Join Game
                </Button>
              </Link>
            </div>

            {/* Social proof hint */}
            <div className="mt-8 sm:mt-12 flex items-center justify-center lg:justify-start text-xs sm:text-sm text-[color:var(--winey-muted)]">
              <span>Free to play. No app download required. Scroll down for an overview.</span>
            </div>
          </motion.div>

          {/* Right: Phone Mockups - Three phones: Wine List (back left), Lobby (front center), Round (back right) */}
          <motion.div 
            className="relative h-[300px] sm:h-[500px] lg:h-[680px] flex items-center justify-center overflow-visible"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            {/* Extra padding wrapper to prevent shadow clipping */}
            <div className="relative w-full h-full flex items-center justify-center p-6 overflow-visible">
              {/* Back Left - Wine List (portrait, tilted counterclockwise) */}
              <motion.div 
                className="absolute w-[75px] sm:w-[150px] lg:w-[210px] z-10 left-[8%] sm:left-[5%] lg:left-[0%] top-[22%] sm:top-[15%] lg:top-[12%] overflow-visible"
                style={{ rotate: '-8deg' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
                  className="overflow-visible"
                >
                  <Image
                    src="/images/2. Wine List - Sized-portrait.png"
                    alt="Wine list"
                    width={1179}
                    height={2556}
                    sizes="(max-width: 640px) 75px, (max-width: 1024px) 150px, 210px"
                    className="drop-shadow-[0_8px_25px_rgba(0,0,0,0.1)]"
                  />
                </motion.div>
              </motion.div>

              {/* Front Center - Lobby (portrait, straight, largest) */}
              <motion.div 
                className="absolute w-[110px] sm:w-[200px] lg:w-[290px] z-30 left-1/2 -translate-x-1/2 top-[10%] sm:top-[2%] lg:top-[0%] overflow-visible"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ repeat: Infinity, duration: 6, ease: "easeInOut", delay: 0.2 }}
                  className="overflow-visible"
                >
                  <Image
                    src="/images/4. Lobby - Sized-portrait.png"
                    alt="Game lobby"
                    width={1179}
                    height={2556}
                    priority
                    sizes="(max-width: 640px) 110px, (max-width: 1024px) 200px, 290px"
                    className="drop-shadow-[0_12px_35px_rgba(0,0,0,0.12)]"
                  />
                </motion.div>
              </motion.div>

              {/* Back Right - Round (portrait, tilted clockwise) */}
              <motion.div 
                className="absolute w-[75px] sm:w-[150px] lg:w-[210px] z-10 right-[8%] sm:right-[5%] lg:right-[0%] top-[22%] sm:top-[15%] lg:top-[12%] overflow-visible"
                style={{ rotate: '8deg' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
              >
                <motion.div
                  animate={{ y: [0, -7, 0] }}
                  transition={{ repeat: Infinity, duration: 7, ease: "easeInOut", delay: 0.4 }}
                  className="overflow-visible"
                >
                  <Image
                    src="/images/5. Round 1 of 3 (Without Text) - Sized-portrait.png"
                    alt="Tasting round"
                    width={1179}
                    height={2556}
                    sizes="(max-width: 640px) 75px, (max-width: 1024px) 150px, 210px"
                    className="drop-shadow-[0_8px_25px_rgba(0,0,0,0.1)]"
                  />
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div 
        className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 10, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
        aria-hidden="true"
      >
        <ChevronDown className="w-6 h-6 sm:w-8 sm:h-8 text-[color:var(--winey-muted)]" />
      </motion.div>
    </section>
  );
}

// ============================================================================
// FEATURES BENTO GRID
// ============================================================================
function FeaturesBento() {
  const features = [
    {
      icon: Wine,
      title: 'Blind Tasting',
      description: 'Sample mystery wines each round – no labels, just your taste and instinct.',
      color: 'var(--winey-danger)',
    },
    {
      icon: Trophy,
      title: 'Rank & Win',
      description: 'Stack wines from luxe to low-end. Earn points, climb the leaderboard, claim the crown.',
      color: 'var(--winey-title)',
    },
    {
      icon: Users,
      title: 'Multiplayer',
      description: 'Everyone plays on their own phone. Share a code – no app download required.',
      color: 'var(--winey-success)',
    },
    {
      icon: Sparkles,
      title: 'Know Your Palate',
      description: 'Get a personalized recap. Discover your favorites and whether you have expensive taste.',
      color: 'var(--winey-accent-green)',
    },
  ];

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.div 
          className="text-center mb-10 sm:mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="font-serif text-3xl sm:text-5xl font-semibold text-[color:var(--winey-muted-2)]">
            Think you can taste<br />
            <span className="text-gradient">a difference?</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              className="group relative p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-[color:var(--winey-border)] hover:border-[color:var(--winey-title)]/30 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <div 
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center mb-3 sm:mb-4 transition-transform group-hover:scale-110"
                style={{ backgroundColor: `color-mix(in srgb, ${feature.color} 15%, transparent)` }}
              >
                <feature.icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: feature.color }} />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-[color:var(--winey-muted-2)] mb-1 sm:mb-2">{feature.title}</h3>
              <p className="text-[color:var(--winey-muted)] text-xs sm:text-sm leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// HOW IT WORKS - SCROLL SHOWCASE
// ============================================================================
const GAME_STEPS = [
  {
    step: '01',
    title: 'Set Up Your Tasting',
    description: 'Pick the number of players, bottles, and rounds. Configure once, and the game math handles itself – wines per round, pour sizes, everything.',
    image: '/images/1. Setup Tasting - Sized-portrait.png',
    imageAlt: null,
    imageAltPosition: null,
  },
  {
    step: '02',
    title: 'Curate the Lineup',
    description: 'Add each wine\'s real label, a fun "blind" nickname, and the price. Then organize which wines go in each round. Your tasting, your rules.',
    image: '/images/2. Wine List - Sized-portrait.png',
    imageAlt: '/images/3. Organize Wines - Sized-left.png',
    imageAltPosition: 'left',
  },
  {
    step: '03',
    title: 'Invite Your Guests',
    description: 'Share a simple game code. Players join from any device – no app required. Come back anytime; we save everything so you can start when ready.',
    image: '/images/4. Lobby - Sized-portrait.png',
    imageAlt: null,
    imageAltPosition: null,
  },
  {
    step: '04',
    title: 'Taste & Rank',
    description: 'Pour wines blind. Players take tasting notes, debate flavors, then rank from most to least expensive. Trust your palate – or your gut.',
    image: '/images/6. Round 1 of 3 (With Text) - Sized-portrait.png',
    imageAlt: '/images/5. Round 1 of 3 (Without Text) - Sized-left.png',
    imageAltPosition: 'left',
  },
  {
    step: '05',
    title: 'Live Scoring & Leaderboard',
    description: 'After each round, see the correct price order and watch points stack up. The leaderboard updates live – find out who\'s got the most refined palate.',
    image: '/images/7. Round 3 of 5 Results - Sized-portrait.png',
    imageAlt: '/images/8. Leaderboard - Sized-left.png',
    imageAltPosition: 'right',
  },
  {
    step: '06',
    title: 'Your Tasting Recap',
    description: 'After a bonus round to guess the least and most expensive wines, get a personalized recap you can download. Your notes, your rankings, your souvenir.',
    image: '/images/9. Your Tasting Recap - Sized-portrait.png',
    imageAlt: null,
    imageAltPosition: null,
  },
];

function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // Update active step based on scroll position
  useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", (latest) => {
      const stepIndex = Math.min(
        Math.floor(latest * GAME_STEPS.length),
        GAME_STEPS.length - 1
      );
      setActiveStep(stepIndex);
    });
    return () => unsubscribe();
  }, [scrollYProgress]);

  return (
    <section ref={containerRef} className="relative">
      {/* Section Header - Outside the scroll container */}
      <div className="pt-16 sm:pt-20 pb-6 sm:pb-10 px-6 lg:px-8">
        <motion.div 
          className="text-center max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="font-serif text-3xl sm:text-6xl lg:text-7xl font-semibold text-[color:var(--winey-muted-2)]">
            Here's How It Works
          </h2>
        </motion.div>
      </div>

      {/* Scroll-linked showcase */}
      <div className="relative min-h-[400vh]">
        {/* Sticky container for phone and content - NO overflow-hidden to prevent clipping */}
        <div className="sticky top-0 min-h-screen flex items-center py-4 sm:py-0">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Mobile: Stack vertically with phone on top, text below */}
            {/* Desktop: Side by side */}
            <div className="flex flex-col lg:grid lg:grid-cols-2 gap-4 sm:gap-8 lg:gap-20 items-center">
              
              {/* Phone Display - On mobile, constrain height and scale phone to fit */}
              <div className="relative w-full flex items-center justify-center order-1 lg:order-1 flex-shrink-0 overflow-visible">
                {/* Ambient glow behind phone - hidden on mobile for cleaner look */}
                <div className="hidden sm:flex absolute inset-0 items-center justify-center pointer-events-none">
                  <motion.div 
                    className="w-[300px] h-[400px] rounded-full bg-[color:var(--winey-card-tan)] blur-[80px] opacity-60"
                    animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.6, 0.4] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>

                {/* Phone images with crossfade - entire container animates including position */}
                <div className="relative w-[140px] sm:w-[220px] lg:w-[300px] overflow-visible">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeStep}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ 
                        opacity: 1, 
                        scale: 1,
                        x: GAME_STEPS[activeStep].imageAlt 
                          ? GAME_STEPS[activeStep].imageAltPosition === 'left'
                            ? 16  // shift right when secondary is on left
                            : -16 // shift left when secondary is on right
                          : 0     // centered when no secondary
                      }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ 
                        duration: 0.5, 
                        ease: [0.32, 0.72, 0, 1]
                      }}
                      className="relative overflow-visible"
                    >
                      <Image
                        src={GAME_STEPS[activeStep].image}
                        alt={GAME_STEPS[activeStep].title}
                        width={1179}
                        height={2556}
                        className="drop-shadow-[0_20px_50px_rgba(0,0,0,0.15)]"
                        priority
                        sizes="(max-width: 640px) 140px, (max-width: 1024px) 220px, 300px"
                      />
                      
                      {/* Secondary phone - positioned based on imageAltPosition */}
                      {GAME_STEPS[activeStep].imageAlt && GAME_STEPS[activeStep].imageAltPosition === 'left' && (
                        <motion.div 
                          className="absolute -left-16 sm:-left-20 lg:-left-32 top-[30%] sm:top-[28%] lg:top-[25%] w-[85px] sm:w-[140px] lg:w-[200px] -z-10 overflow-visible"
                          initial={{ opacity: 0, x: -30 }}
                          animate={{ opacity: 0.65, x: 0, rotate: 4 }}
                          transition={{ duration: 0.6, delay: 0.15, ease: [0.32, 0.72, 0, 1] }}
                        >
                          <Image
                            src={GAME_STEPS[activeStep].imageAlt}
                            alt=""
                            width={1179}
                            height={2556}
                            className="drop-shadow-[0_15px_40px_rgba(0,0,0,0.12)]"
                            sizes="(max-width: 640px) 85px, (max-width: 1024px) 140px, 200px"
                          />
                        </motion.div>
                      )}
                      
                      {/* Secondary phone on the right */}
                      {GAME_STEPS[activeStep].imageAlt && GAME_STEPS[activeStep].imageAltPosition === 'right' && (
                        <motion.div 
                          className="absolute -right-16 sm:-right-20 lg:-right-32 top-[30%] sm:top-[28%] lg:top-[25%] w-[85px] sm:w-[140px] lg:w-[200px] -z-10 overflow-visible"
                          initial={{ opacity: 0, x: 30 }}
                          animate={{ opacity: 0.65, x: 0, rotate: -4 }}
                          transition={{ duration: 0.6, delay: 0.15, ease: [0.32, 0.72, 0, 1] }}
                        >
                          <Image
                            src={GAME_STEPS[activeStep].imageAlt}
                            alt=""
                            width={1179}
                            height={2556}
                            className="drop-shadow-[0_15px_40px_rgba(0,0,0,0.12)]"
                            sizes="(max-width: 640px) 85px, (max-width: 1024px) 140px, 200px"
                          />
                        </motion.div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* Content - Compact on mobile */}
              <div className="order-2 lg:order-2 text-center lg:text-left w-full">
                {/* Progress indicator */}
                <div className="flex items-center justify-center lg:justify-start gap-1.5 sm:gap-2 mb-4 sm:mb-8">
                  {GAME_STEPS.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        const progress = index / GAME_STEPS.length;
                        const container = containerRef.current;
                        if (container) {
                          const scrollHeight = container.scrollHeight - window.innerHeight;
                          window.scrollTo({ 
                            top: container.offsetTop + (scrollHeight * progress), 
                            behavior: 'smooth' 
                          });
                        }
                      }}
                      className={`h-1 sm:h-1.5 rounded-full transition-all duration-500 ${
                        index === activeStep 
                          ? 'w-6 sm:w-8 bg-[color:var(--winey-title)]' 
                          : index < activeStep 
                            ? 'w-2 sm:w-3 bg-[color:var(--winey-title)]/40'
                            : 'w-2 sm:w-3 bg-[color:var(--winey-muted)]/20'
                      }`}
                      aria-label={`Go to step ${index + 1}`}
                    />
                  ))}
                </div>

                {/* Step content with animation */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStep}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                  >
                    {/* Large step number - smaller on mobile */}
                    <div className="mb-1 sm:mb-2">
                      <span className="font-serif text-6xl sm:text-9xl lg:text-[10rem] font-bold text-[color:var(--winey-title)]/15">
                        {GAME_STEPS[activeStep].step}
                      </span>
                    </div>
                    <h3 className="font-serif text-2xl sm:text-4xl lg:text-5xl font-semibold text-[color:var(--winey-muted-2)] mb-3 sm:mb-6 -mt-10 sm:-mt-14 lg:-mt-20 relative">
                      {GAME_STEPS[activeStep].title}
                    </h3>
                    <p className="text-sm sm:text-lg lg:text-xl text-[color:var(--winey-muted)] leading-relaxed max-w-lg mx-auto lg:mx-0">
                      {GAME_STEPS[activeStep].description}
                    </p>
                  </motion.div>
                </AnimatePresence>

                {/* Step counter */}
                <div className="mt-4 sm:mt-8 text-xs sm:text-sm text-[color:var(--winey-muted)]/60 font-medium tracking-wide">
                  Step {activeStep + 1} of {GAME_STEPS.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// FINAL CTA
// ============================================================================
function FinalCTA() {
  return (
    <section className="py-20 sm:py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-[color:var(--winey-muted-2)]">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-1/4 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] rounded-full bg-[color:var(--winey-title)] blur-[100px] sm:blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[250px] sm:w-[400px] h-[250px] sm:h-[400px] rounded-full bg-[color:var(--winey-danger)] blur-[80px] sm:blur-[120px]" />
      </div>
      
      <motion.div 
        className="mx-auto max-w-4xl text-center relative z-10"
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
      >
        <h2 className="font-serif text-3xl sm:text-6xl lg:text-7xl font-semibold text-white leading-tight">
          Your move, sommelier.
        </h2>
        <p className="mt-4 sm:mt-6 text-base sm:text-xl text-white/80 max-w-2xl mx-auto px-2">
          Grab some bottles, round up your friends, and click below to start hosting. Free to play, no app required. Bragging rights are on the line.
        </p>
        
        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/host/setup">
            <Button className="btn-shine h-14 sm:h-16 px-8 sm:px-10 text-lg sm:text-xl bg-[color:var(--winey-title)] text-white hover:bg-[color:var(--winey-title)]/90 border-none shadow-[var(--winey-shadow-lg)] font-semibold">
              Start Hosting
              <ArrowRight className="ml-2 h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

// ============================================================================
// FOOTER
// ============================================================================
function Footer() {
  return (
    <footer className="py-8 sm:py-12 px-4 sm:px-6 border-t border-[color:var(--winey-border)] bg-white">
      <div className="mx-auto max-w-7xl flex flex-col items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xl sm:text-2xl">🍷</span>
          <span className="font-semibold tracking-widest text-sm sm:text-base text-[color:var(--winey-muted-2)]">WINEY</span>
        </div>
        
        <p className="text-xs sm:text-sm text-[color:var(--winey-muted)]">
          © 2025 Winey. Drink responsibly.
        </p>
        
        <p className="font-serif italic text-xs sm:text-sm text-[color:var(--winey-muted)]">
          By Maxim Kalinkin
        </p>
      </div>
    </footer>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================
export default function Home() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)] selection:bg-[color:var(--winey-title)] selection:text-white">
      
      {/* Fixed Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'py-2 sm:py-3 bg-[color:var(--background)]/95 backdrop-blur-xl border-b border-[color:var(--winey-border)]' : 'py-3 sm:py-5 bg-transparent'}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-xl sm:text-2xl">🍷</span>
            <span className="font-semibold tracking-widest text-sm sm:text-base text-[color:var(--winey-muted-2)]">WINEY</span>
          </div>
          <span className="hidden md:block font-serif italic text-sm text-[color:var(--winey-muted)]">By Maxim Kalinkin</span>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/player/join">
              <Button variant="neutral" size="sm" className="hidden sm:inline-flex">Join Game</Button>
            </Link>
            <Link href="/host/setup">
              <Button size="sm" className="text-xs sm:text-sm px-2.5 sm:px-3">Host Tasting</Button>
            </Link>
          </div>
        </div>
      </nav>

      <main>
        <Hero />
        <FeaturesBento />
        <HowItWorks />
        <FinalCTA />
      </main>

      <Footer />
    </div>
  );
}
