import Link from "next/link";
import { footerContent } from "@/lib/siteContent";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-800 bg-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-12">
          
          {/* Brand */}
          <div>
            <h2 className="text-lg font-semibold text-white">
              {footerContent.companyName}
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">
              {footerContent.tagline}
            </p>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Resources
            </h3>
            <div className="mt-3 flex flex-col gap-2">
              {footerContent.links.map((link) =>
                link.external ? (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-slate-400 transition hover:text-white"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm text-slate-400 transition hover:text-white"
                  >
                    {link.label}
                  </Link>
                )
              )}
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Contact
            </h3>
            <div className="mt-3 space-y-1 text-sm text-slate-400">
              <p>{footerContent.contact.email}</p>
              <p>(781) 722-0338</p>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-10 border-t border-slate-800 pt-4 text-center text-xs text-slate-500">
          <p>{footerContent.copyright}</p>
          <p className="mt-2">
            Secure platform. Your data is protected and handled in accordance with 3STEP policies.
          </p>
        </div>
      </div>
    </footer>
  );
}