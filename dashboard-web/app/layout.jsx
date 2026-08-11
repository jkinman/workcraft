import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata = {
  title: 'Career-Ops Dashboard',
  description: 'Product dashboard for Career-Ops job search pipelines'
};

export default function RootLayout({ children }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const body = <body>{children}</body>;

  return (
    <html lang="en">
      {publishableKey ? (
        <ClerkProvider publishableKey={publishableKey}>
          {body}
        </ClerkProvider>
      ) : body}
    </html>
  );
}
