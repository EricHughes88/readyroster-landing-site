import type { Route } from "next";

type FooterLink =
  | {
      label: string;
      href: Route;
      external?: false;
    }
  | {
      label: string;
      href: string;
      external: true;
    };

export const footerContent: {
  companyName: string;
  tagline: string;
  contact: {
    email: string;
    phone: string;
  };
  links: FooterLink[];
  copyright: string;
} = {
  companyName: "Ready Roster",
  tagline: "The digital free-agent marketplace for youth wrestling",

  contact: {
    email: "support@readyroster.com",
    phone: "(555) 555-5555",
  },

  links: [
    {
      label: "Privacy Policy",
      href: "https://register.threestep.com/page/privacy-policy",
      external: true,
    },
    {
      label: "Code of Conduct",
      href: "https://register.threestep.com/site?id=10537",
      external: true,
    },
    {
      label: "Contact",
      href: "/contact" as Route,
    },
  ],

  copyright: `© ${new Date().getFullYear()} Ready Roster. All rights reserved.`,
};