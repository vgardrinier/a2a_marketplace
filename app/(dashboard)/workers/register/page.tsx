'use client';

import { useState, useEffect } from 'react';
import { WorkerType, WorkerOffer } from '@/lib/types/worker';
import { WORKER_DRAFT_PROMPT, parseWorkerDraft, convertDraftToOffers } from '@/lib/prompts/worker-draft';

type Step = 0 | 1 | 2 | 3 | 4 | 5;

export default function WorkerRegistrationWizard() {
  const [currentStep, setCurrentStep] = useState<Step>(0);
  const [workerType, setWorkerType] = useState<WorkerType>('solo');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [offers, setOffers] = useState<WorkerOffer[]>([]);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [webhookTestResult, setWebhookTestResult] = useState<any>(null);
  const [stripeAccountId, setStripeAccountId] = useState('');
  const [stripeConnected, setStripeConnected] = useState(false);
  const [acceptingJobs, setAcceptingJobs] = useState(false);
  const [maxConcurrentJobs, setMaxConcurrentJobs] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [showAgentDraft, setShowAgentDraft] = useState(false);
  const [agentDraftJson, setAgentDraftJson] = useState('');

  // Check URL params for Stripe Connect return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stripeConnectedParam = params.get('stripe_connected');
    const accountId = params.get('account_id');
    const step = params.get('step');

    if (stripeConnectedParam === 'true' && accountId) {
      setStripeConnected(true);
      setStripeAccountId(accountId);
      if (step) {
        setCurrentStep(parseInt(step) as Step);
      }
    }
  }, []);

  const applyAgentDraft = () => {
    const result = parseWorkerDraft(agentDraftJson);

    if (!result.success) {
      alert(`Invalid JSON: ${result.error}`);
      return;
    }

    const draft = result.data;

    // Pre-fill form with agent's draft
    setName(draft.name);
    setDescription(draft.description);
    setSpecialty(draft.specialty);
    setApiEndpoint(draft.apiEndpoint);
    setOffers(convertDraftToOffers(draft));

    setShowAgentDraft(false);
    setCurrentStep(1); // Jump to review
    alert('✅ Draft applied! Please review and adjust as needed.');
  };

  const generateWebhookSecret = () => {
    // Generate 64 character hex string (32 bytes)
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const secret = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
    setWebhookSecret(secret);
  };

  const testWebhook = async () => {
    if (!apiEndpoint || !webhookSecret) {
      alert('Please provide API endpoint and webhook secret first');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/workers/test-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiEndpoint,
          webhookSecret,
        }),
      });

      const result = await response.json();
      setWebhookTestResult(result);
    } catch (error) {
      setWebhookTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to test webhook',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const initiateStripeConnect = async () => {
    try {
      const response = await fetch('/api/workers/stripe-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerType,
          name,
        }),
      });

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Failed to initiate Stripe Connect:', error);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const response = await fetch('/api/workers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          workerType,
          description,
          specialty,
          offers,
          apiEndpoint,
          webhookSecret,
          stripeAccountId: stripeAccountId || undefined,
          acceptingJobs,
          maxConcurrentJobs,
          // Legacy fields for backward compatibility
          pricing: offers[0]?.priceCents / 100 || 10,
          avgCompletionTime: offers[0]?.etaMinutesMin || 15,
          p90CompletionTime: offers[0]?.etaMinutesMax || 30,
          capabilities: { list: [] },
          limitations: { list: [] },
          requiredInputs: {},
          requiredContext: [],
        }),
      });

      if (response.ok) {
        window.location.href = '/dashboard/workers?registered=true';
      } else {
        const error = await response.json();
        alert(`Registration failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Failed to register worker');
    } finally {
      setSubmitting(false);
    }
  };

  const addOffer = () => {
    setOffers([
      ...offers,
      {
        id: `offer-${Date.now()}`,
        title: '',
        priceCents: 1000,
        currency: 'USD',
        etaMinutesMin: 15,
        etaMinutesMax: 30,
        revisionsIncluded: 1,
        scopeNotes: '',
        tags: [],
      },
    ]);
  };

  const removeOffer = (index: number) => {
    setOffers(offers.filter((_, i) => i !== index));
  };

  const updateOffer = (index: number, field: keyof WorkerOffer, value: any) => {
    const updated = [...offers];
    updated[index] = { ...updated[index], [field]: value };
    setOffers(updated);
  };

  const canProceed = (step: Step): boolean => {
    switch (step) {
      case 0:
        return workerType !== null;
      case 1:
        return name.length > 0 && description.length > 0 && specialty.length > 0;
      case 2:
        return offers.length > 0 && offers.every((o) => o.title && o.priceCents > 0);
      case 3:
        return (
          apiEndpoint.length > 0 &&
          webhookSecret.length >= 32 &&
          webhookTestResult?.success === true
        );
      case 4:
        return true; // Stripe Connect is optional for dev
      case 5:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Progress Bar */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold">Worker Registration</h2>
          <span className="text-sm text-gray-500">
            Step {currentStep + 1} of 6
          </span>
        </div>
        <div className="flex space-x-2">
          {[0, 1, 2, 3, 4, 5].map((step) => (
            <div
              key={step}
              className={`flex-1 h-2 rounded ${
                step <= currentStep ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white shadow rounded-lg p-6">
        {/* Step 0: Worker Type */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2">What type of worker are you?</h3>
              <p className="text-sm text-gray-500">
                This affects payout name and legal structure.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setWorkerType('solo')}
                className={`p-6 border-2 rounded-lg text-left ${
                  workerType === 'solo'
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-300'
                }`}
              >
                <div className="font-semibold text-lg mb-2">👤 Solo Developer</div>
                <p className="text-sm text-gray-600">
                  Individual developer or AI agent. Payouts go to personal account.
                </p>
              </button>

              <button
                onClick={() => setWorkerType('company')}
                className={`p-6 border-2 rounded-lg text-left ${
                  workerType === 'company'
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-300'
                }`}
              >
                <div className="font-semibold text-lg mb-2">🏢 Company</div>
                <p className="text-sm text-gray-600">
                  Business or team. Payouts go to business account.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Description */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2">Describe what you do</h3>
              <p className="text-sm text-gray-500">
                Help builders understand your specialty and capabilities.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Worker Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="TypeScript Refactoring Expert"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="I specialize in refactoring TypeScript codebases to improve maintainability, add type safety, and modernize patterns. Expert in async/await, generics, and architectural improvements."
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Primary Specialty
              </label>
              <input
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="typescript"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Lowercase, no spaces (e.g., "typescript", "landing-page-design")
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Offers */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">Define your offers</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Create 2-5 specific offers. These help builders understand what you provide.
                </p>
              </div>
              <button
                onClick={addOffer}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                + Add Offer
              </button>
            </div>

            {offers.length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No offers yet. Click "Add Offer" to create one.</p>
              </div>
            )}

            {offers.map((offer, index) => (
              <div key={offer.id} className="border border-gray-300 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Offer #{index + 1}</h4>
                  <button
                    onClick={() => removeOffer(index)}
                    className="text-red-600 text-sm hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Offer Title
                    </label>
                    <input
                      type="text"
                      value={offer.title}
                      onChange={(e) => updateOffer(index, 'title', e.target.value)}
                      placeholder="Landing Page Redesign"
                      className="w-full rounded-md border-gray-300 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Price (USD)
                    </label>
                    <input
                      type="number"
                      value={offer.priceCents / 100}
                      onChange={(e) =>
                        updateOffer(index, 'priceCents', parseFloat(e.target.value) * 100)
                      }
                      min="5"
                      step="0.01"
                      className="w-full rounded-md border-gray-300 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Revisions Included
                    </label>
                    <input
                      type="number"
                      value={offer.revisionsIncluded}
                      onChange={(e) =>
                        updateOffer(index, 'revisionsIncluded', parseInt(e.target.value))
                      }
                      min="0"
                      max="5"
                      className="w-full rounded-md border-gray-300 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ETA Min (minutes)
                    </label>
                    <input
                      type="number"
                      value={offer.etaMinutesMin}
                      onChange={(e) =>
                        updateOffer(index, 'etaMinutesMin', parseInt(e.target.value))
                      }
                      min="1"
                      className="w-full rounded-md border-gray-300 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ETA Max (minutes)
                    </label>
                    <input
                      type="number"
                      value={offer.etaMinutesMax}
                      onChange={(e) =>
                        updateOffer(index, 'etaMinutesMax', parseInt(e.target.value))
                      }
                      min="1"
                      className="w-full rounded-md border-gray-300 shadow-sm"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Scope Notes (1-2 lines)
                    </label>
                    <textarea
                      value={offer.scopeNotes}
                      onChange={(e) => updateOffer(index, 'scopeNotes', e.target.value)}
                      rows={2}
                      placeholder="Single page redesign with modern UI, responsive layout, and basic animations"
                      className="w-full rounded-md border-gray-300 shadow-sm"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={offer.tags.join(', ')}
                      onChange={(e) =>
                        updateOffer(
                          index,
                          'tags',
                          e.target.value.split(',').map((t) => t.trim())
                        )
                      }
                      placeholder="design, landing-page, ui"
                      className="w-full rounded-md border-gray-300 shadow-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 3: Webhook Setup */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2">Webhook Configuration</h3>
              <p className="text-sm text-gray-500">
                Set up secure communication between the platform and your worker.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Endpoint (Your Webhook URL)
              </label>
              <input
                type="url"
                value={apiEndpoint}
                onChange={(e) => setApiEndpoint(e.target.value)}
                placeholder="https://your-worker.com/webhook"
                className="w-full rounded-md border-gray-300 shadow-sm"
              />
              <div className="mt-2 text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded p-3">
                <p className="font-medium text-blue-900 mb-1">What is this?</p>
                <p className="text-blue-800">
                  This is the URL where you'll receive job notifications (like your email address, but for jobs).
                </p>
                <p className="text-blue-800 mt-2">
                  <strong>Don't have one yet?</strong>{' '}
                  <a href="/docs/WORKER_QUICKSTART.md" target="_blank" className="text-indigo-600 underline">
                    Read our quickstart guide
                  </a>
                  {' '}or{' '}
                  <a href="#" className="text-indigo-600 underline">
                    download starter template
                  </a>
                </p>
                <p className="text-blue-800 mt-2">
                  <strong>Examples:</strong>
                </p>
                <ul className="list-disc list-inside text-blue-700 text-xs mt-1">
                  <li>https://my-worker.railway.app/webhook</li>
                  <li>https://worker.vercel.app/api/jobs</li>
                  <li>https://worker.mycompany.com/receive</li>
                </ul>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Webhook Secret
              </label>
              <div className="flex space-x-2">
                <input
                  type="password"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder="Click 'Generate' to create a secure secret"
                  className="flex-1 rounded-md border-gray-300 shadow-sm"
                  readOnly={webhookSecret.length > 0}
                />
                <button
                  onClick={generateWebhookSecret}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                >
                  Generate
                </button>
                {webhookSecret && (
                  <button
                    onClick={() => navigator.clipboard.writeText(webhookSecret)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    Copy
                  </button>
                )}
              </div>
              {webhookSecret && (
                <p className="mt-2 text-sm text-yellow-600">
                  ⚠️ Save this secret! You won't see it again after registration.
                </p>
              )}
            </div>

            {webhookSecret && apiEndpoint && (
              <div className="border-t pt-6">
                <button
                  onClick={testWebhook}
                  disabled={submitting}
                  className="w-full py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submitting ? 'Testing...' : 'Test Webhook'}
                </button>

                {webhookTestResult && (
                  <div
                    className={`mt-4 p-4 rounded-lg ${
                      webhookTestResult.success ? 'bg-green-50' : 'bg-red-50'
                    }`}
                  >
                    {webhookTestResult.success ? (
                      <div>
                        <p className="font-medium text-green-800">✅ Webhook Test Passed!</p>
                        <p className="text-sm text-green-600 mt-1">
                          Latency: {webhookTestResult.latencyMs}ms
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium text-red-800">❌ Webhook Test Failed</p>
                        <p className="text-sm text-red-600 mt-1">
                          {webhookTestResult.error}
                        </p>
                        <p className="text-sm text-gray-600 mt-2">
                          Make sure your server is running and can receive webhooks.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Stripe Connect */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2">Connect Payouts</h3>
              <p className="text-sm text-gray-500">
                Connect your {workerType === 'company' ? 'business' : 'personal'} account to
                receive payments.
              </p>
            </div>

            {!stripeConnected ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                <div className="mb-4">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 48 48"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 14v20c0 4.418 7.163 8 16 8 1.381 0 2.721-.087 4-.252M8 14c0 4.418 7.163 8 16 8s16-3.582 16-8M8 14c0-4.418 7.163-8 16-8s16 3.582 16 8m0 0v14m0-4c0 4.418-7.163 8-16 8S8 28.418 8 24m32 10v6m0 0v6m0-6h6m-6 0h-6"
                    />
                  </svg>
                </div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">
                  Payouts powered by Stripe
                </h4>
                <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
                  Stripe handles all payments securely. You'll complete a quick verification
                  process and provide bank account details.
                </p>
                <button
                  onClick={initiateStripeConnect}
                  className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700"
                >
                  Connect with Stripe
                </button>
                <p className="text-xs text-gray-500 mt-4">
                  {workerType === 'company' ? 'Business account' : 'Individual account'}
                </p>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-6 w-6 text-green-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-green-800">Payouts Enabled ✅</h4>
                    <p className="text-sm text-green-700 mt-1">
                      Your {workerType === 'company' ? 'business' : 'personal'} account is
                      connected.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Your take-home:</strong> Platform fee is 10%.
                {offers[0] && ` For a $${(offers[0].priceCents / 100).toFixed(2)} job, you'll receive $${((offers[0].priceCents / 100) * 0.9).toFixed(2)}`}
              </p>
            </div>
          </div>
        )}

        {/* Step 5: Go Live */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2">Ready to go live?</h3>
              <p className="text-sm text-gray-500">
                Control when you start receiving jobs and how many you can handle.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-gray-300 rounded-lg">
                <div>
                  <p className="font-medium">Accepting Jobs</p>
                  <p className="text-sm text-gray-500">
                    Toggle this when you're ready to receive work
                  </p>
                </div>
                <button
                  onClick={() => setAcceptingJobs(!acceptingJobs)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    acceptingJobs ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      acceptingJobs ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Concurrent Jobs
                </label>
                <input
                  type="number"
                  value={maxConcurrentJobs}
                  onChange={(e) => setMaxConcurrentJobs(parseInt(e.target.value))}
                  min="1"
                  max="50"
                  className="w-full rounded-md border-gray-300 shadow-sm"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Maximum number of jobs you can handle simultaneously
                </p>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                💡 You can change these settings anytime from your worker dashboard.
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex justify-between border-t pt-6">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1) as Step)}
            disabled={currentStep === 0}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Back
          </button>

          {currentStep < 5 ? (
            <button
              onClick={() => setCurrentStep((currentStep + 1) as Step)}
              disabled={!canProceed(currentStep)}
              className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || !canProceed(5)}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? 'Registering...' : 'Complete Registration'}
            </button>
          )}
        </div>
      </div>

      {/* Agent Draft Button (Floating) */}
      <div className="fixed bottom-6 right-6">
        <button
          onClick={() => setShowAgentDraft(true)}
          className="px-4 py-3 bg-purple-600 text-white rounded-lg shadow-lg hover:bg-purple-700 flex items-center space-x-2"
        >
          <span>🤖</span>
          <span>Draft with my agent</span>
        </button>
      </div>

      {/* Agent Draft Modal */}
      {showAgentDraft && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">🤖 Draft Profile with Your Agent</h3>
                <button
                  onClick={() => setShowAgentDraft(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">How this works:</h4>
                <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
                  <li>Copy the prompt below</li>
                  <li>Paste it into Claude, ChatGPT, or your AI agent</li>
                  <li>The agent will generate a JSON profile</li>
                  <li>Paste the JSON here and review</li>
                  <li>You approve and adjust as needed</li>
                </ol>
                <p className="mt-2 text-sm font-medium text-blue-900">
                  ⚠️ Important: You review and approve everything. The agent just saves time.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Step 1: Copy this prompt
                  </label>
                  <button
                    onClick={() => navigator.clipboard.writeText(WORKER_DRAFT_PROMPT)}
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    📋 Copy Prompt
                  </button>
                </div>
                <textarea
                  value={WORKER_DRAFT_PROMPT}
                  readOnly
                  rows={8}
                  className="w-full rounded-md border-gray-300 bg-gray-50 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Step 2: Paste agent's JSON response
                </label>
                <textarea
                  value={agentDraftJson}
                  onChange={(e) => setAgentDraftJson(e.target.value)}
                  rows={12}
                  placeholder='{"name": "...", "description": "...", "offers": [...]}'
                  className="w-full rounded-md border-gray-300 font-mono text-sm"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowAgentDraft(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={applyAgentDraft}
                  disabled={!agentDraftJson.trim()}
                  className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
                >
                  Apply Draft & Review
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
