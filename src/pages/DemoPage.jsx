import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

// Simple fade‑in animation variant
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

/**
 * Book a Demo – a polished marketing page with subtle animations.
 * It showcases key specs, benefits for doctors, and a short form to request a live demo.
 */
const DemoPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // In a real product this would post to an API / Calendly link.
    setSubmitted(true);
    // Simulate a forward navigation after a short delay.
    setTimeout(() => navigate('/'), 3000);
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      {/* Hero */}
      <section className="relative py-24 overflow-hidden bg-primary/5">
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        >
          <div className="absolute inset-0 bg-primary/10 rounded-full blur-3xl" />
        </motion.div>
        <div className="container mx-auto px-6 lg:px-12 relative z-10">
          <motion.h1
            variants={fadeIn}
            initial="hidden"
            whileInView="visible"
            className="text-5xl md:text-6xl font-black text-primary mb-6 text-center"
          >
            Book a Live Demo of <span className="text-slate-900 dark:text-slate-100">DoctoLeb</span>
          </motion.h1>
          <motion.p
            variants={fadeIn}
            initial="hidden"
            whileInView="visible"
            className="text-lg md:text-xl text-center max-w-3xl mx-auto mb-10"
          >
            Experience the full power of our end‑to‑end clinic management platform – schedule, see, and ask questions in real time.
          </motion.p>
          <motion.div
            variants={fadeIn}
            initial="hidden"
            whileInView="visible"
            className="flex justify-center"
          >
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
              <input
                type="email"
                required
                placeholder="Your work email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-xl font-bold shadow-lg transition-colors"
              >
                Request Demo
              </button>
            </form>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-white dark:bg-slate-900">
        <div className="container mx-auto px-6 lg:px-12">
          <motion.h2
            variants={fadeIn}
            initial="hidden"
            whileInView="visible"
            className="text-3xl font-bold text-center mb-12"
          >
            Why Doctors Choose DoctoLeb
          </motion.h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: 'patient_list', title: 'Comprehensive Records', text: 'All patient history, labs, and notes in one secure place.' },
              { icon: 'calendar_month', title: 'Smart Scheduling', text: 'AI‑driven slot filling reduces gaps and no‑shows.' },
              { icon: 'payments', title: 'Automated Billing', text: 'Instant invoices, insurance claims, and revenue tracking.' },
            ].map((feat, i) => (
              <motion.div
                key={i}
                variants={fadeIn}
                initial="hidden"
                whileInView="visible"
                className="p-8 bg-background-light dark:bg-background-dark rounded-xl shadow-sm text-center"
              >
                <span className="material-symbols-outlined text-4xl text-primary mb-4 block">{feat.icon}</span>
                <h3 className="text-xl font-bold mb-2">{feat.title}</h3>
                <p className="text-slate-600 dark:text-slate-400">{feat.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Confirmation */}
      {submitted && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        >
          <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-xl text-center">
            <h3 className="text-2xl font-bold mb-4">Demo Requested!</h3>
            <p className="mb-6">We will contact you shortly. You will be redirected to the home page.</p>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default DemoPage;
