
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, isAfter, endOfDay, parseISO } from 'date-fns';
import type { CollectionEntry, WeeklySummary, FormState } from '../types';
import { PlusIcon, TrashIcon, SaveIcon, PaperAirplaneIcon } from './Icons';
import { submitToGoogleSheet, SubmissionData } from '../services/googleSheetsService';
import { salesData } from '../data/branchData';

const getWeekOfMonth = (date: Date): number => {
    return Math.ceil(date.getDate() / 7);
};

const initialFormState: FormState = {
    reportId: null,
    dateRange: { from: undefined, to: undefined },
    branch: '',
    employee: '',
    entries: [],
};

const CollectionForm: React.FC = () => {
    const [formState, setFormState] = useState<FormState>(() => {
        const savedState = localStorage.getItem('ginzaCollectionForm');
        if (savedState) {
            const parsed = JSON.parse(savedState);
            return {
                ...parsed,
                dateRange: {
                    from: parsed.dateRange.from ? new Date(parsed.dateRange.from) : undefined,
                    to: parsed.dateRange.to ? new Date(parsed.dateRange.to) : undefined,
                }
            };
        }
        return initialFormState;
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const { reportId, dateRange, branch, employee, entries } = formState;

    // Derived state for dropdowns
    const branches = useMemo(() => {
        const branchSet = new Set(salesData.map(item => item.branch));
        return Array.from(branchSet).sort();
    }, []);

    const employeesForBranch = useMemo(() => {
        if (!branch) return [];
        return salesData
            .filter(item => item.branch === branch)
            .map(item => item.name)
            .sort();
    }, [branch]);


    useEffect(() => {
        localStorage.setItem('ginzaCollectionForm', JSON.stringify(formState));
    }, [formState]);

    const handleDateRangeSelect = (range: { from?: Date; to?: Date } | undefined) => {
        setFormState(prev => ({ ...prev, dateRange: { from: range?.from, to: range?.to } }));
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({ ...prev, [name]: value }));
    };
    
    const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newBranch = e.target.value;
        setFormState(prev => ({
            ...prev,
            branch: newBranch,
            employee: '' // Reset employee when branch changes
        }));
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
        if (!branch) {
            setStatusMessage({ type: 'error', text: 'Branch name is required to submit.' });
            return;
        }
        if (!employee) {
            setStatusMessage({ type: 'error', text: 'Employee name is required to submit.' });
            return;
        }
        setIsSubmitting(true);
        setStatusMessage(null);

        // Generate a new report ID only if one doesn't already exist for this form session
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
                 setStatusMessage({ type: 'success', text: 'Final report submitted successfully! Form has been cleared.' });
                 setFormState(initialFormState);
                 localStorage.removeItem('ginzaCollectionForm');
            } else {
                 setStatusMessage({ type: 'success', text: 'Draft successfully saved to Google Sheet!' });
                 // If this was the first time saving, update state with the new reportId
                 if (!reportId) {
                     setFormState(prev => ({ ...prev, reportId: currentReportId }));
                 }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            setStatusMessage({ type: 'error', text: `Submission failed: ${errorMessage}` });
        } finally {
            setIsSubmitting(false);
            setTimeout(() => setStatusMessage(null), 5000);
        }
    };
    
    const isSubmitDisabled = useMemo(() => {
        if (!dateRange.to) return true;
        return isAfter(endOfDay(dateRange.to), new Date());
    }, [dateRange.to]);

    const dateRangeInfo = useMemo(() => {
        if (!dateRange.from) return null;
        return {
            month: format(dateRange.from, 'MMMM'),
            year: format(dateRange.from, 'yyyy'),
            week: `(Starting in ${getWeekOfMonth(dateRange.from)}${['st', 'nd', 'rd', 'th'][getWeekOfMonth(dateRange.from) - 1] || 'th'} Week)`
        };
    }, [dateRange.from]);

    const formatCurrency = useCallback((amount: number) => {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);
    }, []);

    return (
        <div className="space-y-10">
            {statusMessage && (
                <div className={`p-4 rounded-lg text-white font-semibold shadow-md fixed top-24 right-8 z-50 animate-pulse ${statusMessage.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                    {statusMessage.text}
                </div>
            )}
            
            <div className="p-8 bg-white rounded-xl shadow-xl">
                <h2 className="text-2xl font-bold text-gray-800 border-b-2 border-gray-100 pb-4 mb-6">Step 1: Select Date Range & Details</h2>
                <div className="grid md:grid-cols-2 gap-x-12 gap-y-8 items-start">
                    <div>
                        <label className="block text-base font-semibold text-gray-700 mb-2">Select Collection Period:</label>
                        <div className="flex justify-center p-2 border-2 border-gray-200 rounded-lg bg-gray-50">
                            <DayPicker
                                mode="range"
                                selected={{ from: dateRange.from, to: dateRange.to }}
                                onSelect={handleDateRangeSelect}
                                numberOfMonths={1}
                            />
                        </div>
                        {dateRangeInfo && (
                            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                                <p className="font-bold text-blue-800 text-lg">{dateRangeInfo.month} {dateRangeInfo.year}</p>
                                <p className="text-sm text-blue-600">{dateRangeInfo.week}</p>
                            </div>
                        )}
                    </div>
                    <div className="space-y-6">
                         {dateRange.from && dateRange.to && (
                            <div className="p-4 bg-gray-100 border border-gray-200 rounded-lg text-center">
                                <p className="font-semibold text-gray-800">
                                    Date Range: <span className="font-bold text-blue-700">{format(dateRange.from, 'dd/MM/yyyy')}</span> to <span className="font-bold text-blue-700">{format(dateRange.to, 'dd/MM/yyyy')}</span>
                                </p>
                            </div>
                        )}
                        <div>
                            <label htmlFor="branch" className="block text-sm font-medium text-gray-700 mb-1">Branch Name <span className="text-red-500">*</span></label>
                            <select id="branch" name="branch" value={branch} onChange={handleBranchChange} className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                                <option value="">-- Select a Branch --</option>
                                {branches.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="employee" className="block text-sm font-medium text-gray-700 mb-1">Employee Name <span className="text-red-500">*</span></label>
                            <select id="employee" name="employee" value={employee} onChange={handleInputChange} disabled={!branch} className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed">
                                <option value="">{branch ? '-- Select a Sales Person --' : 'Select a branch first'}</option>
                                {employeesForBranch.map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-8 bg-white rounded-xl shadow-xl">
                <h2 className="text-2xl font-bold text-gray-800 border-b-2 border-gray-100 pb-4 mb-6">Step 2: Enter Collection Data</h2>
                <div className="overflow-x-auto -mx-4">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-40">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Customer Name</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-48">Order Amount</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-48">Collection Amount</th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-20">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {entries.length === 0 && (
                                <tr><td colSpan={5} className="text-center py-10 text-gray-500">No entries added yet.</td></tr>
                            )}
                            {entries.map(entry => (
                                <tr key={entry.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 whitespace-nowrap"><input type="date" value={entry.date} onChange={e => updateEntry(entry.id, 'date', e.target.value)} min={dateRange.from ? format(dateRange.from, 'yyyy-MM-dd') : ''} max={dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : ''} className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2" /></td>
                                    <td className="px-4 py-2"><input type="text" placeholder="Customer" value={entry.customerName} onChange={e => updateEntry(entry.id, 'customerName', e.target.value)} className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2" /></td>
                                    <td className="px-4 py-2"><input type="number" placeholder="0.00" value={entry.orderAmount === 0 ? '' : entry.orderAmount} onChange={e => updateEntry(entry.id, 'orderAmount', Number(e.target.value))} className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2" /></td>
                                    <td className="px-4 py-2"><input type="number" placeholder="0.00" value={entry.collectionAmount === 0 ? '' : entry.collectionAmount} onChange={e => updateEntry(entry.id, 'collectionAmount', Number(e.target.value))} className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2" /></td>
                                    <td className="px-4 py-2 whitespace-nowrap text-right"><button onClick={() => removeEntry(entry.id)} className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 transition-colors" title="Remove this entry"><TrashIcon /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <button onClick={addEntry} className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-transform hover:scale-105">
                    <PlusIcon /> Add Entry
                </button>
            </div>

            <div className="p-8 bg-white rounded-xl shadow-xl">
                <h2 className="text-2xl font-bold text-gray-800 border-b-2 border-gray-100 pb-4 mb-6">Step 3: Review Summary</h2>
                <div className="grid md:grid-cols-2 gap-x-12 gap-y-8">
                    <div>
                        <h3 className="font-semibold text-lg text-gray-700 mb-3">Weekly Summary</h3>
                        <div className="space-y-3">
                            {summaries.weekly.length === 0 && <p className="text-gray-500">No data to summarize.</p>}
                            {summaries.weekly.map(summary => (
                                <div key={summary.week} className="p-4 bg-gray-50 rounded-lg border">
                                    <p className="font-bold text-gray-800">Week {summary.week}</p>
                                    <div className="flex justify-between text-sm mt-1"><span>Order:</span> <span className="font-mono font-semibold">{formatCurrency(summary.orderAmount)}</span></div>
                                    <div className="flex justify-between text-sm"><span>Collection:</span> <span className="font-mono font-semibold">{formatCurrency(summary.collectionAmount)}</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-lg">
                        <h3 className="font-bold text-xl text-blue-800 mb-4">Monthly Totals</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-lg">
                                <span className="text-gray-700 font-medium">Total Order Amount:</span>
                                <span className="font-bold font-mono text-blue-900">{formatCurrency(summaries.monthly.orderAmount)}</span>
                            </div>
                            <div className="flex justify-between items-center text-lg">
                                <span className="text-gray-700 font-medium">Total Collection Amount:</span>
                                <span className="font-bold font-mono text-blue-900">{formatCurrency(summaries.monthly.collectionAmount)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 bg-white rounded-xl shadow-xl sticky bottom-4 border-t-4 border-blue-600">
                 <div className="flex flex-col sm:flex-row gap-4 justify-end">
                     <button 
                        onClick={() => handleSubmission('Draft')} 
                        disabled={isSubmitting || entries.length === 0}
                        className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-lg shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed"
                        title="Save a draft to the Google Sheet. You can update this later."
                     >
                         <SaveIcon /> {isSubmitting ? 'Saving...' : 'Save Draft to Sheet'}
                     </button>
                     <button
                        onClick={() => handleSubmission('Final')}
                        disabled={isSubmitDisabled || isSubmitting || entries.length === 0}
                        className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all"
                        title="Finalize and send all data to the Google Sheet."
                     >
                        {isSubmitting ? 'Submitting...' : <><PaperAirplaneIcon /> Finalize & Submit Report</>}
                     </button>
                 </div>
                 <div className="text-xs text-center text-gray-500 mt-3 space-y-1">
                    <p><span className="font-semibold">Save Draft to Sheet:</span> Sends a temporary copy to the Google Sheet. Use this to save your progress. It will be replaced when you finalize.</p>
                    <p><span className="font-semibold">Finalize & Submit Report:</span> This submits the final, permanent version to the Google Sheet and clears the form.</p>
                    {isSubmitDisabled && dateRange.to && (
                        <p className="font-semibold text-red-600 mt-1">
                            Submit button will be enabled on or after {format(dateRange.to, 'dd-MM-yyyy')}.
                        </p>
                    )}
                 </div>
            </div>
        </div>
    );
};

export default CollectionForm;
