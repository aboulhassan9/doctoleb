import React from 'react';
import { Link } from 'react-router-dom';
import { useBrand } from '@/contexts/BrandContext';

const MarketingPage = () => {
  const { displayName } = useBrand();

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 p-8">
      <h1 className="text-4xl font-black mb-6">{displayName} Patient Portal</h1>
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">What patients can do</h2>
        <ul className="list-disc list-inside space-y-2">
          <li>Register a patient account connected to this clinic.</li>
          <li>Request appointments and review upcoming or past visits.</li>
          <li>Complete intake information before the clinical team reviews it.</li>
          <li>View medical records and documents shared by the clinic.</li>
          <li>Responsive React SPA built with Vite, Tailwind CSS and Framer Motion for smooth UI.</li>
        </ul>
      </section>
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Operations portal is separate</h2>
        <ul className="list-disc list-inside space-y-2">
          <li>Doctor, secretary, and pre-doctor staff do not sign in from this public patient surface.</li>
          <li>Staff workflows live in the clinic operations app with its own login and routes.</li>
          <li>The same backend contracts serve both surfaces without duplicating business logic.</li>
        </ul>
      </section>
      <section className="flex gap-4">
        <Link to="/signup" className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-bold shadow-lg">
          Patient Registration
        </Link>
        <Link to="/login" className="bg-slate-100 hover:bg-slate-200 text-slate-900 px-6 py-3 rounded-xl font-bold shadow">
          Patient Login
        </Link>
      </section>
    </div>
  );
};

export default MarketingPage;
