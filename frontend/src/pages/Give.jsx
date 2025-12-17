import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { QrCodeIcon, DevicePhoneMobileIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import QRCode from 'qrcode';

// Only initialize Stripe if publishable key is available
const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = stripeKey ? loadStripe(stripeKey) : null;

// Debug logging
console.log('[Give.jsx] Stripe key available:', !!stripeKey);
if (stripeKey) {
  console.log('[Give.jsx] Stripe key prefix:', stripeKey.substring(0, 10));
}

// Wrapper component to provide Stripe Elements context
const GiveWrapper = () => {
  if (!stripePromise) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-white text-center">
          <p className="text-xl mb-2">Payment processing is not available</p>
          <p className="text-slate-400">Please contact the church office to give.</p>
        </div>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <Give />
    </Elements>
  );
};

const Give = () => {
  const stripe = useStripe();
  const elements = useElements();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [givingType, setGivingType] = useState('tithe');
  const [campus, setCampus] = useState('');
  const [campuses, setCampuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [qrCodeId, setQrCodeId] = useState(null);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [qrCodeImage, setQrCodeImage] = useState(null);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcReading, setNfcReading] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState('month'); // 'week', 'month', 'year'
  const [processing, setProcessing] = useState(false);

  // Check if QR code ID is in URL
  useEffect(() => {
    const qrId = searchParams.get('qr');
    const nfcId = searchParams.get('nfc');
    
    if (qrId) {
      setQrCodeId(qrId);
      loadQRCodeData(qrId);
    } else if (nfcId) {
      setQrCodeId(nfcId);
      loadQRCodeData(nfcId, true);
    }
  }, [searchParams]);

  // Check NFC support
  useEffect(() => {
    if ('NDEFReader' in window) {
      setNfcSupported(true);
    }
  }, []);

  // Load campuses
  useEffect(() => {
    loadCampuses();
  }, []);

  const loadCampuses = async () => {
    try {
      const response = await fetch('/api/campuses');
      const data = await response.json();
      const filtered = data.campuses?.filter(c => c.id !== 'all_campuses') || [];
      setCampuses(filtered);
      
      // Auto-select campus from QR code if available
      if (qrCodeData?.campus && !campus) {
        const qrCampus = filtered.find(c => c.name === qrCodeData.campus || c.id === qrCodeData.campus);
        if (qrCampus) {
          setCampus(qrCampus.id);
        }
      }
    } catch (error) {
      console.error('Error loading campuses:', error);
    }
  };

  const loadQRCodeData = async (codeId, isNfc = false) => {
    try {
      const endpoint = isNfc ? `/api/giving/nfc/${codeId}` : `/api/giving/qr/${codeId}`;
      const response = await fetch(endpoint);
      const data = await response.json();
      
      if (data.success) {
        setQrCodeData(data);
        if (data.campus) {
          // Set campus from QR/NFC data
          setTimeout(() => {
            const qrCampus = campuses.find(c => c.name === data.campus || c.id === data.campus);
            if (qrCampus) {
              setCampus(qrCampus.id);
            }
          }, 500);
        }
      }
    } catch (error) {
      console.error('Error loading QR/NFC code data:', error);
    }
  };

  const generateQRCode = async () => {
    if (!qrCodeId) return;
    
    try {
      const param = qrCodeId.startsWith('nfc_') ? 'nfc' : 'qr';
      const url = `${window.location.origin}/give?${param}=${qrCodeId}`;
      const qrImage = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeImage(qrImage);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  // Only generate QR code if NOT accessed via QR/NFC link (i.e., manual navigation)
  useEffect(() => {
    const qrParam = searchParams.get('qr');
    const nfcParam = searchParams.get('nfc');
    
    // If accessed via QR/NFC link, don't show QR code
    if (qrParam || nfcParam) {
      setQrCodeImage(null);
      return;
    }
    
    // Only show QR code if manually navigated to /give
    if (!qrCodeId && !qrCodeImage) {
      // Don't generate QR for manual navigation
    }
  }, [qrCodeId, searchParams]);

  const handleNFCTap = async () => {
    if (!nfcSupported) {
      setError('NFC is not supported on this device. Please use a device with NFC capabilities.');
      return;
    }

    setNfcReading(true);
    setError('');

    try {
      const ndef = new window.NDEFReader();
      
      await ndef.scan();
      
      ndef.onreading = async (event) => {
        try {
          const decoder = new TextDecoder();
          let nfcId = null;
          
          // Read NFC tag data
          for (const record of event.message.records) {
            if (record.recordType === 'url') {
              // URL records have the URL directly in the data
              const url = decoder.decode(record.data);
              // Extract ID from URL like /give?nfc=xxx or /api/giving/nfc/xxx
              const match = url.match(/(?:nfc[=_]|nfc\/)([a-zA-Z0-9_-]+)/);
              if (match) {
                nfcId = match[1];
                break;
              }
            } else if (record.recordType === 'text') {
              const text = decoder.decode(record.data);
              // Extract ID from text
              const match = text.match(/(?:nfc[=_]|nfc\/)([a-zA-Z0-9_-]+)/);
              if (match) {
                nfcId = match[1];
                break;
              }
            } else if (record.recordType === 'empty') {
              // Try to get ID from record ID
              if (record.id) {
                nfcId = record.id.replace(/^nfc_/, '');
                break;
              }
            }
          }
          
          if (nfcId) {
            // Ensure it has the nfc_ prefix if it doesn't
            const fullNfcId = nfcId.startsWith('nfc_') ? nfcId : `nfc_${nfcId}`;
            setQrCodeId(fullNfcId);
            await loadQRCodeData(fullNfcId, true);
            setNfcReading(false);
          } else {
            setError('Could not read NFC tag. Please try again.');
            setNfcReading(false);
          }
        } catch (err) {
          console.error('Error reading NFC:', err);
          setError('Error reading NFC tag. Please try again.');
          setNfcReading(false);
        }
      };

      ndef.onreadingerror = (error) => {
        console.error('NFC read error:', error);
        setError('Error reading NFC tag. Make sure your device supports NFC and it is enabled.');
        setNfcReading(false);
      };

      // Timeout after 30 seconds
      setTimeout(() => {
        if (nfcReading) {
          setError('NFC read timeout. Please try again.');
          setNfcReading(false);
        }
      }, 30000);

    } catch (error) {
      console.error('NFC error:', error);
      setError('NFC is not available. Please enable NFC on your device.');
      setNfcReading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email || !amount || !campus) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    const amountInCents = Math.round(parseFloat(amount) * 100);
    if (amountInCents <= 0) {
      setError('Please enter a valid amount');
      setLoading(false);
      return;
    }

    if (!stripePromise) {
      setError('Payment processing is not available. Please contact the church office.');
      setLoading(false);
      return;
    }

    try {
      if (isRecurring) {
        // Handle recurring subscription
        await handleRecurringPayment(amountInCents);
      } else {
        // Handle one-time payment
        await handleOneTimePayment(amountInCents);
      }
    } catch (error) {
      console.error('Payment error:', error);
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleOneTimePayment = async (amountInCents) => {
    if (!stripe || !elements) {
      setError('Payment system is not ready. Please refresh the page.');
      setLoading(false);
      return;
    }

    setProcessing(true);

    try {
      // Step 1: Create payment intent
      const response = await fetch('/api/giving/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInCents,
          type: givingType,
          campus: campus,
          email: email,
          source: qrCodeId ? (qrCodeId.startsWith('nfc_') ? 'tap_to_give' : 'qr_code') : 'web',
          qr_code_id: qrCodeId,
          service_date: qrCodeData?.service_date || new Date().toISOString().split('T')[0],
        }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        setLoading(false);
        setProcessing(false);
        return;
      }

      console.log('[Give.jsx] Payment intent created:', data.payment_intent_id);

      // Step 2: Confirm payment with card element
      const cardElement = elements.getElement(CardElement);
      
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        data.client_secret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              email: email,
            },
          },
        }
      );

      setProcessing(false);

      if (stripeError) {
        console.error('[Give.jsx] Stripe error:', stripeError);
        setError(stripeError.message || 'Payment failed. Please try again.');
        setLoading(false);
        return;
      }

      if (paymentIntent.status === 'succeeded') {
        console.log('[Give.jsx] Payment succeeded:', paymentIntent.id);
        setSuccess(true);
        setError('');
        setLoading(false);
        
        // Reset form after 3 seconds
        setTimeout(() => {
          setEmail('');
          setAmount('');
          setSuccess(false);
          
          // Clear card element
          cardElement.clear();
        }, 3000);
      } else {
        setError('Payment was not completed. Please try again.');
        setLoading(false);
      }
      
    } catch (error) {
      console.error('One-time payment error:', error);
      setError('An error occurred processing your payment. Please try again.');
      setLoading(false);
      setProcessing(false);
    }
  };

  const handleRecurringPayment = async (amountInCents) => {
    if (!stripe || !elements) {
      setError('Payment system is not ready. Please refresh the page.');
      setLoading(false);
      return;
    }

    setProcessing(true);

    try {
      // Step 1: Create setup intent to collect payment method
      const setupIntentResponse = await fetch('/api/giving/create-setup-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
        }),
      });

      const setupIntentData = await setupIntentResponse.json();

      if (setupIntentData.error) {
        setError(setupIntentData.error);
        setLoading(false);
        setProcessing(false);
        return;
      }

      console.log('[Give.jsx] Setup intent created');

      // Step 2: Confirm setup intent with card element
      const cardElement = elements.getElement(CardElement);
      
      const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(
        setupIntentData.client_secret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              email: email,
            },
          },
        }
      );

      setProcessing(false);

      if (stripeError) {
        console.error('[Give.jsx] Stripe error:', stripeError);
        setError(stripeError.message || 'Failed to set up payment method. Please try again.');
        setLoading(false);
        return;
      }

      if (setupIntent.status === 'succeeded') {
        console.log('[Give.jsx] Setup intent succeeded, payment method:', setupIntent.payment_method);

        // Step 3: Create subscription with the payment method
        const subscriptionResponse = await fetch('/api/giving/create-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: amountInCents,
            type: givingType,
            campus: campus,
            email: email,
            source: qrCodeId ? (qrCodeId.startsWith('nfc_') ? 'tap_to_give' : 'qr_code') : 'web',
            qr_code_id: qrCodeId,
            interval: recurringInterval,
            payment_method_id: setupIntent.payment_method,
          }),
        });

        const subscriptionData = await subscriptionResponse.json();

        if (subscriptionData.error) {
          setError(subscriptionData.error);
          setLoading(false);
          return;
        }

        if (subscriptionData.success) {
          console.log('[Give.jsx] Subscription created successfully');
          setSuccess(true);
          setError('');
          setLoading(false);
          
          // Reset form after 3 seconds
          setTimeout(() => {
            setEmail('');
            setAmount('');
            setIsRecurring(false);
            setSuccess(false);
            
            // Clear card element
            cardElement.clear();
          }, 3000);
        } else {
          setError('Failed to create subscription. Please try again.');
          setLoading(false);
        }
      } else {
        setError('Payment method setup was not completed. Please try again.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Recurring payment error:', error);
      setError('An error occurred processing your subscription. Please try again.');
      setLoading(false);
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Give to Futures Church</h1>
            <p className="text-slate-400">Your generosity makes a difference</p>
          </div>

          {/* QR Code Display - Only show if NOT accessed via QR/NFC link */}
          {qrCodeImage && !qrCodeId && (
            <div className="mb-6 p-6 bg-white rounded-xl text-center">
              <p className="text-sm text-slate-600 mb-3">Scan this QR code to give</p>
              <img src={qrCodeImage} alt="QR Code" className="mx-auto w-64 h-64" />
              <p className="text-xs text-slate-500 mt-3">Or tap your phone on an NFC tag</p>
            </div>
          )}

          {/* NFC Tap Button */}
          {nfcSupported && (
            <div className="mb-6">
              <button
                onClick={handleNFCTap}
                disabled={nfcReading}
                className={`w-full py-4 px-6 rounded-xl font-semibold transition-all ${
                  nfcReading
                    ? 'bg-blue-500/50 text-white/70 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700'
                }`}
              >
                <div className="flex items-center justify-center gap-3">
                  <DevicePhoneMobileIcon className="h-6 w-6" />
                  {nfcReading ? 'Reading NFC Tag...' : 'Tap to Give (NFC)'}
                </div>
              </button>
              {nfcReading && (
                <p className="text-center text-sm text-slate-400 mt-2">
                  Hold your phone near an NFC tag...
                </p>
              )}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-xl text-green-200">
              <p className="text-center font-semibold">Thank you for your generosity! Your gift has been received.</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200">
              <p className="text-center">{error}</p>
            </div>
          )}

          {/* Donation Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="your.email@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Amount (AUD) <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400">$</span>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Giving Type <span className="text-red-400">*</span>
              </label>
              <select
                value={givingType}
                onChange={(e) => setGivingType(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="tithe">Tithe</option>
                <option value="offering">Offering</option>
                <option value="missions">Missions</option>
                <option value="event">Event</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Campus <span className="text-red-400">*</span>
              </label>
              <select
                value={campus}
                onChange={(e) => setCampus(e.target.value)}
                required
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a campus</option>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Card Element */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Card Details <span className="text-red-400">*</span>
              </label>
              <div className="p-4 bg-slate-700/50 border border-slate-600/50 rounded-lg focus-within:ring-2 focus-within:ring-blue-500">
                <CardElement
                  options={{
                    style: {
                      base: {
                        fontSize: '16px',
                        color: '#fff',
                        '::placeholder': {
                          color: '#94a3b8',
                        },
                        iconColor: '#fff',
                      },
                      invalid: {
                        color: '#ef4444',
                        iconColor: '#ef4444',
                      },
                    },
                    hidePostalCode: true, // Hide postal code for Australian users
                  }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Your payment is secure and encrypted
              </p>
            </div>

            {/* Recurring Payment Toggle */}
            <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-3">
                  <ArrowPathIcon className="h-5 w-5 text-purple-400" />
                  <div>
                    <div className="text-sm font-medium text-white">Make this a recurring gift</div>
                    <div className="text-xs text-slate-400">Set up automatic giving</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRecurring(!isRecurring)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isRecurring ? 'bg-purple-600' : 'bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isRecurring ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </label>

              {isRecurring && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Frequency <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={recurringInterval}
                    onChange={(e) => setRecurringInterval(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="week">Weekly</option>
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                  </select>
                  <p className="text-xs text-slate-400 mt-2">
                    Your gift of ${amount || '0.00'} will be processed {recurringInterval === 'week' ? 'every week' : recurringInterval === 'month' ? 'every month' : 'every year'}
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || processing || !stripe || !elements}
              className={`w-full py-4 px-6 rounded-xl font-semibold text-white transition-all ${
                loading || processing || !stripe || !elements
                  ? 'bg-slate-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 transform hover:scale-105'
              }`}
            >
              {processing ? 'Processing Payment...' : loading ? 'Setting up...' : isRecurring ? `Set Up Recurring Gift` : 'Give Now'}
            </button>
          </form>

          {/* Info about QR/NFC */}
          {qrCodeId && (
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <p className="text-sm text-blue-200 text-center">
                {qrCodeId.startsWith('nfc_') ? (
                  <>NFC Tag: {qrCodeId}</>
                ) : (
                  <>QR Code: {qrCodeId}</>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GiveWrapper;

