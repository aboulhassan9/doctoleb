import React from 'react';
import { Link } from 'react-router-dom';

const MarketingPage = () => {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 p-8">
      <h1 className="text-4xl font-black mb-6">DoctoLeb - The Complete Clinic Management Platform</h1>
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Key Specifications</h2>
        <ul className="list-disc list-inside space-y-2">
          <li>All-in-one SaaS solution - patient records, smart scheduling, tele-consultation, lab requests and automated billing.</li>
          <li>Responsive React SPA built with Vite, Tailwind CSS and Framer Motion for smooth UI.</li>
          <li>Role-based access (Pre-Doctor staff, Doctors, Administrators).</li>
          <li>Future-ready API layer - ready to connect to Supabase, GraphQL or REST back-ends.</li>
          <li>Dark-mode support, high-contrast accessibility, WCAG-AA compliance.</li>
        </ul>
      </section>
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Benefits for Doctors</h2>
        <ul className="list-disc list-inside space-y-2">
          <li>Instant access to complete medical history and lab results.</li>
          <li>One-click consultation notes, auto-saved drafts, and printable PDFs.</li>
          <li>Integrated billing - reduce paperwork and improve cash flow.</li>
          <li>Smart scheduling with AI-driven gap-filling to maximise patient throughput.</li>
          <li>Secure, HIPAA-ready data storage (when connected to Supabase).</li>
        </ul>
      </section>
      <section className="flex gap-4">
        <Link to="/signup" className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-bold shadow-lg">
          Sign Up Now
        </Link>
        <Link to="/login" className="bg-slate-100 hover:bg-slate-200 text-slate-900 px-6 py-3 rounded-xl font-bold shadow">
          Request a Demo
        </Link>
      </section>
    </div>
  );
};

export default MarketingPage;
