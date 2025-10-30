import '../styles/globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Take the Long Way',
  description: 'Airbnb-style road trip planner',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


