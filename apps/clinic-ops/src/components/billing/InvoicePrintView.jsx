/**
 * InvoicePrintView — hidden print-only layout for generating PDF invoices.
 */

export default function InvoicePrintView({ invoice, clinicName }) {
    if (!invoice) return null;

    return (
        <div className="hidden print:block absolute inset-0 bg-white z-[9999] p-12 font-sans w-full h-full text-slate-900">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-start mb-16">
                    <div>
                        <h1 className="text-5xl font-black tracking-tighter text-slate-900">INVOICE</h1>
                        <p className="text-slate-500 font-bold mt-2 text-lg">{clinicName}</p>
                        <p className="text-slate-400 mt-1 text-sm">Clinic Management Platform</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Invoice Reference</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">{invoice.id}</p>
                        <span className={`inline-block mt-3 px-3 py-1 rounded-full text-xs font-semibold uppercase ${invoice.statusCls} border border-current`}>
                            {invoice.status}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-10 border-y-2 border-slate-100 py-8 mb-12">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Billed To</p>
                        <p className="text-xl font-black text-slate-900">{invoice.patient}</p>
                        <p className="text-sm text-slate-500 mt-1">Patient ID: CP-{invoice?.id?.replace(/\D/g, '').substring(0, 4) || '1024'}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Issue Date</p>
                        <p className="text-xl font-bold text-slate-900">{invoice.date}</p>
                    </div>
                </div>

                <table className="w-full text-left mb-16">
                    <thead>
                        <tr className="border-b-2 border-slate-900">
                            <th className="pb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">Description</th>
                            <th className="pb-4 text-xs font-semibold uppercase tracking-widest text-slate-400 text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-slate-100">
                            <td className="py-6">
                                <p className="font-bold text-slate-900 text-lg">Clinical Services & Consultation</p>
                                <p className="text-sm text-slate-500 mt-1">Comprehensive medical evaluation, lab tests, and diagnostics.</p>
                            </td>
                            <td className="py-6 text-right font-black text-xl text-slate-900">
                                ${invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                        </tr>
                    </tbody>
                </table>

                <div className="flex justify-end mb-24">
                    <div className="w-72">
                        <div className="flex justify-between py-3 border-b border-slate-100 text-sm font-bold text-slate-500">
                            <span>Subtotal</span>
                            <span>${invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between py-4 text-2xl font-black text-slate-900">
                            <span>Total Due</span>
                            <span>${invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>

                <div className="text-center mt-auto pt-8 border-t border-slate-100 text-slate-400 text-sm font-medium">
                    <p className="mb-2 font-bold text-slate-500">Thank you for your trust in {clinicName}.</p>
                    <p>For billing inquiries, please contact your clinic administration.</p>
                </div>
            </div>
        </div>
    );
}
