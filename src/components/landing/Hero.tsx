'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { WineyTitle } from '@/components/winey/Typography';
import { ArrowRight } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          
          {/* Text Content */}
          <div className="lg:col-span-6 flex flex-col justify-center text-center lg:text-left z-10 relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[color:var(--winey-muted-2)]">
                The <span className="text-[color:var(--winey-title)]">Sommelier's</span><br />
                Game Night.
              </h1>
              <p className="mt-6 text-lg sm:text-xl text-[color:var(--winey-muted)] max-w-2xl mx-auto lg:mx-0">
                Host blind tastings, rank wines by price, and crown the top palate. 
                No spreadsheets, no confusion—just pour, taste, and play.
              </p>
              
              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link href="/host/setup">
                  <Button className="w-full sm:w-auto h-12 px-8 text-lg shadow-xl hover:translate-y-[-2px] transition-transform">
                    Host a Tasting
                  </Button>
                </Link>
                <Link href="/player/join">
                  <Button variant="outline" className="w-full sm:w-auto h-12 px-8 text-lg bg-transparent border-2">
                    Join a Game
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>

          {/* Hero Visuals */}
          <div className="lg:col-span-6 relative mt-16 lg:mt-0">
            <motion.div 
              className="relative mx-auto w-full max-w-[500px] lg:max-w-none lg:h-full flex items-center justify-center"
              initial={{ opacity: 0, x: 50, rotate: -5 }}
              animate={{ opacity: 1, x: 0, rotate: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            >
              {/* Main floating phone */}
              <div className="relative z-10 w-[280px] sm:w-[340px] lg:w-[400px]">
                <Image
                  src="/images/1. Setup Tasting - Sized-left.png"
                  alt="Winey Setup Screen"
                  width={1179}
                  height={2556}
                  priority
                  className="drop-shadow-2xl"
                />
              </div>

              {/* Secondary phone - Lobby for social proof */}
              <motion.div 
                className="absolute -right-32 top-24 z-0 w-[220px] opacity-50 hidden lg:block"
                animate={{ y: [0, -15, 0] }}
                transition={{ repeat: Infinity, duration: 7, ease: "easeInOut" }}
              >
                <Image
                  src="/images/4. Lobby - Sized-left.png"
                  alt="Lobby with players"
                  width={1179}
                  height={2556}
                  className="drop-shadow-lg"
                />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
      
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-[color:var(--winey-card-tan)] opacity-30 blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[color:var(--winey-title)] opacity-10 blur-[120px]" />
      </div>
    </section>
  );
}

