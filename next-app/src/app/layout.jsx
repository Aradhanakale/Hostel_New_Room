import { Providers } from '@/context/Providers';
import './globals.css';
export const metadata = {
    title: 'HostelSwap | Multi-Party Room Exchange Platform (Next.js)',
    description: 'Auditable hostel room swap platform with graph cycle detection and atomic approvals',
};
export default function RootLayout({ children }) {
    return (<html lang="en" suppressHydrationWarning>
      <body className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>);
}
