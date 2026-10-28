export interface SampleDoc {
  id: string;
  title: string;
  subtitle: string;
  filename: string;
  fileType: string;
  riskProfile: 'Critical Risk' | 'High Risk' | 'Moderate Risk';
  text: string;
}

export const SAMPLE_DOCUMENTS: SampleDoc[] = [
  {
    id: 'sample-saas',
    title: 'CloudSync Pro — Terms of Service & End User Agreement',
    subtitle: 'Contains mandatory binding arbitration, class action waiver, and unilateral change rights.',
    filename: 'CloudSync_Terms_of_Service_2026.pdf',
    fileType: 'application/pdf',
    riskProfile: 'Critical Risk',
    text: `CLOUDSYNC TECHNOLOGIES INC. — END USER LICENSE AND MASTER TERMS OF SERVICE
Effective Date: January 1, 2026. Last Revised: March 15, 2026.

SECTION 1. ACCEPTANCE OF TERMS
By downloading, installing, accessing, or using CloudSync Pro (the "Service"), you agree to be bound by all provisions of this Master Terms of Service. If you do not agree unconditionally to these terms, you may not register, access, or utilize the Service.

SECTION 2. UNILATERAL MODIFICATIONS TO TERMS
CloudSync Technologies Inc. reserves the exclusive right, at its sole and absolute discretion, to alter, amend, append, or replace any portion of this Agreement at any given time without prior individualized written notice to you. Any amendments or updates will become legally effective immediately upon posting to our website. Your continued access to or utilization of the Service following the posting of revisions constitutes your complete and irrevocable acceptance of the modified Terms.

SECTION 3. USER CONTENT LICENSE AND INTELLECTUAL PROPERTY
You retain copyright ownership in original data or files you upload to the Service. However, by uploading, synchronizing, or transmitting any content, code, documents, or data ("User Content"), you hereby grant CloudSync Technologies Inc. a perpetual, irrevocable, worldwide, royalty-free, transferable, and sublicensable license to use, reproduce, modify, adapt, publish, translate, create derivative works from, distribute, and publicly display such User Content for purposes of operating, marketing, benchmarking, and training internal algorithmic models.

SECTION 4. DATA COLLECTION, SHARING, AND THIRD-PARTY MARKETING
CloudSync collects telemetry data, device identifiers, IP addresses, geolocations, and usage patterns. We may share or transfer your personal data, contact information, and behavioral analytics with our affiliated business entities, advertising networks, analytics partners, and data aggregators. You understand and agree that such data may be processed in jurisdictions with differing consumer protection standards.

SECTION 5. AUTOMATIC RENEWAL AND PAYMENT OBLIGATIONS
All CloudSync paid subscription tiers are billed on an automatically recurring basis (monthly or annually). Unless you cancel your subscription at least forty-eight (48) hours prior to the conclusion of the active subscription period, your credit card or designated payment method will be charged automatically for the subsequent term at the then-current non-discounted rate. ALL PAYMENTS ARE NON-REFUNDABLE, AND NO PRO-RATED CREDITS WILL BE ISSUED FOR PARTIAL MONTHS.

SECTION 6. SUSPENSION AND TERMINATION OF SERVICE
CloudSync reserves the right, in its sole discretion, without liability, notice, or refund, to immediately terminate or suspend your account, credentials, and access to any stored data, for any reason or no reason whatsoever, including suspected inactivity or breach of any policy. Upon termination, CloudSync has no obligation to maintain, export, or return any user data.

SECTION 7. DISCLAIMER OF WARRANTIES AND LIMITATION OF LIABILITY
THE SERVICE IS PROVIDED STRICTLY ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. IN NO EVENT SHALL CLOUDSYNC TECHNOLOGIES INC., ITS OFFICERS, DIRECTORS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOSS OF PROFITS, DATA, OR BUSINESS INTERRUPTION. UNDER NO CIRCUMSTANCES SHALL CLOUDSYNC'S TOTAL AGGREGATE LIABILITY EXCEED THE GREATER OF FIFTY UNITED STATES DOLLARS ($50.00) OR THE TOTAL AMOUNT ACTUALLY PAID BY YOU TO CLOUDSYNC IN THE PRECEDING ONE (1) MONTH.

SECTION 8. MANDATORY BINDING ARBITRATION AND CLASS ACTION WAIVER
PLEASE READ THIS SECTION CAREFULLY. IT MATERIALLY AFFECTS YOUR LEGAL RIGHTS, INCLUDING YOUR RIGHT TO FILE A LAWSUIT IN COURT.
You and CloudSync agree that any controversy, claim, or dispute arising out of or relating to this Agreement or the Service shall be resolved exclusively through final and binding individual arbitration administered by the American Arbitration Association (AAA) under its Consumer Arbitration Rules. YOU HEREBY WAIVE ANY CONSTITUTIONAL AND STATUTORY RIGHTS TO GO TO COURT AND HAVE A TRIAL IN FRONT OF A JUDGE OR JURY. FURTHERMORE, ALL CLAIMS MUST BE BROUGHT IN AN INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, COLLECTIVE, OR REPRESENTATIVE PROCEEDING.

SECTION 9. DATA RETENTION AND ARCHIVAL
Notwithstanding account deletion requests, CloudSync reserves the right to retain residual customer records, transactional metadata, and system log data in encrypted off-site archives as permitted or required for compliance with statutory recordkeeping regulations.`
  },
  {
    id: 'sample-streamflex',
    title: 'StreamFlex Entertainment — Consumer Subscription Agreement',
    subtitle: 'Features dark-pattern auto-renewal, strict no-refunds, and price escalation clauses.',
    filename: 'StreamFlex_Subscription_Agreement.docx',
    fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    riskProfile: 'High Risk',
    text: `STREAMFLEX DIGITAL ENTERTAINMENT SERVICES — SUBSCRIBER TERMS AND CONDITIONS
Effective from February 2026

1. Continuous Subscription and Billing Authorization
By enrolling in StreamFlex Digital Entertainment, you authorize StreamFlex to initiate periodic recurring billing charges to your specified payment account. Your subscription plan automatically renews on a monthly cycle until explicitly terminated. You must cancel at least 72 hours before the start of the next billing cycle to prevent continuous charging.

2. Price Adjustments and Tier Alterations
StreamFlex reserves the right to adjust subscription pricing and plan features at our discretion. We will provide 15 days prior notice via on-screen banner or email. Continued use of StreamFlex following the effective date of price adjustments will be deemed acceptance of the modified billing schedule.

3. Refund Policy and Account Cancellations
All subscription fees, pre-paid vouchers, and streaming purchases are entirely non-refundable. StreamFlex does not provide partial refunds, credits, or fee adjustments for unused periods or mid-billing cycle account cancellations.

4. Household Sharing Restrictions and Device Monitoring
StreamFlex accounts are intended solely for members of a single residential household. We implement automated IP monitoring, device fingerprinting, and geolocation verification. StreamFlex reserves the right to restrict stream concurrency or impose supplemental household fees if simultaneous access is detected from disparate physical networks.

5. Dispute Resolution by Binding Arbitration
Any legal claim arising from your subscription will be adjudicated individually via binding arbitration under the rules of JAMS. You expressly waive any right to participate in consolidated or class-wide arbitration proceedings against StreamFlex Digital Entertainment.`
  },
  {
    id: 'sample-privacy',
    title: 'NovaAI Assistant — Privacy Policy & Data Collection',
    subtitle: 'Analyzes user prompts for training, cross-device tracking, and advertising broker data resale.',
    filename: 'NovaAI_Privacy_Notice_2026.txt',
    fileType: 'text/plain',
    riskProfile: 'High Risk',
    text: `NOVAAI ASSISTANT — GLOBAL PRIVACY NOTICE AND DATA PRACTICES
Last Updated: April 2026

1. Information We Collect
We collect inputs, prompts, audio clips, documents, device technical specifications, IP addresses, and behavioral metadata generated during your interaction with NovaAI.

2. Model Training and Content Reuse
You acknowledge and consent that text inputs, uploaded files, and feedback submitted to NovaAI may be de-identified and used to train, refine, benchmark, and evaluate our foundational artificial intelligence models and third-party partner models.

3. Third-Party Data Disclosures and Marketing Partners
NovaAI works with verified advertising networks, data brokers, and marketing analytics providers. We may share hashed identifiers, audience segmentation metrics, and inferred commercial interest categories with commercial partners for behavioral advertising.

4. Data Retention and Account Erasure
We store user prompt history and associated logs for an active duration of 24 months. If you delete your account, your data is detached from active user databases within 30 days, but anonymized interaction tokens and archival backup tapes may be retained indefinitely for legal audit integrity.

5. Opt-Out Limitations
While users in specific jurisdictions (e.g., California CCPA, European Union GDPR) may exercise statutory opt-out rights via our privacy portal, general users cannot opt out of automated telemetry collection while continuing to use free service tiers.`
  }
];
