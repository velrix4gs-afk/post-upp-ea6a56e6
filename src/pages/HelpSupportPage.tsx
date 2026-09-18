import { useState } from 'react';
import { BackNavigation } from '@/components/BackNavigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
    HelpCircle,
    MessageCircleQuestion,
    Flag,
    ShieldCheck,
    Mail,
    Loader2,
    Send,
} from 'lucide-react';

const FAQ_ITEMS: { question: string; answer: string }[] = [
    {
        question: 'How do I reset my password?',
        answer:
            "Go to Settings & Privacy > Account, then tap \"Change Password.\" If you're signed out, use the \"Forgot password\" link on the sign-in screen and follow the email instructions.",
    },
    {
        question: 'How do I make my account private?',
        answer:
            'Go to Settings & Privacy > Privacy, then toggle "Private Account" on. Only approved followers will be able to see your posts and full profile after that.',
    },
    {
        question: 'How do I get verified?',
        answer:
            'Open the menu and tap "Get Verified" to see the requirements and submit a request. Verification is reviewed manually, so it can take a few days.',
    },
    {
        question: 'Why was my post removed?',
        answer:
            "Posts are removed when they're reported and found to violate our Community Guidelines. You'll usually get a notification explaining why. You can appeal from the Report a Problem section below.",
    },
    {
        question: 'How do I cancel my Premium subscription?',
        answer:
            'Subscriptions are managed through the payment provider you used to subscribe. Check the email receipt from your purchase for a manage/cancel link, or contact support below and we\'ll help you out.',
    },
    {
        question: 'How do I delete my account?',
        answer:
            'Go to Settings & Privacy > Account > Delete Account. This is permanent and removes your posts, messages, and profile after a short grace period.',
    },
];

const HelpSupportPage = () => {
    const { user } = useAuth();
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const [reportSubject, setReportSubject] = useState('');
    const [reportMessage, setReportMessage] = useState('');
    const [reportSubmitting, setReportSubmitting] = useState(false);

    const submitTicket = async (
        kind: 'support' | 'report',
        subjectVal: string,
        messageVal: string,
        reset: () => void,
        setBusy: (v: boolean) => void
    ) => {
        if (!messageVal.trim()) {
            toast({ description: 'Please describe your issue before sending.', variant: 'destructive' });
            return;
        }
        setBusy(true);
        try {
            const { error } = await supabase.from('support_tickets').insert({
                user_id: user?.id ?? null,
                kind,
                subject: subjectVal || (kind === 'report' ? 'Problem report' : 'Support request'),
                message: messageVal,
            });
            if (error) throw error;
            toast({ description: "Sent — we'll get back to you as soon as we can." });
            reset();
        } catch (err) {
            console.error('Failed to submit ticket:', err);
            toast({
                description: 'Could not send right now. Please try again in a moment.',
                variant: 'destructive',
            });
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="min-h-screen bg-background pb-16">
            <BackNavigation title="Help & Support" />

            <main className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
                <div className="text-center space-y-2">
                    <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mx-auto">
                        <HelpCircle className="h-7 w-7 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold">How can we help?</h1>
                    <p className="text-sm text-muted-foreground">
                        Search the FAQ below, or reach out directly and we'll get back to you.
                    </p>
                </div>

                {/* FAQ */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <MessageCircleQuestion className="h-5 w-5" />
                            Frequently Asked Questions
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Accordion type="single" collapsible className="w-full">
                            {FAQ_ITEMS.map((item, i) => (
                                <AccordionItem key={i} value={`item-${i}`}>
                                    <AccordionTrigger className="text-left text-sm font-medium">
                                        {item.question}
                                    </AccordionTrigger>
                                    <AccordionContent className="text-sm text-muted-foreground">
                                        {item.answer}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </CardContent>
                </Card>

                {/* Contact support */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Mail className="h-5 w-5" />
                            Contact Support
                        </CardTitle>
                        <CardDescription>Didn't find your answer above? Send us a message directly.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="support-subject">Subject</Label>
                            <Input
                                id="support-subject"
                                placeholder="What's this about?"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="support-message">Message</Label>
                            <Textarea
                                id="support-message"
                                placeholder="Tell us what's going on..."
                                rows={4}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                            />
                        </div>
                        <Button
                            className="w-full"
                            disabled={submitting}
                            onClick={() =>
                                submitTicket('support', subject, message, () => {
                                    setSubject('');
                                    setMessage('');
                                }, setSubmitting)
                            }
                        >
                            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                            Send Message
                        </Button>
                    </CardContent>
                </Card>

                {/* Report a problem */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Flag className="h-5 w-5" />
                            Report a Problem
                        </CardTitle>
                        <CardDescription>Report a bug, a bad experience, or content that concerns you.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="report-subject">What's wrong?</Label>
                            <Input
                                id="report-subject"
                                placeholder="e.g. App crashed, inappropriate content..."
                                value={reportSubject}
                                onChange={(e) => setReportSubject(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="report-message">Details</Label>
                            <Textarea
                                id="report-message"
                                placeholder="The more detail, the faster we can fix it."
                                rows={4}
                                value={reportMessage}
                                onChange={(e) => setReportMessage(e.target.value)}
                            />
                        </div>
                        <Button
                            variant="secondary"
                            className="w-full"
                            disabled={reportSubmitting}
                            onClick={() =>
                                submitTicket('report', reportSubject, reportMessage, () => {
                                    setReportSubject('');
                                    setReportMessage('');
                                }, setReportSubmitting)
                            }
                        >
                            {reportSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Flag className="h-4 w-4 mr-2" />}
                            Submit Report
                        </Button>
                    </CardContent>
                </Card>

                {/* Guidelines */}
                <Card>
                    <CardContent className="flex items-center justify-between py-4">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="h-5 w-5 text-primary" />
                            <div>
                                <p className="text-sm font-medium">Community Guidelines</p>
                                <p className="text-xs text-muted-foreground">What's allowed on Post Up</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
};

export default HelpSupportPage;