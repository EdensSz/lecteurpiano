// src/app/freeplay/layout.tsx
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sightread: Free Play',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>; // ← Fragment React pour éviter les warnings
}
