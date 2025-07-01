"use server";

import { db } from "@/db/drizzle";
import { todo } from "@/db/schema";

/**
 * Converts days, hours, and minutes to a cron expression
 * Cron format: minute hour day_of_month month day_of_week
 */
function convertToCron(days: number, hours: number, minutes: number): string {
  // Convert everything to total minutes for easier calculation
  const totalMinutes = days * 24 * 60 + hours * 60 + minutes;

  // Handle edge cases
  if (totalMinutes === 0) {
    throw new Error("Interval must be greater than 0");
  }

  // If total is less than 60 minutes, use minute-based cron
  if (totalMinutes < 60) {
    return `*/${totalMinutes} * * * *`;
  }

  // If exactly divisible by hours and less than 24 hours, use hour-based cron
  if (totalMinutes < 24 * 60 && totalMinutes % 60 === 0) {
    const totalHours = totalMinutes / 60;
    return `0 */${totalHours} * * *`;
  }

  // If exactly divisible by 24 hours (full days), use day-based cron
  if (totalMinutes % (24 * 60) === 0) {
    const totalDays = totalMinutes / (24 * 60);
    if (totalDays === 1) {
      return `0 0 * * *`; // Daily at midnight
    } else if (totalDays <= 30) {
      return `0 0 */${totalDays} * *`; // Every N days at midnight
    }
  }

  // For intervals between 60-1439 minutes that don't divide evenly into hours
  // Use multiple runs per day approach
  if (totalMinutes < 24 * 60) {
    // Calculate how many times per day this should run
    const runsPerDay = Math.round((24 * 60) / totalMinutes);
    if (runsPerDay >= 2 && runsPerDay <= 24) {
      const hourInterval = Math.round(24 / runsPerDay);
      return `0 */${hourInterval} * * *`;
    }
  }

  // For intervals longer than 24 hours but not exact days
  if (totalMinutes > 24 * 60) {
    const totalDays = totalMinutes / (24 * 60);

    // If close to a whole number of days (within 10% error), round to nearest day
    const nearestDays = Math.round(totalDays);
    const errorPercent = Math.abs(totalDays - nearestDays) / totalDays;

    if (errorPercent <= 0.1 && nearestDays <= 30) {
      if (nearestDays === 1) {
        return `0 0 * * *`;
      } else {
        return `0 0 */${nearestDays} * *`;
      }
    }
  }

  // For very large intervals or edge cases, default to daily
  return `0 0 * * *`;
}

/**
 * Server action to create a new birdwatcher task
 */
export async function createBirdwatcher(formData: FormData) {
  try {
    // Extract form data
    const name = formData.get("taskName") as string;
    const url = formData.get("url") as string;
    const instruction = formData.get("instructions") as string;
    const days = parseInt(formData.get("days") as string) || 0;
    const hours = parseInt(formData.get("hours") as string) || 0;
    const minutes = parseInt(formData.get("minutes") as string) || 0;

    // Validate required fields
    if (!name || !url || !instruction) {
      throw new Error("All fields are required");
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      throw new Error("Please enter a valid URL");
    }

    // Validate time interval
    if (days === 0 && hours === 0 && minutes === 0) {
      throw new Error("Please specify a check frequency");
    }

    // Convert time interval to cron format
    const cron = convertToCron(days, hours, minutes);

    // Insert into database
    await db.insert(todo).values({
      name,
      instruction,
      url,
      cron,
      creatorId: "anonymous", // TODO: Replace with actual user ID when auth is implemented
    });

    return {
      success: true,
      message: "Birdwatcher created successfully!",
    };
  } catch (error) {
    console.error("Error creating birdwatcher:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create birdwatcher",
    };
  }
}
