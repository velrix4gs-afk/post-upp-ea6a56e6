import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Mail, ArrowLeft } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

const EmailVerification = () => {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  const signupData = location.state?.signupData;
  const email = signupData?.email;

  useEffect(() => {
    if (!email) {
      toast({
        title: 'Error',
        description: 'No email found. Please sign up again.',
        variant: 'destructive'
      });
      navigate('/signup');
    }
  }, [email, navigate]);

  const handleVerify = async () => {
    if (otp.length !== 6) {
      toast({
        title: 'Invalid code',
        description: 'Please enter the 6-digit code',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      // Verify OTP and create account via edge function
      const { data, error } = await supabase.functions.invoke('verify-signup-otp', {
        body: {
          email: signupData.email,
          code: otp,
          password: signupData.password,
          username: signupData.username,
          displayName: signupData.displayName
        }
      });

      if (error || data?.error) {
        const errorMessage = data?.error || error?.message || 'Verification failed';
        toast({
          title: 'Verification failed',
          description: errorMessage.includes('already registered') 
            ? 'This email is already registered. Please sign in instead.'
            : errorMessage,
          variant: 'destructive'
        });
        
        if (errorMessage.includes('already registered')) {
          navigate('/signin');
        }
        return;
      }

      // Sign in the newly created user
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: signupData.email,
        password: signupData.password
      });

      if (signInError) {
        console.error('Auto sign-in error:', signInError);
        toast({
          title: 'Account created!',
          description: 'Please sign in with your new account.'
        });
        navigate('/signin');
        return;
      }

      toast({
        title: 'Welcome to POST UP!',
        description: 'Your account has been created successfully.'
      });

      navigate('/onboarding', { replace: true });

    } catch (error: any) {
      console.error('Verification error:', error);
      toast({
        title: 'Verification failed',
        description: error.message || 'Something went wrong. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-signup-otp', {
        body: { email }
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || 'Failed to resend code');
      }

      setOtp(''); // Clear the OTP input
      toast({
        title: 'Code resent',
        description: 'A new verification code has been sent to your email.'
      });
    } catch (error: any) {
      toast({
        title: 'Failed to resend',
        description: error.message || 'Please try again later.',
        variant: 'destructive'
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-accent/5 to-background flex items-center justify-center p-4">
      <main>
      <Card className="w-full max-w-md bg-gradient-card border-0 shadow-xl">
        <div className="p-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/signin')}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sign Up
          </Button>

          <div className="text-center mb-8">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Verify Your Email</h1>
            <p className="text-muted-foreground">
              We sent a 6-digit code to<br />
              <span className="font-medium text-foreground">{email}</span>
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={(value) => setOtp(value)}
                disabled={loading}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              onClick={handleVerify}
              disabled={loading || otp.length !== 6}
              className="w-full bg-gradient-primary hover:shadow-glow transition-all duration-300"
            >
              {loading ? 'Verifying...' : 'Verify Email'}
            </Button>

            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Didn't receive the code?
              </p>
              <Button
                variant="link"
                onClick={handleResend}
                disabled={resending}
                className="text-primary"
              >
                {resending ? 'Sending...' : 'Resend Code'}
              </Button>
            </div>
          </div>
        </div>
      </Card>
      </main>
    </div>
  );
};

export default EmailVerification;
