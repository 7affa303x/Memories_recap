/**
 * Automated Email Campaign Cron Jobs
 * 
 * Handles periodic email campaigns for user engagement:
 * - Welcome emails for new users
 * - Re-engagement emails for inactive users
 * - Review requests after job completion
 * - Weekly digests
 * - Discount offers for users with low/zero credits
 */

import { getServiceSupabase } from "@/lib/supabase/admin";
import type { JobRow } from "@/lib/types";
import {
  sendWelcomeEmail,
  sendReengagementEmail,
  sendReviewRequestEmail,
  sendDiscountEmail,
  sendWeeklyDigestEmail,
} from "./resend";

const supabase = getServiceSupabase();

/**
 * Track when emails were last sent to a user.
 */
interface EmailTracker {
  lastWelcome?: string;
  lastReengagement?: string;
  lastReviewRequests?: string[]; // array of job IDs
  lastWeeklyDigest?: string;
  lastDiscount?: string;
}

async function getEmailTracker(userId: string): Promise<EmailTracker> {
  const path = `email-tracking/${userId}.json`;
  const { data, error } = await supabase.storage.from("app-data").download(path);
  if (error || !data) return {};
  try {
    return JSON.parse(await data.text()) as EmailTracker;
  } catch {
    return {};
  }
}

async function saveEmailTracker(userId: string, tracker: EmailTracker) {
  const path = `email-tracking/${userId}.json`;
  const { error } = await supabase.storage
    .from("app-data")
    .upload(path, JSON.stringify(tracker, null, 2), {
      contentType: "application/json",
      upsert: true,
    });
  if (error) {
    console.error("Failed to save email tracker:", error.message);
  }
}

function daysSince(dateStr?: string): number {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * List all user IDs from the queue and user folders.
 */
async function getAllUserIds(): Promise<string[]> {
  // Scan the queue folder and jobs folder for user IDs
  const queueRes = await supabase.storage.from("app-data").list("queue", { limit: 100 });
  const jobsRes = await supabase.storage.from("app-data").list("jobs", { limit: 1000 });
  
  const userIds = new Set<string>();
  
  // From queue items
  if (queueRes.data) {
    for (const item of queueRes.data) {
      const fileData = await supabase.storage.from("app-data").download(`queue/${item.name}`);
      if (fileData.data) {
        try {
          const text = await fileData.data.text();
          const parsed = JSON.parse(text);
          if (parsed.userId) userIds.add(parsed.userId);
        } catch {}
      }
    }
  }
  
  // From jobs folders
  if (jobsRes.data) {
    for (const item of jobsRes.data) {
      if (item.name && !item.name.startsWith(".")) {
        userIds.add(item.name);
      }
    }
  }
  
  return Array.from(userIds);
}

/**
 * Get all users' data from storage.
 */
async function getAllUsers(): Promise<Array<{ id: string; email: string; name: string | null; image: string | null; created_at: string }>> {
  const usersRes = await supabase.storage.from("app-data").list("users", { limit: 1000 });
  if (!usersRes.data) return [];
  
  const users = [];
  for (const item of usersRes.data) {
    const fileData = await supabase.storage.from("app-data").download(`users/${item.name}`);
    if (fileData.data) {
      try {
        const user = JSON.parse(await fileData.data.text());
        users.push(user);
      } catch {}
    }
  }
  return users;
}

/**
 * Send welcome emails to new users who haven't received one yet.
 */
async function processWelcomeEmails(users: Array<{ id: string; email: string; name: string | null }>) {
  let sent = 0;
  for (const user of users) {
    const tracker = await getEmailTracker(user.id);
    if (tracker.lastWelcome) continue;

    const result = await sendWelcomeEmail(user.email, user.name);
    if (result) {
      tracker.lastWelcome = new Date().toISOString();
      await saveEmailTracker(user.id, tracker);
      sent++;
      console.log(`Welcome email sent to ${user.email}`);
    }
  }
  return sent;
}

/**
 * Send re-engagement emails to users inactive for 7+ days.
 */
async function processReengagementEmails(users: Array<{ id: string; email: string; name: string | null }>) {
  let sent = 0;
  for (const user of users) {
    const tracker = await getEmailTracker(user.id);
    const jobsRes = await supabase.storage.from("app-data").list(`jobs/${user.id}`, { limit: 100 });
    if (!jobsRes.data || jobsRes.data.length === 0) continue;

    let lastActivity = new Date(0);
    for (const item of jobsRes.data) {
      const fileData = await supabase.storage.from("app-data").download(`jobs/${user.id}/${item.name}`);
      if (fileData.data) {
        try {
          const job: JobRow = JSON.parse(await fileData.data.text());
          const jobDate = new Date(job.updated_at);
          if (jobDate > lastActivity) lastActivity = jobDate;
        } catch {}
      }
    }

    const daysSinceLast = Math.floor(
      (Date.now() - lastActivity.getTime()) / (24 * 60 * 60 * 1000)
    );

    if (daysSinceLast >= 7 && daysSince(tracker.lastReengagement) > 14) {
      const result = await sendReengagementEmail(user.email, user.name);
      if (result) {
        tracker.lastReengagement = new Date().toISOString();
        await saveEmailTracker(user.id, tracker);
        sent++;
        console.log(`Re-engagement email sent to ${user.email}`);
      }
    }
  }
  return sent;
}

/**
 * Send review requests for completed jobs from 3 days ago.
 */
async function processReviewRequests(users: Array<{ id: string; email: string }>) {
  let sent = 0;
  for (const user of users) {
    const tracker = await getEmailTracker(user.id);
    const jobsRes = await supabase.storage.from("app-data").list(`jobs/${user.id}`, { limit: 100 });
    if (!jobsRes.data) continue;
    
    const requestedJobs = new Set(tracker.lastReviewRequests || []);

    for (const item of jobsRes.data) {
      const fileData = await supabase.storage.from("app-data").download(`jobs/${user.id}/${item.name}`);
      if (!fileData.data) continue;
      
      try {
        const job: JobRow = JSON.parse(await fileData.data.text());
        if (job.status !== "completed" || !job.completed_at) continue;
        if (requestedJobs.has(job.id)) continue;

        const daysSinceCompletion = daysSince(job.completed_at);
        if (daysSinceCompletion >= 3 && daysSinceCompletion <= 7) {
          const result = await sendReviewRequestEmail(user.email, job.id);
          if (result) {
            if (!tracker.lastReviewRequests) tracker.lastReviewRequests = [];
            tracker.lastReviewRequests.push(job.id);
            await saveEmailTracker(user.id, tracker);
            sent++;
            console.log(`Review request sent for job ${job.id} to ${user.email}`);
          }
        }
      } catch {}
    }
  }
  return sent;
}

/**
 * Send weekly digest emails to active users (every Monday).
 */
async function processWeeklyDigests(users: Array<{ id: string; email: string; name: string | null }>) {
  let sent = 0;
  const today = new Date();
  const dayOfWeek = today.getDay();

  // Only send on Mondays (day 1)
  if (dayOfWeek !== 1) return sent;

  for (const user of users) {
    const tracker = await getEmailTracker(user.id);
    if (daysSince(tracker.lastWeeklyDigest) < 6) continue;

    const jobsRes = await supabase.storage.from("app-data").list(`jobs/${user.id}`, { limit: 100 });
    if (!jobsRes.data || jobsRes.data.length === 0) continue;

    const jobs: JobRow[] = [];
    for (const item of jobsRes.data) {
      const fileData = await supabase.storage.from("app-data").download(`jobs/${user.id}/${item.name}`);
      if (fileData.data) {
        try {
          jobs.push(JSON.parse(await fileData.data.text()));
        } catch {}
      }
    }

    const totalRecaps = jobs.filter((j) => j.status === "completed").length;
    const lastWeek = jobs.filter((j) => {
      const created = new Date(j.created_at);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return created >= weekAgo;
    }).length;

    const result = await sendWeeklyDigestEmail(
      user.email,
      user.name,
      { totalRecaps, lastWeekRecaps: lastWeek, creditsRemaining: 0 }
    );
    if (result) {
      tracker.lastWeeklyDigest = new Date().toISOString();
      await saveEmailTracker(user.id, tracker);
      sent++;
      console.log(`Weekly digest sent to ${user.email}`);
    }
  }
  return sent;
}

/**
 * Send discount offers to users with zero/low credits who haven't bought recently.
 */
async function processDiscountEmails(users: Array<{ id: string; email: string; name: string | null }>) {
  let sent = 0;
  for (const user of users) {
    const tracker = await getEmailTracker(user.id);
    if (daysSince(tracker.lastDiscount) < 30) continue;

    // Check if user has any purchases
    const jobsRes = await supabase.storage.from("app-data").list(`jobs/${user.id}`, { limit: 100 });
    if (!jobsRes.data) continue;
    
    let hasPurchases = false;
    for (const item of jobsRes.data) {
      const fileData = await supabase.storage.from("app-data").download(`jobs/${user.id}/${item.name}`);
      if (fileData.data) {
        try {
          const job: JobRow = JSON.parse(await fileData.data.text());
          if ((job.credits_charged || 0) > 200) {
            hasPurchases = true;
            break;
          }
        } catch {}
      }
    }
    
    if (!hasPurchases && jobsRes.data.length > 0) {
      const result = await sendDiscountEmail(user.email, user.name);
      if (result) {
        tracker.lastDiscount = new Date().toISOString();
        await saveEmailTracker(user.id, tracker);
        sent++;
        console.log(`Discount email sent to ${user.email}`);
      }
    }
  }
  return sent;
}

/**
 * Main cron handler — called by the cron API route.
 */
export async function runEmailCampaigns() {
  const users = await getAllUsers();
  const results = {
    welcome: 0,
    reengagement: 0,
    reviews: 0,
    digest: 0,
    discount: 0,
  };

  try {
    results.welcome = await processWelcomeEmails(users);
    results.reengagement = await processReengagementEmails(users);
    results.reviews = await processReviewRequests(users);
    results.digest = await processWeeklyDigests(users);
    results.discount = await processDiscountEmails(users);
  } catch (error) {
    console.error("Email campaign error:", error);
  }

  return results;
}
