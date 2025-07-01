import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          {/* Form */}
          <form className="space-y-6">
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
                placeholder="e.g., Competitor Price Monitor, Product Availability Tracker"
                className="h-12 text-base"
              />
              <p className="text-xs text-slate-500">
                Give your monitoring task a descriptive name
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
                type="url"
                placeholder="https://example.com/page-to-monitor"
                className="h-12 text-base"
              />
              <p className="text-xs text-slate-500">
                Enter the full URL of the page you want to monitor
              </p>
            </div>

            {/* Instructions */}
            <div className="space-y-2">
              <label
                htmlFor="instructions"
                className="text-sm font-semibold text-slate-700 block"
              >
                Monitoring Instructions
              </label>
              <Textarea
                id="instructions"
                placeholder="Describe what changes you want to monitor. For example: 'Alert me when the price of the iPhone 15 Pro changes' or 'Monitor for new job postings in the Engineering section'"
                className="min-h-[120px] text-base resize-none"
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
                    type="number"
                    min="0"
                    max="30"
                    placeholder="0"
                    className="h-12 text-base text-center"
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
                    type="number"
                    min="0"
                    max="23"
                    placeholder="6"
                    className="h-12 text-base text-center"
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
                    type="number"
                    min="0"
                    max="59"
                    placeholder="0"
                    className="h-12 text-base text-center"
                  />
                </div>
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                <p>Set the time interval between each monitoring check</p>
                <div className="bg-slate-50 rounded p-2 text-xs">
                  <p className="font-medium mb-1">Examples:</p>
                  <p>
                    •{" "}
                    <span className="font-medium">
                      0 days, 1 hour, 0 minutes
                    </span>{" "}
                    - Check every hour
                  </p>
                  <p>
                    •{" "}
                    <span className="font-medium">
                      0 days, 6 hours, 0 minutes
                    </span>{" "}
                    - Check every 6 hours
                  </p>
                  <p>
                    •{" "}
                    <span className="font-medium">
                      1 day, 0 hours, 0 minutes
                    </span>{" "}
                    - Check daily
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                Create Monitoring Task
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
