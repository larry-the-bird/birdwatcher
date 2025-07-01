import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Birdwatcher
            </h1>
            <p className="text-slate-600">
              Create and manage intelligent monitoring tasks for websites
            </p>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">Create Birdwatcher</TabsTrigger>
              <TabsTrigger value="manage">My Birdwatchers</TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="mt-6">
              {/* Create Birdwatcher Form */}
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
                    type="url"
                    placeholder="https://example.com/page-to-monitor"
                    className="h-12 text-base"
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
                    placeholder="Describe what changes you want to birdwatch. For example: 'Alert me when the price of the iPhone 15 Pro changes' or 'Monitor for new job postings in the Engineering section'"
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
                    <p>Set the time interval between each mbirdwatch</p>
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
                    Create Birdwatcher
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="manage" className="mt-6">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-slate-900">
                    Your Birdwatchers
                  </h2>
                  <Button variant="outline" size="sm">
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Refresh
                  </Button>
                </div>
                <div className="space-y-4">
                  <div className="border border-slate-200 rounded-lg p-6 bg-slate-50">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 mb-1">
                          Competitor Price Monitor
                        </h3>
                        <p className="text-sm text-slate-600 mb-2">
                          https://example.com/products/iphone
                        </p>
                        <p className="text-sm text-slate-700">
                          Monitor for iPhone 15 Pro price changes
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                        <Button variant="outline" size="sm">
                          Delete
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center text-xs text-slate-500 space-x-4">
                      <span>Every 6 hours</span>
                      <span>•</span>
                      <span>Last checked: 2 hours ago</span>
                      <span>•</span>
                      <span>Created: 3 days ago</span>
                    </div>
                  </div>
                  <div className="border border-slate-200 rounded-lg p-6 bg-slate-50">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 mb-1">
                          Job Posting Tracker
                        </h3>
                        <p className="text-sm text-slate-600 mb-2">
                          https://jobs.example.com/engineering
                        </p>
                        <p className="text-sm text-slate-700">
                          Alert when new engineering positions are posted
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Paused
                        </span>
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                        <Button variant="outline" size="sm">
                          Delete
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center text-xs text-slate-500 space-x-4">
                      <span>Daily</span>
                      <span>•</span>
                      <span>Last checked: 1 day ago</span>
                      <span>•</span>
                      <span>Created: 1 week ago</span>
                    </div>
                  </div>

                  {/* Empty State */}
                  <div className="text-center py-12 text-slate-500">
                    <svg
                      className="w-12 h-12 mx-auto mb-4 text-slate-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    <p className="text-sm">
                      No birdwatchers. Create your first birdwatcher to get
                      started!
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
