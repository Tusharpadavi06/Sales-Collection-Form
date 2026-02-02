import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, isAfter, endOfDay, parseISO } from 'date-fns';
import type { CollectionEntry, WeeklySummary, FormState } from '../types';
import { PlusIcon, TrashIcon, SaveIcon, PaperAirplaneIcon } from './Icons';
import { submitToGoogleSheet, SubmissionData } from '../services/googleSheetsService';

const getWeekOfMonth = (date: Date): number => {
    return Math.ceil(date.getDate() / 7);
};

interface CollectionFormProps {
    currentUser: { name: string; branch: string; contact: string };
}

const initialFormState: FormState = {
    reportId: null,
    dateRange: { from: undefined, to: undefined },
    branch: '',
    employee: '',
    contact: '',
    entries: [],
};

const CollectionForm: React.FC<CollectionFormProps> = ({ currentUser }) => {
    const [formState, setFormState] = useState<FormState>(() => {
        const savedState = localStorage.getItem('ginzaCollectionForm');
        if (savedState) {
            const parsed = JSON.parse(savedState);
            return {
                ...parsed,
                dateRange: {
                    from: parsed.dateRange.from ? new Date(parsed.dateRange.from) : undefined,
                    to: parsed.dateRange.to ? new Date(parsed.dateRange.to) : undefined,
                },
                branch: currentUser.branch,
                employee: currentUser.name,
                contact: currentUser.contact
            };
        }
        return {
            ...initialFormState,
            branch: currentUser.branch,
            employee: currentUser.name,
            contact: currentUser.contact
        };
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const { reportId, dateRange, branch, employee, entries } = formState;

    useEffect(() => {
        localStorage.setItem('ginzaCollectionForm', JSON.stringify(formState));
    }, [formState]);

    const handleDateRangeSelect = (range: { from?: Date; to?: Date } | undefined) => {
        setFormState(prev => ({ ...prev, dateRange: { from: range?.from, to: range?.to } }));
    };

    const addEntry = () => {
        const newEntry: CollectionEntry = {
            id: new Date().toISOString(),
            date: dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
            customerName: '',
            orderAmount: 0,
            collectionAmount: 0
        };
        setFormState(prev => ({ ...prev, entries: [...prev.entries, newEntry] }));
    };

    const updateEntry = (id: string, field: keyof CollectionEntry, value: string | number) => {
        setFormState(prev => ({
            ...prev,
            entries: prev.entries.map(entry =>
                entry.id === id ? { ...entry, [field]: value } : entry
            )
        }));
    };

    const removeEntry = (id: string) => {
        setFormState(prev => ({ ...prev, entries: prev.entries.filter(entry => entry.id !== id) }));
    };

    const summaries = useMemo(() => {
        if (entries.length === 0) return { weekly: [], monthly: { orderAmount: 0, collectionAmount: 0 } };

        const weekly: { [week: number]: { orderAmount: number; collectionAmount: number } } = {};
        let monthlyOrder = 0;
        let monthlyCollection = 0;

        entries.forEach(entry => {
            const date = parseISO(entry.date);
            const week = getWeekOfMonth(date);
            if (!weekly[week]) {
                weekly[week] = { orderAmount: 0, collectionAmount: 0 };
            }
            const order = Number(entry.orderAmount) || 0;
            const collection = Number(entry.collectionAmount) || 0;

            weekly[week].orderAmount += order;
            weekly[week].collectionAmount += collection;
            monthlyOrder += order;
            monthlyCollection += collection;
        });

        const weeklySummaries: WeeklySummary[] = Object.entries(weekly).map(([week, data]) => ({
            week: Number(week),
            ...data
        })).sort((a, b) => a.week - b.week);

        return { weekly: weeklySummaries, monthly: { orderAmount: monthlyOrder, collectionAmount: monthlyCollection } };
    }, [entries]);
    
    const handleSubmission = async (status: 'Draft' | 'Final') => {
        if (!branch || !employee) {
            setStatusMessage({ type: 'error', text: 'Identity information missing. Please re-login.' });
            return;
        }
        setIsSubmitting(true);
        setStatusMessage(null);

        const currentReportId = reportId || crypto.randomUUID();

        const submissionData: SubmissionData = {
            reportId: currentReportId,
            status,
            branch,
            employee,
            dateRange: {
                from: dateRange.from ? format(dateRange.from, 'dd/MM/yyyy') : '',
                to: dateRange.to ? format(dateRange.to, 'dd/MM/yyyy') : '',
            },
            entries,
            weeklySummaries: summaries.weekly,
            monthlyTotals: summaries.monthly,
        };

        try {
            await submitToGoogleSheet(submissionData);
            
            if (status === 'Final') {
                 setStatusMessage({ type: 'success', text: 'Final report submitted successfully!' });
                 setFormState({ ...initialFormState, branch: currentUser.branch, employee: currentUser.name, contact: currentUser.contact });
                 localStorage.removeItem('ginzaCollectionForm');
            } else {
                 setStatusMessage({ type: 'success', text: 'Draft successfully saved to Sheet!' });
                 if (!reportId) {
                     setFormState(prev => ({ ...prev, reportId: currentReportId }));
                 }
            }
        } catch (error) {
            setStatusMessage({ type: 'error', text: `Submission failed. Please check network.` });
        } finally {
            setIsSubmitting(false);
            setTimeout(() => setStatusMessage(null), 5000);
        }
    };
    
    const isSubmitDisabled = useMemo(() => {
        if (!dateRange.to) return true;
        return isAfter(endOfDay(dateRange.to), new Date());
    }, [dateRange.to]);

    const formatCurrency = useCallback((amount: number) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);
    }, []);

    return (
        <div className="space-y-6">
            {statusMessage && (
                <div className={`p-4 rounded-lg text-white font-semibold shadow-md fixed top-20 right-4 z-50 transition-all ${statusMessage.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                    {statusMessage.text}
                </div>
            )}
            
            {/* Step 1 */}
            <div className="bg-white rounded-xl shadow-sm p-8">
                <h2 className="text-xl font-bold text-gray-800 mb-8 uppercase tracking-tight">Step 1: Select Date Range & Details</h2>
                <div className="grid md:grid-cols-2 gap-12 items-start">
                    <div>
                        <label className="block text-sm font-medium text-gray-500 mb-4">Select Collection Period:</label>
                        <div className="flex justify-center p-4 border border-gray-100 rounded-xl bg-gray-50/50">
                            <DayPicker
                                mode="range"
                                selected={{ from: dateRange.from, to: dateRange.to }}
                                onSelect={handleDateRangeSelect}
                                numberOfMonths={1}
                            />
                        </div>
                    </div>
                    <div className="space-y-6 pt-10">
                        <div className="bg-blue-50/50 p-6 rounded-xl border border-blue-100 shadow-inner">
                            <div className="mb-4">
                                <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Authenticated Branch</label>
                                <p className="text-sm font-bold text-gray-700">{branch}</p>
                            </div>
                            <div className="mb-6">
                                <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Sales Person</label>
                                <p className="text-sm font-bold text-gray-700">{employee}</p>
                                {currentUser.contact && <p className="text-[10px] text-gray-400 font-medium">{currentUser.contact}</p>}
                            </div>
                            
                            {/* Selected Date Range Display - Positioned below salesperson name as requested */}
                            <div className="pt-4 border-t border-blue-100">
                                <label className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Selected Date Range</label>
                                {dateRange.from ? (
                                    <div className="flex items-center gap-2">
                                        <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded">
                                            {format(dateRange.from, 'dd/MM/yyyy')}
                                        </span>
                                        <span className="text-gray-400 font-bold">to</span>
                                        {dateRange.to ? (
                                            <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded">
                                                {format(dateRange.to, 'dd/MM/yyyy')}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-gray-400 italic">Select end date...</span>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-400 italic font-medium">Please select a range on the calendar.</p>
                                )}
                            </div>
                            
                            <p className="text-[10px] text-blue-300 mt-6 italic">* These details are locked based on your login session.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-xl shadow-sm p-8">
                <h2 className="text-xl font-bold text-gray-800 mb-8 uppercase tracking-tight">Step 2: Enter Collection Data</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-[#f9fafb]">
                            <tr>
                                <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest w-40">Date</th>
                                <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Customer Name</th>
                                <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest w-48">Order Amount</th>
                                <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest w-48">Collection Amount</th>
                                <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest w-20">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {entries.length === 0 && (
                                <tr><td colSpan={5} className="text-center py-12 text-gray-400 font-medium">No entries added yet. Click 'Add Entry' below.</td></tr>
                            )}
                            {entries.map(entry => (
                                <tr key={entry.id} className="group">
                                    <td className="px-4 py-3"><input type="date" value={entry.date} onChange={e => updateEntry(entry.id, 'date', e.target.value)} className="w-full border-none focus:ring-0 text-sm p-0" /></td>
                                    <td className="px-4 py-3"><input type="text" placeholder="Customer Name" value={entry.customerName} onChange={e => updateEntry(entry.id, 'customerName', e.target.value)} className="w-full border-none focus:ring-0 text-sm p-0" /></td>
                                    <td className="px-4 py-3"><input type="number" placeholder="0.00" value={entry.orderAmount === 0 ? '' : entry.orderAmount} onChange={e => updateEntry(entry.id, 'orderAmount', Number(e.target.value))} className="w-full border-none focus:ring-0 text-sm p-0 text-right font-mono" /></td>
                                    <td className="px-4 py-3"><input type="number" placeholder="0.00" value={entry.collectionAmount === 0 ? '' : entry.collectionAmount} onChange={e => updateEntry(entry.id, 'collectionAmount', Number(e.target.value))} className="w-full border-none focus:ring-0 text-sm p-0 text-right font-mono" /></td>
                                    <td className="px-4 py-3 text-right"><button onClick={() => removeEntry(entry.id)} className="text-gray-300 hover:text-red-500 transition-colors p-1"><TrashIcon /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <button onClick={addEntry} className="mt-8 flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-blue-700 transition-all active:scale-95">
                    <PlusIcon /> Add Entry
                </button>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-xl shadow-sm p-8">
                <h2 className="text-xl font-bold text-gray-800 mb-8 uppercase tracking-tight">Step 3: Review Summary</h2>
                <div className="grid md:grid-cols-2 gap-12">
                    <div>
                        <h3 className="font-bold text-gray-700 mb-4 text-xs uppercase tracking-widest">Weekly Breakup</h3>
                        <div className="space-y-4">
                            {summaries.weekly.length === 0 && <p className="text-sm text-gray-400 italic">No calculations available yet.</p>}
                            {summaries.weekly.map(summary => (
                                <div key={summary.week} className="p-4 bg-white border border-gray-100 rounded-lg flex flex-col gap-2 shadow-sm">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-gray-800 text-sm">Week {summary.week}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500">
                                        <span>Total Order:</span>
                                        <span className="font-bold text-gray-800 font-mono">{formatCurrency(summary.orderAmount)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500">
                                        <span>Total Collection:</span>
                                        <span className="font-bold text-blue-600 font-mono">{formatCurrency(summary.collectionAmount)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-[#f0f7ff] border border-[#dbeafe] rounded-xl p-6 h-fit shadow-sm">
                        <h3 className="font-bold text-[#1e40af] text-sm mb-6 uppercase tracking-widest">Monthly Totals</h3>
                        <div className="space-y-5">
                            <div className="flex justify-between items-center border-b border-[#dbeafe] pb-4">
                                <span className="text-sm text-gray-600 font-medium">Total Order Amount:</span>
                                <span className="font-bold text-[#1e40af] text-lg font-mono">{formatCurrency(summaries.monthly.orderAmount)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-600 font-bold uppercase tracking-tight">Grand Collection:</span>
                                <span className="font-black text-blue-700 text-2xl font-mono">{formatCurrency(summaries.monthly.collectionAmount)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky Footer Actions */}
            <div className="sticky bottom-0 left-0 right-0 bg-white border-t-2 border-blue-600 shadow-2xl p-6 rounded-t-2xl mt-12 z-20">
                <div className="flex flex-col sm:flex-row gap-4 justify-end items-center mb-6">
                    <button 
                        onClick={() => handleSubmission('Draft')} 
                        disabled={isSubmitting || entries.length === 0}
                        className="w-full sm:w-auto flex items-center justify-center px-8 py-3 bg-[#cbd5e1] text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-300 transition-all disabled:opacity-50"
                    >
                        <SaveIcon /> Save Draft
                    </button>
                    <button
                        onClick={() => handleSubmission('Final')}
                        disabled={isSubmitDisabled || isSubmitting || entries.length === 0}
                        className="w-full sm:w-auto flex items-center justify-center px-8 py-3 bg-[#94a3b8] text-white text-sm font-bold rounded-lg hover:bg-gray-600 transition-all disabled:opacity-50"
                    >
                        <PaperAirplaneIcon /> Finalize & Submit
                    </button>
                </div>
                <div className="text-[10px] text-center text-gray-400 space-y-1 max-w-2xl mx-auto font-medium">
                    <p><span className="font-bold">Save Draft:</span> Sends a temporary copy to the Google Sheet. Use this to save your progress.</p>
                    <p><span className="font-bold">Finalize & Submit:</span> This submits the final, permanent version to the Google Sheet and clears the form.</p>
                    {isSubmitDisabled && dateRange.to && (
                        <p className="font-bold text-red-400 mt-2">
                            Final Submit will be enabled on or after {format(dateRange.to, 'dd-MM-yyyy')}.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CollectionForm;