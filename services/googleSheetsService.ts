
import type { CollectionEntry, WeeklySummary } from '../types';

// =====================================================================================
// !!! CRITICAL STEP !!!
// YOU MUST REPLACE THE LINE BELOW WITH THE WEB APP URL FROM GOOGLE APPS SCRIPT.
// The URL will start with "https://script.google.com/..."
// The long string of letters/numbers you used before was the SPREADSHEET ID, which is incorrect.
// Please get the correct URL by following the deployment instructions in 'google-apps-script.js.txt'.
// =====================================================================================
const GOOGLE_SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbyd9KGljCPPWO26dxLcEB_TWg-ISWRIjZoPzJ8qBsUHHpOO1Jo9KkQXGR1By4K_IpBF/exec';

export interface SubmissionData {
    branch: string;
    employee: string;
    dateRange: { from: string; to: string };
    entries: CollectionEntry[];
    weeklySummaries: WeeklySummary[];
    monthlyTotals: { orderAmount: number; collectionAmount: number };
}

export const submitToGoogleSheet = async (data: SubmissionData): Promise<void> => {
    // This check ensures you have replaced the placeholder with a valid URL.
    if (!GOOGLE_SHEET_API_URL || !GOOGLE_SHEET_API_URL.startsWith('https://script.google.com/macros/s/')) {
        const errorMessage = "The Google Sheets URL is incorrect. It must be a deployed Web App URL starting with 'https://script.google.com/...'. Please check the setup instructions.";
        console.error(errorMessage);
        throw new Error(errorMessage);
    }

    const response = await fetch(GOOGLE_SHEET_API_URL, {
        method: 'POST',
        // Use 'no-cors' mode. Apps Script web apps often work best this way
        // as they can have issues with CORS preflight requests.
        mode: 'no-cors', 
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    // In 'no-cors' mode, we can't inspect the response body. 
    // We assume success if the request doesn't throw a network error.
    // The Apps Script itself handles logging any server-side errors.
    console.log("Data submission attempted to Google Sheets.");
};
