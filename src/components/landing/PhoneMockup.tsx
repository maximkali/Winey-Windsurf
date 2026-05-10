'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

interface PhoneMockupProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}

export function PhoneMockup({ src, alt, className = '', priority = false }: PhoneMockupProps) {
  return (
    <motion.div
      className={`relative mx-auto aspect-[1179/2556] w-full max-w-[300px] sm:max-w-[340px] ${className}`}
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="relative h-full w-full">
        <Image
          src={src}
          alt={alt}
          fill
          className="object-contain drop-shadow-2xl"
          priority={priority}
          sizes="(max-width: 640px) 300px, 340px"
        />
      </div>
    </motion.div>
  );
}

