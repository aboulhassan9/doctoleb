import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import CountUp from '@/components/CountUp';
import TrueFocus from '@/components/TrueFocus';
import BorderGlow from '@/components/BorderGlow';
import { useBrand } from '@/contexts/BrandContext';

const LandingPage = () => {
    const navigate = useNavigate();
    const { displayName, tagline, brand } = useBrand();
    const scrollToSection = (id) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };
    const fadeUp = {
        hidden: { opacity: 0, y: 40 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
    };

    const staggerContainer = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2
            }
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display min-h-screen">
            {/* Navigation */}
            <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 dark:border-slate-800/60 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <div className="flex items-center gap-2">
                            {brand.logo_url ? (
                                <img src={brand.logo_url} alt={displayName} className="h-10 w-10 rounded-lg object-cover" />
                            ) : (
                                <motion.div
                                    whileHover={{ rotate: 180 }}
                                    transition={{ duration: 0.5 }}
                                    className="p-2 rounded-lg text-white flex items-center justify-center"
                                    style={{ backgroundColor: 'var(--doctor-brand-primary)' }}
                                >
                                    <span className="material-symbols-outlined block">health_metrics</span>
                                </motion.div>
                            )}
                            <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">{displayName}</span>
                        </div>
                        <nav className="hidden md:flex items-center gap-10">
                            <a className="text-sm font-semibold hover:text-primary transition-colors" href="#">Home</a>
                            <a className="text-sm font-semibold hover:text-primary transition-colors" href="#features">Features</a>
                            <a className="text-sm font-semibold hover:text-primary transition-colors" href="#about" onClick={(e) => { e.preventDefault(); document.getElementById('about').scrollIntoView({ behavior: 'smooth' }); }}>About</a>
                        </nav>
                        <div className="flex items-center gap-4">
                            <motion.button 
                                onClick={() => navigate('/login')}
                                whileHover={{ scale: 1.05 }}
                                className="hidden sm:block text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
                            >
                                Sign In
                            </motion.button>
                            <motion.button 
                                onClick={() => navigate('/signup')}
                                whileHover={{ scale: 1.05 }} 
                                whileTap={{ scale: 0.95 }}
                                className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-primary/20"
                            >
                                Sign Up
                            </motion.button>
                        </div>
                    </div>
                </div>
            </header>

            <main>
                {/* Hero Section */}
                <section className="relative pt-16 pb-24 overflow-hidden">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="grid lg:grid-cols-2 gap-12 items-center">
                            <motion.div 
                                initial="hidden" animate="visible" variants={fadeUp}
                                className="z-10 text-center lg:text-left"
                            >
                                <style>{`.hero-focus-wrap .focus-word { font-size: 1.4rem !important; font-weight: 700 !important; }`}</style>
                                <div className="hero-focus-wrap mb-6 flex justify-center lg:justify-start">
                                    <TrueFocus
                                        sentence="Smart Secure Streamlined"
                                        manualMode={false}
                                        blurAmount={3}
                                        borderColor="#0d6cf2"
                                        glowColor="rgba(13, 108, 242, 0.5)"
                                        animationDuration={0.4}
                                        pauseBetweenAnimations={1.5}
                                    />
                                </div>
                                <h1 className="text-5xl md:text-7xl font-black text-slate-900 dark:text-slate-100 leading-[1.1] tracking-tight mb-6">
                                    Book care with <span className="text-primary">{displayName}</span>
                                </h1>
                                <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 leading-relaxed mb-10 max-w-xl mx-auto lg:mx-0">
                                    {tagline}
                                </p>
                                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => navigate('/signup')} className="bg-primary text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-primary/30">Book an Appointment</motion.button>
                                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => scrollToSection('features')} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg border border-slate-200 dark:border-slate-700">See How It Works</motion.button>
                                </div>
                            </motion.div>
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.8 }}
                                className="relative lg:h-[600px] flex items-center justify-center p-4 lg:p-0"
                            >
                                {/* Animated background blob */}
                                <motion.div 
                                    animate={{
                                        scale: [1, 1.2, 1],
                                        rotate: [0, 90, 0],
                                        borderRadius: ["50%", "40%", "50%"]
                                    }}
                                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-0 bg-primary/20 rounded-full blur-3xl transform -translate-y-12"
                                />
                                <div className="relative w-full aspect-square max-w-[500px] bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden border border-slate-200/50 dark:border-slate-700/50 p-4">
                                    <div className="w-full h-full bg-slate-100 dark:bg-slate-900 rounded-2xl overflow-hidden relative group">
                                        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent"></div>
                                        <img alt="DoctoLeb Dashboard" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD061aa8HGVBAHHOhoW2cn8rtUrfONYiwb6mjT12r3V1u6iiNIFAkuII22ZGehCh6bHRzupxhBx6j0VYG_oXEl5NXTVVmE3lsWc2S0FLjZ8BaGNZ7ea7ljwiGzGMOdpX1ca5xa7gwGVMLGC_zfG4t9Z_6Kwk9ak15wDxAl9kBpEM_9raFO5tvUQtBPuL4nVWgszS40WdopLvq1_-XE-2pB181fgdE2Hd2lAUmJK6M4J_2J65es5TSDJkVZVOwkVq1mWTvCLXqkaN8c" />
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* Social Proof & Stats */}
                <section className="py-12 bg-white dark:bg-slate-900/50">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <p className="text-center text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-12">A doctor-branded patient portal for appointments, intake, and follow-up</p>
                        <motion.div 
                            variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}
                            className="grid grid-cols-2 md:grid-cols-4 gap-8 opacity-60 grayscale hover:grayscale-0 transition-all cursor-pointer"
                        >
                            {["MEDCORE", "HEALTHLINK", "VITALIS", "CAREPOINT"].map((logo) => (
                                <motion.div key={logo} variants={fadeUp} className="flex items-center justify-center">
                                    <div className="h-12 w-32 bg-slate-200 dark:bg-slate-800 rounded-lg flex items-center justify-center font-bold text-slate-400">{logo}</div>
                                </motion.div>
                            ))}
                        </motion.div>
                        <motion.div 
                            variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }}
                            className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6"
                        >
                            {[
                                { to: 24, suffix: "/7", label: "Appointment Requests" },
                                { to: 3, suffix: "+", label: "Practice Location Types" },
                                { to: 100, suffix: "%", label: "Doctor-Owned Workflow" }
                            ].map((stat, i) => (
                                <motion.div 
                                    key={i} variants={fadeUp} whileHover={{ y: -10 }}
                                    className="bg-background-light dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 text-center shadow-sm"
                                >
                                    <p className="text-primary text-4xl font-black mb-2">
                                        <CountUp from={0} to={stat.to} separator="," duration={3} />
                                        {stat.suffix}
                                    </p>
                                    <p className="text-slate-600 dark:text-slate-400 font-medium">{stat.label}</p>
                                </motion.div>
                            ))}
                        </motion.div>
                    </div>
                </section>

                {/* Features Section */}
                <section className="py-24 bg-background-light dark:bg-background-dark" id="features">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <motion.div 
                            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                            className="text-center max-w-3xl mx-auto mb-20"
                        >
                            <h2 className="text-primary font-bold text-sm uppercase tracking-widest mb-4">Core Capabilities</h2>
                            <p className="text-4xl md:text-5xl font-black text-slate-900 dark:text-slate-100 mb-6">Built for the demands of modern medicine</p>
                            <p className="text-slate-600 dark:text-slate-400 text-lg">Streamline your workflow with tools that actually understand the complexity of healthcare management.</p>
                        </motion.div>
                        <motion.div 
                            variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
                            className="grid md:grid-cols-3 gap-8"
                        >
                            {[
                                { icon: "patient_list",  title: "Patient Tracking", text: "Secure, cloud-based electronic health records with real-time updates and intuitive history visualizations." },
                                { icon: "calendar_month", title: "Smart Scheduling", text: "AI-powered scheduling that minimizes gaps and automatically sends appointment reminders to patients." },
                                { icon: "payments",       title: "Automated Billing", text: "Integrated insurance claims processing and automated invoicing to ensure you get paid faster." }
                            ].map((feat, i) => (
                                <motion.div key={i} variants={fadeUp} whileHover={{ y: -10, scale: 1.02 }}>
                                    <BorderGlow
                                        glowColor="215 90 60"
                                        backgroundColor="#ffffff"
                                        borderRadius={24}
                                        glowRadius={30}
                                        glowIntensity={0.9}
                                        colors={['#0d6cf2', '#38bdf8', '#60a5fa']}
                                        className="group h-full transition-all"
                                    >
                                        <div className="p-10">
                                            <div className="bg-primary/10 text-primary w-14 h-14 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                                                <span className="material-symbols-outlined text-3xl">{feat.icon}</span>
                                            </div>
                                            <h3 className="text-xl font-black mb-4 text-slate-900 dark:text-slate-100">{feat.title}</h3>
                                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{feat.text}</p>
                                            <div className="mt-8 flex items-center gap-2 text-primary font-bold text-sm">
                                                Explore Feature
                                                <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                            </div>
                                        </div>
                                    </BorderGlow>
                                </motion.div>
                            ))}
                        </motion.div>
                    </div>
                </section>

                {/* About Section */}
                <section id="about" className="py-24 bg-white dark:bg-slate-900 relative overflow-hidden">
                    <motion.div
                        animate={{ rotate: -360 }} transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                        className="absolute -bottom-[20%] -right-[10%] w-[45%] h-[45%] bg-primary/5 rounded-full blur-[120px] pointer-events-none"
                    />
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                        <div className="grid lg:grid-cols-2 gap-16 items-center">
                            {/* Left: Text content */}
                            <motion.div
                                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                            >
                                <h2 className="text-primary font-bold text-sm uppercase tracking-widest mb-4">Our Mission</h2>
                                <p className="text-4xl md:text-5xl font-black text-slate-900 dark:text-slate-100 leading-tight mb-6">
                                    Healthcare technology <span className="text-primary">built by clinicians</span>, for clinicians.
                                </p>
                                <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed mb-8">
                                    DoctoLeb was founded in 2021 by a team of physicians and engineers who were frustrated by clunky, outdated practice management software. We believed clinics deserved a tool as modern and reliable as the care they provide.
                                </p>
                                <p className="text-slate-600 dark:text-slate-400 text-lg leading-relaxed mb-10">
                                    Today, we serve thousands of healthcare professionals across the globe — helping them reclaim time, reduce errors, and deliver better patient experiences.
                                </p>
                                <motion.div
                                    variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}
                                    className="grid grid-cols-3 gap-6"
                                >
                                    {[
                                        { num: "2021", label: "Founded" },
                                        { num: "50+", label: "Team Members" },
                                        { num: "15+", label: "Countries" },
                                    ].map((stat, i) => (
                                        <motion.div key={i} variants={fadeUp} className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                                            <p className="text-primary text-2xl font-black mb-1">{stat.num}</p>
                                            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">{stat.label}</p>
                                        </motion.div>
                                    ))}
                                </motion.div>
                            </motion.div>

                            {/* Right: Values cards */}
                            <motion.div
                                variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
                                className="grid grid-cols-1 sm:grid-cols-2 gap-6"
                            >
                                {[
                                    { icon: "security", title: "Privacy First", text: "End-to-end encryption and full HIPAA compliance baked in from day one.", color: "bg-primary/50/10 text-primary" },
                                    { icon: "bolt", title: "Built for Speed", text: "Snappy, real-time updates so your team never waits on the system.", color: "bg-warning/100/10 text-warning" },
                                    { icon: "support_agent", title: "24/7 Support", text: "A dedicated team of humans ready to assist whenever you need us.", color: "bg-green-500/10 text-green-500" },
                                    { icon: "auto_awesome", title: "Always Improving", text: "Weekly updates driven by direct feedback from our clinical community.", color: "bg-purple-500/10 text-purple-500" },
                                ].map((val, i) => (
                                    <motion.div
                                        key={i} variants={fadeUp} whileHover={{ y: -8, scale: 1.02 }}
                                        className="group bg-background-light dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 transition-all duration-300"
                                    >
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${val.color}`}>
                                            <span className="material-symbols-outlined text-2xl">{val.icon}</span>
                                        </div>
                                        <h3 className="text-slate-900 dark:text-slate-100 font-bold text-base mb-2">{val.title}</h3>
                                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{val.text}</p>
                                    </motion.div>
                                ))}
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* Testimonial Section */}
                <section className="py-24 bg-white dark:bg-slate-900 relative overflow-hidden">
                    {/* Background elements */}
                    <motion.div 
                        animate={{ rotate: 360 }} transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
                        className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[100px]"
                    />
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
                        <motion.div initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once:true }} transition={{type:"spring"}}>
                            <span className="material-symbols-outlined text-primary text-6xl mb-8 opacity-20">format_quote</span>
                        </motion.div>
                        <motion.p 
                            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                            className="text-2xl md:text-3xl font-medium text-slate-800 dark:text-slate-200 leading-relaxed italic mb-10"
                        >
                            "DoctoLeb has completely transformed how we operate. Our administrative overhead has decreased by 40%, allowing our medical staff to focus more on what matters most: patient care."
                        </motion.p>
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
                            className="flex flex-col items-center"
                        >
                            <motion.div whileHover={{ scale: 1.1 }} className="w-20 h-20 rounded-full border-4 border-primary/20 p-1 mb-4 overflow-hidden shadow-lg shadow-primary/20">
                                <img alt="Clinician portrait" className="w-full h-full object-cover rounded-full" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD8iusuFH8fk3uegFC2xAi8521TKk37NZPGFmuVdAr8TcoYUb9eaTo4A6bUhNNYue9rt_i-TpTnPCoXpEHjRt_SInXav30H7Y37UQ2HFUjqfyaO52G8htWgFOtPTBBFZ70PJN8z80EIqcgvyjrkPbUBLe9Mkvo_3igCggE2jAxXdu0OMRAZ9VPlEACB-PKeffYsmF_Shpodc74vE5KzTFU-RlhnraA_kk54_wI8Ldze-PSaLUwbU0n2u8ajnx9KI_WyUFo9ivSFNKo" />
                            </motion.div>
                            <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">A Trusted Clinician</h4>
                            <p className="text-slate-500 dark:text-slate-500 text-sm">Chief of Staff, Metropolitan Health</p>
                        </motion.div>
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pt-20 pb-10 relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                        <div className="col-span-1 md:col-span-1">
                            <div className="flex items-center gap-2 mb-6 cursor-pointer">
                                <div className="bg-primary p-2 rounded-lg text-white">
                                    <span className="material-symbols-outlined block text-lg">health_metrics</span>
                                </div>
                                <span className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">DoctoLeb</span>
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                                The world's leading clinic management software designed for efficiency and modern healthcare delivery.
                            </p>
                            <div className="flex gap-4 mt-6">
                                {["public", "share", "mail"].map((icon) => (
                                    <motion.a 
                                        key={icon} href="#" whileHover={{ scale: 1.1, y: -2 }} whileTap={{ scale: 0.95 }}
                                        className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-primary hover:text-white transition-all shadow-md"
                                    >
                                        <span className="material-symbols-outlined text-sm">{icon}</span>
                                    </motion.a>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-6">Product</h4>
                            <ul className="space-y-4 text-sm text-slate-600 dark:text-slate-400 font-medium">
                                {["Features", "Integrations", "Security", "Updates"].map(item => (
                                    <li key={item}><a className="hover:text-primary transition-colors flex items-center gap-1 group" href="#"><span className="material-symbols-outlined text-[10px] opacity-0 -ml-3 group-hover:opacity-100 group-hover:ml-0 transition-all">arrow_forward_ios</span>{item}</a></li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-6">Company</h4>
                            <ul className="space-y-4 text-sm text-slate-600 dark:text-slate-400 font-medium">
                                {["About Us", "Careers", "Blog", "Contact"].map(item => (
                                    <li key={item}><a className="hover:text-primary transition-colors flex items-center gap-1 group" href="#"><span className="material-symbols-outlined text-[10px] opacity-0 -ml-3 group-hover:opacity-100 group-hover:ml-0 transition-all">arrow_forward_ios</span>{item}</a></li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-6">Support</h4>
                            <ul className="space-y-4 text-sm text-slate-600 dark:text-slate-400 font-medium">
                                {["Help Center", "Documentation", "Community", "Status"].map(item => (
                                    <li key={item}><a className="hover:text-primary transition-colors flex items-center gap-1 group" href="#"><span className="material-symbols-outlined text-[10px] opacity-0 -ml-3 group-hover:opacity-100 group-hover:ml-0 transition-all">arrow_forward_ios</span>{item}</a></li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-slate-200 dark:border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-sm text-slate-500 dark:text-slate-500">© 2026 DoctoLeb Inc. All rights reserved.</p>
                        <div className="flex gap-8 text-sm text-slate-500 dark:text-slate-500">
                            <a className="hover:text-primary transition-colors" href="#">Privacy Policy</a>
                            <a className="hover:text-primary transition-colors" href="#">Terms of Service</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
