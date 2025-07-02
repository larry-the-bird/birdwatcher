import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 flex items-center justify-center">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
          {/* Logo */}
          <div className="mb-8">
            <Image
              src="/logo-no-background.png"
              alt="Birdwatcher Logo"
              width={120}
              height={120}
              className="mx-auto mb-4"
            />
          </div>

          {/* 404 Error */}
          <div className="mb-8">
            <h1 className="text-6xl font-bold text-slate-900 mb-4">404</h1>
            <h2 className="text-2xl font-semibold text-slate-800 mb-2">
              Page Not Found
            </h2>
            <p className="text-slate-600 mb-6">
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>

          {/* Illustration */}
          <div className="mb-8">
            <div className="w-32 h-32 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
              <svg
                className="w-16 h-16 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <p className="text-sm text-slate-500">
              Don't worry, our birdwatchers are still keeping an eye on things!
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/">
              <Button className="w-full sm:w-auto">
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                Go Home
              </Button>
            </Link>
          </div>
          {/* Additional Help */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-sm text-slate-500 mb-2">
              Having trouble? Here are some helpful links:
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Link
                href="/"
                className="text-sm text-slate-600 hover:text-slate-900 underline"
              >
                Home
              </Link>
              <span className="text-slate-300">•</span>
              <Link
                href="/"
                className="text-sm text-slate-600 hover:text-slate-900 underline"
              >
                Create Birdwatcher
              </Link>
              <span className="text-slate-300">•</span>
              <Link
                href="/"
                className="text-sm text-slate-600 hover:text-slate-900 underline"
              >
                My Birdwatchers
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
