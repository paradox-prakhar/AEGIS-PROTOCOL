import React from 'react';
import {
  ArrowRight, BadgeIndianRupee, Briefcase, Gavel, Headset, Heart, KeyRound, Landmark, Package, QrCode, ShieldAlert, Shuffle, Smartphone, TrendingUp,
} from 'lucide-react';
import ExpandableBentoGrid from '../components/vengeance/expandable-bento-grid';
import { Reveal, RevealGroup, RevealItem, SplitHeading } from '../components/motion';

/**
 * Education hub. General safety guidance only — no phone numbers or
 * links here; official contacts live on the Helplines & resources page.
 */
const TYPES = [
  {
    id: 'digital-arrest', icon: <Gavel size={22} />, title: 'Fake “digital arrest”', tag: 'Most reported', className: 'bento-wide',
    subtitle: 'Callers pose as police, CBI or customs and “arrest” you on video.',
    description: 'They say a parcel or bank account in your name is linked to a crime, keep you on a video call for hours and demand money to “clear your name”.',
    signs: ['Uniforms, fake ID cards or a fake police station on video', 'You are told not to tell anyone or hang up', 'Money must be transferred to “verify” or “secure” it'],
    act: ['There is no such thing as a digital arrest. Hang up.', 'Real police never ask for money on a call.', 'Report the number through official channels.'],
  },
  {
    id: 'kyc', icon: <Landmark size={22} />, title: 'KYC / bank update', tag: 'Very common',
    subtitle: '“Your account will be blocked today — update KYC now.”',
    description: 'An SMS or WhatsApp message with a link to a look-alike bank page that steals your login, card details or OTP.',
    signs: ['Urgent deadline and a threat to block your account', 'A link that is not your bank’s official website', 'A request for your OTP, PIN or card number'],
    act: ['Never use links in messages. Open your bank’s app yourself.', 'Banks never ask for your OTP or PIN.'],
  },
  {
    id: 'upi', icon: <QrCode size={22} />, title: 'UPI collect & QR tricks',
    subtitle: '“Scan this QR / enter your PIN to receive money.”',
    description: 'Buyers on marketplace apps or fake refund agents send a collect request or QR code. Approving it sends your money to them.',
    signs: ['You are asked to enter your UPI PIN to “receive” money', 'A QR code is sent for a refund or payment to you', 'Pressure to approve a request quickly'],
    act: ['You never need a PIN or QR scan to receive money.', 'Decline unexpected collect requests.'],
  },
  {
    id: 'task', icon: <Briefcase size={22} />, title: 'Part-time job & task scams',
    subtitle: 'Earn money for liking videos or rating hotels.',
    description: 'Small payouts build trust, then you are asked to “invest” or pay a deposit to unlock bigger tasks — and the money disappears.',
    signs: ['Job offered on WhatsApp or Telegram without an interview', 'Early small payments to build trust', 'Deposits required to continue or withdraw'],
    act: ['Real jobs never ask you to pay to work.', 'Stop and do not pay any “unlock” fee.'],
  },
  {
    id: 'invest', icon: <TrendingUp size={22} />, title: 'Investment & trading groups', className: 'bento-wide',
    subtitle: 'Guaranteed returns, IPO tips and fake trading apps.',
    description: 'Groups share fake profits and push you to a trading app or crypto platform. Your balance looks like it grows, but you can never withdraw.',
    signs: ['“Guaranteed” or very high daily returns', 'An app not available on official app stores', 'Fees or taxes demanded before withdrawal'],
    act: ['Check if the platform is registered with the regulator.', 'Never pay to withdraw your own money.'],
  },
  {
    id: 'care', icon: <Headset size={22} />, title: 'Fake customer care',
    subtitle: 'Numbers found on search results or social media.',
    description: 'Scammers publish fake helpline numbers for banks, airlines and delivery apps, then ask you to install a remote-access app.',
    signs: ['Number found via search ads or comments', 'Asked to install AnyDesk, TeamViewer or a “support” app', 'Refund requires you to pay or share an OTP'],
    act: ['Only use contact details inside the official app or website.', 'Never install screen-sharing apps on request.'],
  },
  {
    id: 'parcel', icon: <Package size={22} />, title: 'Courier & parcel',
    subtitle: '“Your parcel is held — pay a small fee.”',
    description: 'A text says a delivery failed or is held at customs, with a link to pay a tiny fee that steals card details.',
    signs: ['You weren’t expecting a delivery', 'A small redelivery or customs fee', 'Shortened or odd-looking link'],
    act: ['Track parcels only in the courier’s official app.'],
  },
  {
    id: 'prize', icon: <BadgeIndianRupee size={22} />, title: 'Lottery, prize & cashback',
    subtitle: 'You “won” something you never entered.',
    description: 'Messages promise lottery wins, cashback or gifts, then ask for a processing fee or your bank details.',
    signs: ['A prize you never entered for', 'A fee to release the prize', 'Requests for bank or card details'],
    act: ['If you didn’t enter, you didn’t win. Delete it.'],
  },
  {
    id: 'loan', icon: <Smartphone size={22} />, title: 'Instant loan apps',
    subtitle: 'Quick loans, then harassment and threats.',
    description: 'Unregulated apps grab your contacts and photos, charge huge fees and threaten to shame you to your contacts.',
    signs: ['App asks for access to all contacts and photos', 'Hidden charges far above the loan', 'Threats and abusive calls'],
    act: ['Borrow only from regulated lenders.', 'Don’t pay under threat — report it.'],
  },
  {
    id: 'romance', icon: <Heart size={22} />, title: 'Romance & “pig butchering”',
    subtitle: 'An online friend who slowly introduces an investment.',
    description: 'Weeks of friendly chat build trust before an “exclusive” crypto or trading opportunity appears.',
    signs: ['Never able to meet or video call properly', 'Talk turns to investing or crypto', 'Urgency to invest more'],
    act: ['Never send money to someone you’ve only met online.'],
  },
  {
    id: 'poison', icon: <Shuffle size={22} />, title: 'Address poisoning', tag: 'Crypto',
    subtitle: 'A look-alike wallet address in your history.',
    description: 'Scammers send tiny transfers from an address that starts and ends like one you use, hoping you copy it next time.',
    signs: ['Tiny or zero-value transfers you didn’t expect', 'An address that matches only the first and last characters'],
    act: ['Check the full address, not just the ends.', 'Use an address book or the Scam checker.'],
  },
  {
    id: 'drainer', icon: <KeyRound size={22} />, title: 'Approval phishing & drainers', tag: 'Crypto',
    subtitle: '“Connect wallet to claim your airdrop.”',
    description: 'A fake site asks you to sign a token approval that lets the scammer move your funds later.',
    signs: ['Airdrop or mint you never heard of', 'A signature request for unlimited spending', 'Countdown timers and hype'],
    act: ['Read what you sign. Revoke approvals you don’t recognise.'],
  },
].map((t) => ({
  ...t,
  content: (
    <div className="learn-detail">
      <div>
        <h4><ShieldAlert size={16} /> Warning signs</h4>
        <ul>{t.signs.map((s) => <li key={s}>{s}</li>)}</ul>
      </div>
      <div>
        <h4>What to do</h4>
        <ul>{t.act.map((s) => <li key={s}>{s}</li>)}</ul>
      </div>
      <div className="learn-actions">
        <a className="btn btn-primary btn-sm" href="#/scanner">Check a message <ArrowRight size={14} /></a>
        <a className="btn btn-calm btn-sm" href="#/recovery">I’ve been affected</a>
      </div>
    </div>
  ),
}));

const RULES = [
  ['Pause', 'Scams rely on panic. Any message that rushes you is a reason to slow down.'],
  ['Never share codes', 'No real bank, company or officer will ask for your OTP, PIN or password.'],
  ['Verify yourself', 'Call back using a number from the official app or website — never the one in the message.'],
];

export default function Learn() {
  return (
    <>
      <RevealGroup className="page-header" onMount>
        <div>
          <RevealItem className="eyebrow">Learn</RevealItem>
          <SplitHeading lines={['Know the tricks,', { text: 'and they stop working.', className: 'grad' }]} />
          <RevealItem as="p">The most common scams in India, explained simply. Tap a card to see the warning signs and what to do.</RevealItem>
        </div>
      </RevealGroup>

      {/* Not wrapped in <Reveal>: a variant parent breaks the grid's shared-layout (layoutId) crossfade. */}
      <ExpandableBentoGrid items={TYPES} />

      <Reveal className="card rules-card">
        <h2>Three rules that stop most scams</h2>
        <ol className="rules">
          {RULES.map(([t, d], i) => (
            <li key={t}><span className="mono">0{i + 1}</span><div><b>{t}</b><p>{d}</p></div></li>
          ))}
        </ol>
      </Reveal>
    </>
  );
}
