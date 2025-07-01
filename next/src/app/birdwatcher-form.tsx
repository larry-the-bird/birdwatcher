"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createBirdwatcher } from "./actions";
import { toast } from "sonner";
import { useTransition } from "react";

export default function BirdwatcherForm() {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (formData: FormData) => {
    startTransition(async () => {
      const result = await createBirdwatcher(formData);

      if (result.success) {
        toast.success(result.message);
        // Reset form by refreshing the page or clearing form data
        (
          document.getElementById("birdwatcher-form") as HTMLFormElement
        )?.reset();
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <form id="birdwatcher-form" action={handleSubmit} className="space-y-6">
      {/* Task Name */}
      <div className="space-y-2">
        <label
          htmlFor="taskName"
          className="text-sm font-semibold text-slate-700 block"
        >
          Task Name
        </label>
        <Input
          id="taskName"
          name="taskName"
          placeholder="e.g., Competitor Price Monitor, Product Availability Tracker"
          className="h-12 text-base"
          required
          disabled={isPending}
        />
        <p className="text-xs text-slate-500">
          Give your birdwatcher a descriptive name
        </p>
      </div>

      {/* URL */}
      <div className="space-y-2">
        <label
          htmlFor="url"
          className="text-sm font-semibold text-slate-700 block"
        >
          Website URL
        </label>
        <Input
          id="url"
          name="url"
          type="url"
          placeholder="https://example.com/page-to-monitor"
          className="h-12 text-base"
          required
          disabled={isPending}
        />
        <p className="text-xs text-slate-500">
          Enter the full URL of the page you want to birdwatch
        </p>
      </div>

      {/* Instructions */}
      <div className="space-y-2">
        <label
          htmlFor="instructions"
          className="text-sm font-semibold text-slate-700 block"
        >
          Birdwatching Instructions
        </label>
        <Textarea
          id="instructions"
          name="instructions"
          placeholder="Describe what changes you want to birdwatch. For example: 'Alert me when the price of the iPhone 15 Pro changes' or 'Monitor for new job postings in the Engineering section'"
          className="min-h-[120px] text-base resize-none"
          required
          disabled={isPending}
        />
        <p className="text-xs text-slate-500">
          Be specific about what changes should trigger an alert
        </p>
      </div>

      {/* Check Frequency */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700 block">
          Check Frequency
        </label>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <label
              htmlFor="days"
              className="text-xs font-medium text-slate-600 block"
            >
              Days
            </label>
            <Input
              id="days"
              name="days"
              type="number"
              min="0"
              max="30"
              placeholder="0"
              defaultValue="0"
              className="h-12 text-base text-center"
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="hours"
              className="text-xs font-medium text-slate-600 block"
            >
              Hours
            </label>
            <Input
              id="hours"
              name="hours"
              type="number"
              min="0"
              max="23"
              placeholder="6"
              defaultValue="6"
              className="h-12 text-base text-center"
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="minutes"
              className="text-xs font-medium text-slate-600 block"
            >
              Minutes
            </label>
            <Input
              id="minutes"
              name="minutes"
              type="number"
              min="0"
              max="59"
              placeholder="0"
              defaultValue="0"
              className="h-12 text-base text-center"
              disabled={isPending}
            />
          </div>
        </div>
        <div className="text-xs text-slate-500 space-y-1">
          <p>Set the time interval between each birdwatch</p>
          <div className="bg-slate-50 rounded p-2 text-xs">
            <p className="font-medium mb-1">Examples:</p>
            <p>
              • <span className="font-medium">0 days, 1 hour, 0 minutes</span> -
              Check every hour
            </p>
            <p>
              • <span className="font-medium">0 days, 6 hours, 0 minutes</span>{" "}
              - Check every 6 hours
            </p>
            <p>
              • <span className="font-medium">1 day, 0 hours, 0 minutes</span> -
              Check daily
            </p>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-4">
        <Button
          type="submit"
          disabled={isPending}
          className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {isPending ? "Creating..." : "Create Birdwatcher"}
        </Button>
      </div>
    </form>
  );
}
